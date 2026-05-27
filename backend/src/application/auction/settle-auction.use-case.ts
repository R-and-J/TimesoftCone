// SettleAuction — close an OPEN auction once endsAt has passed.
//
// Outcomes:
//   - AWARDED: the highest bidder wins. Their wallet was already debited at
//     bid time, so settlement just appends a WIN ledger entry (amount 0,
//     note "낙찰 확정") and stamps the auction.
//   - UNSOLD:  no bids were placed. Just stamp the auction.
//
// Note: per ADR-018 + ADR-001 the "WIN" entry carries amount=0 because the
// money already moved at bid time. The entry exists for audit traceability,
// not balance change.

import { Inject, Injectable, NotFoundException } from "@nestjs/common";
import { EventEmitter2 } from "@nestjs/event-emitter";
import { UNIT_OF_WORK, type UnitOfWork } from "@/ports/unit-of-work";
import { AuctionId } from "@/domain/shared/value-objects/auction-id";
import { Currency } from "@/domain/shared/value-objects/currency";
import { LedgerEntry } from "@/domain/ledger/ledger-entry";
import { AUCTION_EVENTS, AuctionWonEvent } from "@/application/events/auction-events";

export type SettleAuctionResult = {
  auctionId: string;
  outcome: "AWARDED" | "UNSOLD";
  winnerId?: bigint;
  amount?: bigint;
  leaveDays?: number;
};

@Injectable()
export class SettleAuctionUseCase {
  private readonly currency = Currency.WELFARE_POINT;

  constructor(
    @Inject(UNIT_OF_WORK) private readonly uow: UnitOfWork,
    private readonly events: EventEmitter2,
  ) {}

  async execute(idRaw: string): Promise<SettleAuctionResult> {
    const auctionId = AuctionId.of(idRaw);

    const result = await this.uow.run(async (tx) => {
      await tx.lockAuction(auctionId);

      const auction = await tx.auctions.findById(auctionId);
      if (!auction) {
        throw new NotFoundException(`Auction ${idRaw} not found`);
      }

      const outcome = auction.settle(new Date());

      if (outcome.kind === "AWARDED") {
        // Money already moved at bid time. Just stamp an audit row.
        const winnerWallet = await tx.wallets.find(outcome.winner, this.currency);
        const balance = winnerWallet?.balance ?? auction.highest; // fallback shouldn't happen
        await tx.ledger.append(
          LedgerEntry.create({
            userId: outcome.winner,
            currency: this.currency,
            actionType: "WIN",
            amount: 0n,
            balanceAfter: balance,
            auctionId: auctionId.toString(),
            refNote: "낙찰 확정",
          }),
        );
        // 낙찰자에게 AUCTION 연차 적립 (ADR-002/020/CUT-9) — 같은 트랜잭션.
        await tx.grantAuctionLeave({
          userId: outcome.winner.toBigInt(),
          year: new Date().getFullYear(),
          days: auction.leaveDays,
        });
      }

      await tx.auctions.save(auction);

      return outcome.kind === "AWARDED"
        ? {
            auctionId: auctionId.toString(),
            outcome: "AWARDED" as const,
            winnerId: outcome.winner.toBigInt(),
            amount: outcome.amount.toBigInt(),
            leaveDays: auction.leaveDays,
          }
        : { auctionId: auctionId.toString(), outcome: "UNSOLD" as const };
    });

    // 커밋 후 낙찰 이벤트 발행 (수동/스케줄러 정산 모두 이 경로). 구독자가 알림 적재.
    if (result.outcome === "AWARDED" && result.winnerId != null) {
      this.events.emit(
        AUCTION_EVENTS.WON,
        new AuctionWonEvent(
          result.auctionId,
          result.winnerId,
          result.amount ?? 0n,
          result.leaveDays ?? 0,
        ),
      );
    }

    return result;
  }
}
