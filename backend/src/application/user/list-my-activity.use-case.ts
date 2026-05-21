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

    return {
      history: history.map((h) => ({
        occurredAt: h.occurredAt,
        actionType: h.actionType,
        auctionId: h.auctionId,
        amount: h.amount,
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
