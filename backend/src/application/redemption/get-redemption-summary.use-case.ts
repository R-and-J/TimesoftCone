// GetRedemptionSummary — 상태별 카운트 1쿼리. AdminRedemption KPI 상단 4칸.

import { Injectable } from "@nestjs/common";
import { PrismaService } from "@/adapters/persistence/prisma.service";

export type RedemptionSummary = {
  pending: number;
  approved: number;
  received: number;
  rejected: number;
};

@Injectable()
export class GetRedemptionSummaryUseCase {
  constructor(private readonly prisma: PrismaService) {}

  async execute(): Promise<RedemptionSummary> {
    const rows = await this.prisma.redemptionRequest.groupBy({
      by: ["status"],
      _count: { _all: true },
    });
    const out: RedemptionSummary = { pending: 0, approved: 0, received: 0, rejected: 0 };
    for (const r of rows) {
      const n = r._count._all;
      if (r.status === "PENDING") out.pending = n;
      else if (r.status === "APPROVED") out.approved = n;
      else if (r.status === "RECEIVED") out.received = n;
      else if (r.status === "REJECTED") out.rejected = n;
    }
    return out;
  }
}
