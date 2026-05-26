// ExportSettlement — 도입사 HR/급여 시스템으로 넘길 정산 데이터 핸드오프.
//
// 우리는 이식형 B2E 플랫폼이라 특정 HR 시스템에 직접 쓰지 않는다(ADR-021).
// 대신 낙찰 연차부여/배당 내역을 CSV·JSON으로 내보내고, 각 사가 자기 HR에 반영한다.
// leave_type=AUCTION 태그가 "비법정 연차 → 연차수당 제외" 신호 역할(ADR-002).

import { Injectable } from "@nestjs/common";
import { PrismaService } from "@/adapters/persistence/prisma.service";
import { GetAdminStatsUseCase } from "./get-admin-stats.use-case";

/** Date → "YYYY-MM-DD HH:mm" (서버 로컬=KST). ISO 대신 사람이 읽기 좋은 형식. */
function fmtDateTime(d: Date): string {
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}`;
}

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
  stakePct: number;
  dividendPoint: number;
};

export type SpendRow = {
  empId: string;
  name: string;
  spentPoint: number;
  wins: number;
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
          grantedAt: fmtDateTime(at),
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
        stakePct: Number((ratio * 100).toFixed(2)),
        dividendPoint: Math.floor(escrow * ratio),
      };
    });
  }

  /** 누가 얼마나 썼나 — 낙찰자가 escrow에 넣은 포인트(=실제 지출)를 사람별로 합산. */
  async spending(): Promise<SpendRow[]> {
    const auctions = await this.prisma.auction.findMany({
      where: { status: "AWARDED", highestBidder: { not: null } },
      select: { highestBidder: true, highest: true },
    });
    const agg = new Map<bigint, { spent: bigint; wins: number }>();
    for (const a of auctions) {
      const k = a.highestBidder!;
      const cur = agg.get(k) ?? { spent: 0n, wins: 0 };
      cur.spent += a.highest;
      cur.wins += 1;
      agg.set(k, cur);
    }
    if (agg.size === 0) return [];
    const users = await this.prisma.user.findMany({
      where: { id: { in: [...agg.keys()] } },
      select: { id: true, empId: true, name: true },
    });
    const byId = new Map(users.map((u) => [u.id, u]));
    return [...agg.entries()]
      .map(([id, v]) => ({
        empId: byId.get(id)?.empId ?? String(id),
        name: byId.get(id)?.name ?? "",
        spentPoint: Number(v.spent),
        wins: v.wins,
      }))
      .sort((a, b) => b.spentPoint - a.spentPoint);
  }
}
