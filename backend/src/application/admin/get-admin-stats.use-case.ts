// GetAdminStats — feeds the AdminOps KPI strip.
//
// Computes the escrow balance from the ledger (NFR-2 equation):
//   Σ(BID + WIN) − Σ(REFUND + DIVIDEND) = escrow balance
// CREDIT_ADMIN is excluded — it's wallet credit funded outside the auction
// cycle (admin manually deposits points) and doesn't affect escrow.

import { Injectable } from "@nestjs/common";
import { PrismaService } from "@/adapters/persistence/prisma.service";

export type AdminStats = {
  escrowBalance: bigint;
  openAuctions: number;
  upcomingAuctions: number;
  unsoldAuctions: number;
  awardedToday: number;
  dlqDepth: number; // Outbox DEAD 행 수 (ADR-005 relay 사후, CUT-4·7 부활)
  /** 교환 신청 대기 건수 — 관리자 처리 대기 (ADR-023 v2). */
  redemptionPending: number;
  /** 승인됐는데 사용자가 아직 수령 컨펌 안 한 건수. */
  redemptionAwaitingReceipt: number;
};

@Injectable()
export class GetAdminStatsUseCase {
  constructor(private readonly prisma: PrismaService) {}

  /** companyId가 있으면 그 회사로 스코프(에스크로·집계 per company). null=전 회사(super). */
  async execute(companyId?: bigint | null): Promise<AdminStats> {
    const co = companyId != null ? { companyId } : {};
    const [
      bidWinSum,
      refundDividendSum,
      statusCounts,
      awardedToday,
      dlqDepth,
      redemptionPending,
      redemptionAwaitingReceipt,
    ] = await Promise.all([
      // Σ(BID + WIN): BID amounts are negative, so use |amount|. WIN is 0.
      // Equivalent: sum of all BID amount absolutes.
      this.prisma.ledgerEntry.aggregate({
        _sum: { amount: true },
        where: { actionType: "BID", ...co },
      }),
      this.prisma.ledgerEntry.aggregate({
        _sum: { amount: true },
        where: { actionType: { in: ["REFUND", "DIVIDEND"] }, ...co },
      }),
      this.prisma.auction.groupBy({
        by: ["status"],
        _count: { _all: true },
        where: companyId != null ? { companyId } : undefined,
      }),
      this.prisma.auction.count({
        where: {
          status: "AWARDED",
          settledAt: { gte: startOfToday() },
          ...co,
        },
      }),
      this.prisma.outboxMessage.count({ where: { status: "DEAD", ...co } }),
      this.prisma.redemptionRequest.count({ where: { status: "PENDING", ...co } }),
      this.prisma.redemptionRequest.count({ where: { status: "APPROVED", ...co } }),
    ]);

    const bidSum = bidWinSum._sum.amount ?? 0n; // negative
    const refundSum = refundDividendSum._sum.amount ?? 0n; // positive
    // escrow = sum of money that came in (|BID|) minus money that flowed back
    //          out (REFUND + DIVIDEND). |BID| = -bidSum because BID amount
    //          is stored as negative.
    const escrowBalance = -bidSum - refundSum;

    const byStatus = new Map(statusCounts.map((r) => [r.status, r._count._all]));

    return {
      escrowBalance,
      openAuctions: byStatus.get("OPEN") ?? 0,
      upcomingAuctions: byStatus.get("CREATED") ?? 0,
      unsoldAuctions: byStatus.get("UNSOLD") ?? 0,
      awardedToday,
      dlqDepth,
      redemptionPending,
      redemptionAwaitingReceipt,
    };
  }
}

function startOfToday(): Date {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
}
