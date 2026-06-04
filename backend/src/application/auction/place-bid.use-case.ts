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
//        - debit their wallet (-amount)         ← may throw InsufficientConeError
//        - append a BID ledger entry
//   6. Save the updated auction
//   7. Append a BidEvent (audit log of accepted bids — feeds the detail screen)
//
// If any step throws, the entire transaction rolls back — wallets and ledger
// stay consistent (CLAUDE.md hard invariant #6).

import { Inject, Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { EventEmitter2 } from "@nestjs/event-emitter";
import { UNIT_OF_WORK, type UnitOfWork } from "@/ports/unit-of-work";
import { AUCTION_EVENTS, BidPlacedEvent } from "@/application/events/auction-events";
import { AuctionId } from "@/domain/shared/value-objects/auction-id";
import { UserId } from "@/domain/shared/value-objects/user-id";
import { Cone } from "@/domain/shared/value-objects/cone";
import { Currency } from "@/domain/shared/value-objects/currency";
import { Wallet } from "@/domain/wallet/wallet";
import { LedgerEntry } from "@/domain/ledger/ledger-entry";
import { DomainError } from "@/domain/shared/errors";

export type PlaceBidInput = {
  auctionId: string;
  userId: bigint | number | string;
  amount: bigint | number | string;
  /** 멀티테넌시: 입찰자 회사. 경매 회사와 다르면 거부(타사 경매 입찰 차단).
   *  super ADMIN(null)은 검증 면제. */
  bidderCompanyId?: bigint | null;
};

export type PlaceBidResult = {
  auctionId: string;
  newHighest: bigint;
  newBidCount: number;
  refundedTo: bigint | null;
  refundedAmount: bigint | null;
  /** anti-snipe(CUT-5)로 마감이 연장됐으면 true. */
  extended: boolean;
  /** (연장 여부와 무관하게) 현재 마감 시각. */
  endsAt: Date;
};

// anti-snipe 정책 파라미터 (운영 knob — business-rules.md). 기본 5분/5분.
const DEFAULT_WINDOW_MS = 5 * 60_000;
const DEFAULT_EXTEND_MS = 5 * 60_000;

@Injectable()
export class PlaceBidUseCase {
  private readonly currency = Currency.WELFARE_POINT;
  private readonly snipeWindowMs: number;
  private readonly snipeExtendMs: number;

  constructor(
    @Inject(UNIT_OF_WORK) private readonly uow: UnitOfWork,
    private readonly events: EventEmitter2,
    private readonly config: ConfigService,
  ) {
    // ANTISNIPE_WINDOW_MS=0 이면 기능 비활성 (마감 도달 시 즉시 종료).
    const w = Number(this.config.get<string>("ANTISNIPE_WINDOW_MS"));
    const e = Number(this.config.get<string>("ANTISNIPE_EXTEND_MS"));
    this.snipeWindowMs = Number.isFinite(w) && w >= 0 ? w : DEFAULT_WINDOW_MS;
    this.snipeExtendMs = Number.isFinite(e) && e > 0 ? e : DEFAULT_EXTEND_MS;
  }

  async execute(input: PlaceBidInput): Promise<PlaceBidResult> {
    const auctionId = AuctionId.of(input.auctionId);
    const bidder = UserId.of(input.userId);
    const amount = Cone.of(input.amount);

    const result = await this.uow.run(async (tx) => {
      await tx.lockAuction(auctionId);

      const auction = await tx.auctions.findById(auctionId);
      if (!auction) {
        // Throw a domain error rather than NotFoundException — the controller
        // converts both into appropriate HTTP statuses.
        throw new (class extends DomainError {})(`Auction ${input.auctionId} not found`);
      }

      // 멀티테넌시: 타사 경매 입찰 차단(에스크로 회사 경계 보호). super(null)는 면제.
      if (input.bidderCompanyId != null) {
        const auctionCompany = await tx.auctionCompanyId(auctionId);
        if (auctionCompany != null && auctionCompany !== input.bidderCompanyId) {
          throw new (class extends DomainError {})("다른 회사의 경매에는 입찰할 수 없습니다");
        }
      }

      // 입찰 검증과 anti-snipe 판정에 동일한 시각을 써야 일관적.
      const now = new Date();
      // Domain validates status / time / amount and returns the previous leader.
      const previous = auction.placeBid(bidder, amount, now);
      // 입찰 수락 후 마감 임박이면 연장 (CUT-5). 도메인이 OPEN/창 판단.
      const extended = auction.extendIfSniped(now, this.snipeWindowMs, this.snipeExtendMs);

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

      // 2) Debit the new bidder. Throws InsufficientConeError if balance < amount.
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
        extended,
        endsAt: auction.endsAt,
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
