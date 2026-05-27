// PlaceBid — the most critical use case in this system.
//
// All of the following happen in ONE SQLite transaction, guarded by
// lockAuction() — a no-op UPDATE that takes the DB write lock (scope-cuts.md CUT-1):
//
//   1. Acquire row lock for this auction
//   2. Read auction
//   3. Apply Auction.placeBid() — domain validates status, time, amount,
//      and returns the previous leader (if any)
//   4. If there was a previous leader, refund their bid:
//        - credit their wallet (+amount)
//        - append a REFUND ledger entry
//   5. Debit the new bidder:
//        - debit their wallet (-amount)         ← may throw InsufficientPointError
//        - append a BID ledger entry
//   6. Save the updated auction
//   7. Append a BidEvent (audit log of accepted bids — feeds the detail screen)
//
// If any step throws, the entire transaction rolls back — wallets and ledger
// stay consistent (CLAUDE.md hard invariant #6).

import { Inject, Injectable } from "@nestjs/common";
import { EventEmitter2 } from "@nestjs/event-emitter";
import { UNIT_OF_WORK, type UnitOfWork } from "@/ports/unit-of-work";
import { AUCTION_EVENTS, BidPlacedEvent } from "@/application/events/auction-events";
import { AuctionId } from "@/domain/shared/value-objects/auction-id";
import { UserId } from "@/domain/shared/value-objects/user-id";
import { Point } from "@/domain/shared/value-objects/point";
import { Currency } from "@/domain/shared/value-objects/currency";
import { Wallet } from "@/domain/wallet/wallet";
import { LedgerEntry } from "@/domain/ledger/ledger-entry";
import { DomainError } from "@/domain/shared/errors";

export type PlaceBidInput = {
  auctionId: string;
  userId: bigint | number | string;
  amount: bigint | number | string;
};

export type PlaceBidResult = {
  auctionId: string;
  newHighest: bigint;
  newBidCount: number;
  refundedTo: bigint | null;
  refundedAmount: bigint | null;
};

@Injectable()
export class PlaceBidUseCase {
  private readonly currency = Currency.WELFARE_POINT;

  constructor(
    @Inject(UNIT_OF_WORK) private readonly uow: UnitOfWork,
    private readonly events: EventEmitter2,
  ) {}

  async execute(input: PlaceBidInput): Promise<PlaceBidResult> {
    const auctionId = AuctionId.of(input.auctionId);
    const bidder = UserId.of(input.userId);
    const amount = Point.of(input.amount);

    const result = await this.uow.run(async (tx) => {
      await tx.lockAuction(auctionId);

      const auction = await tx.auctions.findById(auctionId);
      if (!auction) {
        // Throw a domain error rather than NotFoundException — the controller
        // converts both into appropriate HTTP statuses.
        throw new (class extends DomainError {})(`Auction ${input.auctionId} not found`);
      }

      // Domain validates status / time / amount and returns the previous leader.
      const previous = auction.placeBid(bidder, amount, new Date());

      // 1) Refund the previous leader if there was one.
      if (previous !== null) {
        const prevWallet =
          (await tx.wallets.find(previous.bidder, this.currency)) ??
          Wallet.openEmpty(previous.bidder, this.currency);
        prevWallet.credit(previous.amount);
        await tx.wallets.save(prevWallet);
        await tx.ledger.append(
          LedgerEntry.create({
            userId: previous.bidder,
            currency: this.currency,
            actionType: "REFUND",
            amount: previous.amount.toBigInt(),
            balanceAfter: prevWallet.balance,
            auctionId: auctionId.toString(),
            refNote: "Outbid — auto refund",
          }),
        );
      }

      // 2) Debit the new bidder. Throws InsufficientPointError if balance < amount.
      const myWallet =
        (await tx.wallets.find(bidder, this.currency)) ??
        Wallet.openEmpty(bidder, this.currency);
      myWallet.debit(amount);
      await tx.wallets.save(myWallet);
      await tx.ledger.append(
        LedgerEntry.create({
          userId: bidder,
          currency: this.currency,
          actionType: "BID",
          amount: -amount.toBigInt(),
          balanceAfter: myWallet.balance,
          auctionId: auctionId.toString(),
        }),
      );

      // 3) Persist updated auction + record the bid event.
      await tx.auctions.save(auction);
      await tx.recordBid({
        auctionId,
        userId: bidder.toBigInt(),
        amount: amount.toBigInt(),
      });

      return {
        auctionId: auctionId.toString(),
        newHighest: auction.highest.toBigInt(),
        newBidCount: auction.bidCount,
        refundedTo: previous?.bidder.toBigInt() ?? null,
        refundedAmount: previous?.amount.toBigInt() ?? null,
      };
    });

    // 커밋 성공 후 발행 (롤백 시 헛알림 방지). 구독자 = NotificationObserver 등.
    this.events.emit(
      AUCTION_EVENTS.BID_PLACED,
      new BidPlacedEvent(
        result.auctionId,
        bidder.toBigInt(),
        amount.toBigInt(),
        result.refundedTo,
        result.refundedAmount,
      ),
    );

    return result;
  }
}
