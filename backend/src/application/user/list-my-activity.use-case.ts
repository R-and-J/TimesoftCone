// ListMyActivity — feeds the "내 활동" screen.
// Pure read projection from ledger_entry, no domain mutation, so it doesn't
// go through the BiddingCurrency port — it reads ledger rows directly.

import { Injectable } from "@nestjs/common";
import { PrismaService } from "@/adapters/persistence/prisma.service";
import { UserId } from "@/domain/shared/value-objects/user-id";

export type ActivityRow = {
  occurredAt: Date;
  actionType: string;
  auctionId: string | null;
  amount: bigint;
  /** WIN 행 전용 — 매물의 최종 낙찰가(=highest). 실제 차감은 BID 시점이라 amount는 0이지만
   *  사용자에게는 낙찰가가 보여야 자연스럽다. WIN 외에는 null. */
  winningAmount: bigint | null;
  balanceAfter: bigint;
  refNote: string | null;
};

export type ActivitySummary = {
  totalBids: number;
  totalWins: number;
  totalRefunds: number;
  activeAuctions: number;
};

@Injectable()
export class ListMyActivityUseCase {
  constructor(private readonly prisma: PrismaService) {}

  async execute(userIdRaw: string | bigint | number, limit = 50): Promise<{
    history: ActivityRow[];
    summary: ActivitySummary;
  }> {
    const userId = UserId.of(userIdRaw).toBigInt();

    const [history, bidCount, winCount, refundCount, activeAuctions] =
      await Promise.all([
        this.prisma.ledgerEntry.findMany({
          where: { userId },
          orderBy: { occurredAt: "desc" },
          take: limit,
        }),
        this.prisma.ledgerEntry.count({ where: { userId, actionType: "BID" } }),
        this.prisma.ledgerEntry.count({ where: { userId, actionType: "WIN" } }),
        this.prisma.ledgerEntry.count({ where: { userId, actionType: "REFUND" } }),
        // Auctions where I am the current highest bidder AND status is OPEN.
        this.prisma.auction.count({
          where: { status: "OPEN", highestBidder: userId },
        }),
      ]);

    // WIN 행에 매물의 낙찰가(highest)를 부가 — n+1 회피용 일괄 조회.
    const winAuctionIds = Array.from(
      new Set(
        history
          .filter((h) => h.actionType === "WIN" && h.auctionId)
          .map((h) => h.auctionId as string),
      ),
    );
    const auctions = winAuctionIds.length > 0
      ? await this.prisma.auction.findMany({
          where: { id: { in: winAuctionIds } },
          select: { id: true, highest: true },
        })
      : [];
    const highestMap = new Map(auctions.map((a) => [a.id, a.highest]));

    return {
      history: history.map((h) => ({
        occurredAt: h.occurredAt,
        actionType: h.actionType,
        auctionId: h.auctionId,
        amount: h.amount,
        winningAmount:
          h.actionType === "WIN" && h.auctionId
            ? highestMap.get(h.auctionId) ?? null
            : null,
        balanceAfter: h.balanceAfter,
        refNote: h.refNote,
      })),
      summary: {
        totalBids: bidCount,
        totalWins: winCount,
        totalRefunds: refundCount,
        activeAuctions,
      },
    };
  }
}
