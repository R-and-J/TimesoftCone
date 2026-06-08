// PrismaLeavePoolAdapter — LeavePoolPort 구현(ADR-017 + 2026-06-02 점진 발행).
// Leave 컨텍스트(leave_balance) 조회 + Stake/Supply/run·release 마커를 단일 트랜잭션으로.
// 도메인은 Prisma를 모름 — 매핑·ID 채번은 여기서.

import { Injectable } from "@nestjs/common";
import { PrismaService } from "./prisma.service";
import type {
  LeavePoolCommit,
  LeavePoolPort,
  ReleaseBatch,
  SupplyRow,
} from "@/ports/leave-pool.port";

@Injectable()
export class PrismaLeavePoolAdapter implements LeavePoolPort {
  constructor(private readonly prisma: PrismaService) {}

  async isCollected(targetYear: number, companyId: bigint): Promise<boolean> {
    const run = await this.prisma.leavePoolRun.findUnique({
      where: { uq_pool_company_target: { companyId, targetYear } },
    });
    return run !== null;
  }

  async activeCompanyIds(): Promise<bigint[]> {
    const rows = await this.prisma.company.findMany({
      where: { active: true },
      select: { id: true },
      orderBy: { id: "asc" },
    });
    return rows.map((r) => r.id);
  }

  async regularContributions(sourceYear: number, companyId: bigint) {
    // REGULAR만 풀 대상(ADR-002). remaining = granted + adjusted − used. 회사 스코프.
    const rows = await this.prisma.leaveBalance.findMany({
      where: { leaveType: "REGULAR", year: sourceYear, companyId },
      select: {
        userId: true,
        grantedDays: true,
        adjustedDays: true,
        usedDays: true,
        user: { select: { name: true } },
      },
    });
    return rows
      .map((r) => ({
        userId: r.userId,
        name: r.user.name,
        days: r.grantedDays + r.adjustedDays - r.usedDays,
      }))
      .filter((c) => c.days > 0);
  }

  async commit(c: LeavePoolCommit): Promise<void> {
    await this.prisma.$transaction(async (tx) => {
      // Stake — (userId, targetYear) 1행. 배당(ADR-008)이 이 행을 읽음.
      // user.contributedDays는 legacy 디스플레이 스냅샷.
      for (const s of c.stakes) {
        await tx.stake.upsert({
          where: { uq_stake_user_year: { userId: s.userId, year: c.targetYear } },
          update: { days: s.days },
          create: { userId: s.userId, year: c.targetYear, days: s.days, companyId: c.companyId },
        });
        await tx.user.update({
          where: { id: s.userId },
          data: { contributedDays: s.days },
        });
        // Supply — 점진 발행용 잔여. 처음엔 contributedDays = remainingDays.
        await tx.leavePoolSupply.upsert({
          where: {
            uq_supply_company_year_user: {
              companyId: c.companyId,
              targetYear: c.targetYear,
              userId: s.userId,
            },
          },
          update: { contributedDays: s.days, remainingDays: s.days },
          create: {
            companyId: c.companyId,
            targetYear: c.targetYear,
            userId: s.userId,
            contributedDays: s.days,
            remainingDays: s.days,
          },
        });
      }

      // 멱등 마커 — (companyId, targetYear) UNIQUE. 중복 commit은 여기서 실패(원자적 롤백).
      // 매물은 점진 발행이라 수집 시점엔 0개.
      await tx.leavePoolRun.create({
        data: {
          sourceYear: c.sourceYear,
          targetYear: c.targetYear,
          companyId: c.companyId,
          contributorCount: c.summary.contributorCount,
          daysCollected: c.summary.daysCollected,
          auctionsCreated: 0,
          status: "DONE",
        },
      });
    });
  }

  async findSupplies(targetYear: number, companyId: bigint): Promise<SupplyRow[]> {
    const rows = await this.prisma.leavePoolSupply.findMany({
      where: { targetYear, companyId, remainingDays: { gt: 0 } },
      select: { userId: true, remainingDays: true },
      orderBy: { userId: "asc" },
    });
    return rows.map((r) => ({ userId: r.userId, remainingDays: r.remainingDays }));
  }

  async isReleased(targetYear: number, companyId: bigint, periodIndex: string): Promise<boolean> {
    const run = await this.prisma.leavePoolReleaseRun.findUnique({
      where: {
        uq_release_company_year_period: { companyId, targetYear, periodIndex },
      },
    });
    return run !== null;
  }

  async releaseBatch(b: ReleaseBatch): Promise<{ auctionIds: string[] }> {
    return this.prisma.$transaction(async (tx) => {
      // 매물 ID 채번 — 기존 A-{targetYear}-NNN 중 최대 시퀀스 다음부터.
      const existing = await tx.auction.findMany({
        where: { id: { startsWith: `A-${b.targetYear}-` } },
        select: { id: true },
      });
      let nextSeq = existing.reduce((max, a) => {
        const n = Number(a.id.split("-")[2]);
        return Number.isFinite(n) && n > max ? n : max;
      }, 0);

      const auctionIds: string[] = [];
      const data: {
        id: string;
        status: string;
        startPrice: bigint;
        highest: bigint;
        minIncrement: bigint;
        leaveDays: number;
        startedAt: Date;
        endsAt: Date;
        companyId: bigint;
      }[] = [];
      for (const a of b.allocations) {
        // 매물 take개 — 1일권 1개씩(ADR-007). sourceUserId는 stake로 추적 가능하므로 컬럼 X.
        for (let i = 0; i < a.take; i++) {
          nextSeq += 1;
          const id = `A-${b.targetYear}-${String(nextSeq).padStart(3, "0")}`;
          auctionIds.push(id);
          data.push({
            id,
            status: "CREATED",
            startPrice: b.startPrice,
            highest: b.startPrice,
            minIncrement: b.minIncrement,
            leaveDays: 1,
            startedAt: b.startedAt,
            endsAt: b.endsAt,
            companyId: b.companyId,
          });
        }
      }
      if (data.length > 0) await tx.auction.createMany({ data });

      // supply 차감 — 기여자별.
      for (const a of b.allocations) {
        await tx.leavePoolSupply.update({
          where: {
            uq_supply_company_year_user: {
              companyId: b.companyId,
              targetYear: b.targetYear,
              userId: a.userId,
            },
          },
          data: { remainingDays: { decrement: a.take } },
        });
      }

      // run 마커 — 중복 회차는 여기서 UNIQUE 위반 → 원자적 롤백.
      await tx.leavePoolReleaseRun.create({
        data: {
          targetYear: b.targetYear,
          companyId: b.companyId,
          periodIndex: b.periodIndex,
          cadence: b.cadence,
          releasedQty: data.length,
        },
      });

      // 누적 발행 수 LeavePoolRun.auctionsCreated에 가산(누적 합계 표시용).
      await tx.leavePoolRun.update({
        where: { uq_pool_company_target: { companyId: b.companyId, targetYear: b.targetYear } },
        data: { auctionsCreated: { increment: data.length } },
      });

      return { auctionIds };
    });
  }
}
