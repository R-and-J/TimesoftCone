// ExportSettlement — 도입사 HR/급여 시스템으로 넘길 정산 데이터 핸드오프.
//
// 우리는 이식형 B2E 플랫폼이라 특정 HR 시스템에 직접 쓰지 않는다(ADR-021).
// 대신 낙찰 연차부여/배당 내역을 CSV·JSON으로 내보내고, 각 사가 자기 HR에 반영한다.
// leave_type=AUCTION 태그가 "비법정 연차 → 연차수당 제외" 신호 역할(ADR-002).

import { Injectable } from "@nestjs/common";
import { PrismaService } from "@/adapters/persistence/prisma.service";
import { GetAdminStatsUseCase } from "./get-admin-stats.use-case";

export type LeaveGrantRow = {
  empId: string;
  name: string;
  email: string | null;
  year: number;
  leaveType: "AUCTION";
  days: number;
  auctionId: string;
  amountPoint: number;
  grantedAt: string;
};

export type DividendRow = {
  empId: string;
  name: string;
  contributedDays: number;
  stakeRatio: number;
  dividendPoint: number;
};

@Injectable()
export class ExportSettlementUseCase {
  constructor(
    private readonly prisma: PrismaService,
    private readonly stats: GetAdminStatsUseCase,
  ) {}

  /** 낙찰로 부여된 AUCTION 연차 내역 (HR가 휴가 반영 + 연차수당 제외 판단용). */
  async leaveGrants(): Promise<LeaveGrantRow[]> {
    const auctions = await this.prisma.auction.findMany({
      where: { status: "AWARDED", highestBidder: { not: null } },
      orderBy: { settledAt: "asc" },
      include: { winner: { select: { empId: true, name: true, email: true } } },
    });
    return auctions
      .filter((a) => a.winner !== null)
      .map((a) => {
        const at = a.settledAt ?? a.endsAt;
        return {
          empId: a.winner!.empId,
          name: a.winner!.name,
          email: a.winner!.email,
          year: at.getFullYear(),
          leaveType: "AUCTION" as const,
          days: a.leaveDays,
          auctionId: a.id,
          amountPoint: Number(a.highest),
          grantedAt: at.toISOString(),
        };
      });
  }

  /** 연말 배당 내역 (재무가 복지카드 적립용). dividend = floor(escrow × stake). */
  async dividends(): Promise<DividendRow[]> {
    const [contributors, { escrowBalance }] = await Promise.all([
      this.prisma.user.findMany({
        where: { contributedDays: { gt: 0 } },
        orderBy: { contributedDays: "desc" },
        select: { empId: true, name: true, contributedDays: true },
      }),
      this.stats.execute(),
    ]);
    const totalDays = contributors.reduce((s, c) => s + c.contributedDays, 0);
    const escrow = Number(escrowBalance);
    return contributors.map((c) => {
      const ratio = totalDays > 0 ? c.contributedDays / totalDays : 0;
      return {
        empId: c.empId,
        name: c.name,
        contributedDays: c.contributedDays,
        stakeRatio: Number(ratio.toFixed(6)),
        dividendPoint: Math.floor(escrow * ratio),
      };
    });
  }
}
