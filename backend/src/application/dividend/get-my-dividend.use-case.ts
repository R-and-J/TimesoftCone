// GetMyDividend — feeds the Dividend ★ screen.
//
// School-project simplification:
//   stake[u]   = u.contributedDays / Σ contributedDays
//   dividend[u] = floor(escrowBalance × stake[u])
//
// Both ADR-008 (year-end dividend) and ADR-017 (LeavePool bounded context)
// describe a much richer model. For this scope we just read what's in users
// + ledger. Top-K stake distribution is derived for the donut chart.

import { Injectable, NotFoundException } from "@nestjs/common";
import { PrismaService } from "@/adapters/persistence/prisma.service";
import { GetAdminStatsUseCase } from "@/application/admin/get-admin-stats.use-case";
import { UserId } from "@/domain/shared/value-objects/user-id";

export type StakeEntry = {
  userId: bigint;
  name: string;
  days: number;
  ratio: number;
  isMe: boolean;
};

export type MyDividendResult = {
  userId: bigint;
  name: string;
  contributedDays: number;
  stakeRatio: number;        // 0.087 means 8.7%
  rank: number | null;        // 1-based; null if user has 0 contribution
  totalContributors: number;
  escrowBalance: bigint;
  myDividend: bigint;
  topStakes: StakeEntry[];
};

@Injectable()
export class GetMyDividendUseCase {
  constructor(
    private readonly prisma: PrismaService,
    private readonly stats: GetAdminStatsUseCase,
  ) {}

  async execute(
    userIdRaw: string | bigint | number,
    year?: number,
  ): Promise<MyDividendResult> {
    const myId = UserId.of(userIdRaw).toBigInt();
    const targetYear = year ?? new Date().getFullYear();

    const [me, stakeRows, { escrowBalance }] = await Promise.all([
      this.prisma.user.findUnique({ where: { id: myId } }),
      // 연도별 stake 행을 읽는다(ADR-017). user.contributedDays는 더 이상 권위 아님.
      this.prisma.stake.findMany({
        where: { year: targetYear, days: { gt: 0 } },
        orderBy: { days: "desc" },
        include: { user: { select: { name: true } } },
      }),
      this.stats.execute(),
    ]);

    if (!me) throw new NotFoundException(`User ${userIdRaw} not found`);

    const contributors = stakeRows.map((s) => ({
      id: s.userId,
      name: s.user.name,
      contributedDays: s.days,
    }));
    const myStakeDays = contributors.find((c) => c.id === myId)?.contributedDays ?? 0;

    const totalDays = contributors.reduce((sum, c) => sum + c.contributedDays, 0);
    const stakeRatio = totalDays > 0 ? myStakeDays / totalDays : 0;
    const myDividend =
      totalDays > 0
        ? BigInt(Math.floor(Number(escrowBalance) * stakeRatio))
        : 0n;

    const rankIdx = contributors.findIndex((c) => c.id === myId);
    const rank = rankIdx === -1 ? null : rankIdx + 1;

    const topStakes: StakeEntry[] = contributors.slice(0, 9).map((c) => ({
      userId: c.id,
      name: c.name,
      days: c.contributedDays,
      ratio: totalDays > 0 ? c.contributedDays / totalDays : 0,
      isMe: c.id === myId,
    }));

    // If "me" isn't in top-9, append so the UI can highlight it.
    if (rank !== null && rank > 9 && !topStakes.some((s) => s.isMe)) {
      topStakes.push({
        userId: me.id,
        name: me.name,
        days: myStakeDays,
        ratio: stakeRatio,
        isMe: true,
      });
    }

    return {
      userId: me.id,
      name: me.name,
      contributedDays: myStakeDays,
      stakeRatio,
      rank,
      totalContributors: contributors.length,
      escrowBalance,
      myDividend,
      topStakes,
    };
  }
}
