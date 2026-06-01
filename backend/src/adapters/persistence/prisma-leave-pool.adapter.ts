// PrismaLeavePoolAdapter — LeavePoolPort 구현(ADR-017).
// Leave 컨텍스트(leave_balance) 조회 + 매물/Stake/run 마커를 단일 트랜잭션으로 커밋.
// 도메인은 Prisma를 모름 — 매핑·ID 채번은 여기서.

import { Injectable } from "@nestjs/common";
import { PrismaService } from "./prisma.service";
import type { LeavePoolCommit, LeavePoolPort } from "@/ports/leave-pool.port";
import type { PoolContribution } from "@/domain/leave-pool/leave-pool-plan";

@Injectable()
export class PrismaLeavePoolAdapter implements LeavePoolPort {
  constructor(private readonly prisma: PrismaService) {}

  async isCollected(targetYear: number): Promise<boolean> {
    const run = await this.prisma.leavePoolRun.findUnique({ where: { targetYear } });
    return run !== null;
  }

  async regularContributions(sourceYear: number): Promise<PoolContribution[]> {
    // REGULAR만 풀 대상(ADR-002). remaining = granted + adjusted − used.
    const rows = await this.prisma.leaveBalance.findMany({
      where: { leaveType: "REGULAR", year: sourceYear },
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

  async commit(c: LeavePoolCommit): Promise<{ auctionIds: string[] }> {
    return this.prisma.$transaction(async (tx) => {
      // 익년도 경매 ID 채번 — 기존 A-{targetYear}-NNN 중 최대 시퀀스 다음부터.
      const existing = await tx.auction.findMany({
        where: { id: { startsWith: `A-${c.targetYear}-` } },
        select: { id: true },
      });
      let nextSeq = existing.reduce((max, a) => {
        const n = Number(a.id.split("-")[2]);
        return Number.isFinite(n) && n > max ? n : max;
      }, 0);

      const initialStatus = c.asDraft ? "DRAFT" : "CREATED";
      const auctionIds: string[] = [];
      const data = c.items.map((it) => {
        nextSeq += 1;
        const id = `A-${c.targetYear}-${String(nextSeq).padStart(3, "0")}`;
        auctionIds.push(id);
        return {
          id,
          status: initialStatus,
          startPrice: it.startPrice,
          highest: it.startPrice,
          minIncrement: it.minIncrement,
          leaveDays: it.leaveDays,
          startedAt: it.startedAt,
          endsAt: it.endsAt,
        };
      });
      if (data.length > 0) await tx.auction.createMany({ data });

      // Stake 기록 — (userId, targetYear)별로 1행 업서트. 배당(ADR-008)이 이 행을 읽음.
      // user.contributedDays는 legacy 디스플레이 스냅샷으로 sync 유지(전체 코드베이스 정리는 별건).
      for (const s of c.stakes) {
        await tx.stake.upsert({
          where: { uq_stake_user_year: { userId: s.userId, year: c.targetYear } },
          update: { days: s.days },
          create: { userId: s.userId, year: c.targetYear, days: s.days },
        });
        await tx.user.update({
          where: { id: s.userId },
          data: { contributedDays: s.days },
        });
      }

      // 멱등 마커 — targetYear UNIQUE라 중복 commit은 여기서 실패(원자적 롤백).
      await tx.leavePoolRun.create({
        data: {
          sourceYear: c.sourceYear,
          targetYear: c.targetYear,
          contributorCount: c.summary.contributorCount,
          daysCollected: c.summary.daysCollected,
          auctionsCreated: c.summary.auctionsCreated,
          status: "DONE",
        },
      });

      return { auctionIds };
    });
  }
}
