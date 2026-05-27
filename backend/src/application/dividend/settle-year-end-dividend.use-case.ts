// SettleYearEndDividend — ADR-008 연말 일괄 배당 배치.
//
// 에스크로에 누적된 입찰 대금을, 연차를 공용 풀에 기여한 직원들에게 기여 지분
// (stake)만큼 배당한다. 회사 예산 0원 — 배당 재원은 전적으로 에스크로(=구매자
// 입찰금)다 (ADR-001).
//
// 계산 (business-rules.md §2.2, 전부 BigInt 정수 연산):
//   1. raw[u]   = escrow × contributedDays[u] / Σ contributedDays
//   2. floor[u] = floor(raw[u])
//   3. remainder = escrow − Σ floor[u]
//   4. 최종[u]  = floor[u] + (u가 stake 1위면 remainder, 아니면 0)
//      stake 1위 = 최다 기여, 동률 시 userId 오름차순 (edge-cases EC-7)
//   ⇒ Σ 최종 = escrow (NFR-2 "총 배당 = 에스크로 총액" 정확히 성립)
//
// 멱등성: 이미 DIVIDEND 원장이 있으면(이미 정산됨) 재실행 거부 — 이중 지급 방지.
// 지급은 PayoutChannel(단일 트랜잭션)에 위임.

import { Inject, Injectable, ConflictException } from "@nestjs/common";
import { PrismaService } from "@/adapters/persistence/prisma.service";
import { GetAdminStatsUseCase } from "@/application/admin/get-admin-stats.use-case";
import { PAYOUT_CHANNEL, type PayoutChannel } from "@/ports/payout-channel";
import { UserId } from "@/domain/shared/value-objects/user-id";
import { Point } from "@/domain/shared/value-objects/point";

export type DividendLine = {
  userId: bigint;
  name: string;
  contributedDays: number;
  stakeRatio: number;
  amount: bigint;
  isTopStake: boolean;
};

export type SettleDividendResult = {
  year: number;
  dryRun: boolean;
  alreadySettled: boolean;
  escrowBalance: bigint;
  totalContributors: number;
  totalDistributed: bigint;
  remainder: bigint;
  /** 0보다 큰 배당만 (지급 대상). */
  lines: DividendLine[];
};

@Injectable()
export class SettleYearEndDividendUseCase {
  constructor(
    private readonly prisma: PrismaService,
    private readonly stats: GetAdminStatsUseCase,
    @Inject(PAYOUT_CHANNEL) private readonly payoutChannel: PayoutChannel,
  ) {}

  async execute(opts?: { year?: number; dryRun?: boolean }): Promise<SettleDividendResult> {
    const year = opts?.year ?? new Date().getFullYear();
    const dryRun = opts?.dryRun ?? false;

    const [{ escrowBalance }, contributors, dividendCount] = await Promise.all([
      this.stats.execute(),
      // stake 1위 결정 순서: 기여일 내림차순, 동률 시 userId 오름차순.
      this.prisma.user.findMany({
        where: { contributedDays: { gt: 0 } },
        orderBy: [{ contributedDays: "desc" }, { id: "asc" }],
        select: { id: true, name: true, contributedDays: true },
      }),
      this.prisma.ledgerEntry.count({ where: { actionType: "DIVIDEND" } }),
    ]);

    const alreadySettled = dividendCount > 0;
    // 멱등성: 실제 지급은 한 번만. (단일 연도 스코프 — 연도별 분리는 후속.)
    if (alreadySettled && !dryRun) {
      throw new ConflictException("이미 배당이 정산되었습니다 (DIVIDEND 원장 존재)");
    }

    const totalDays = contributors.reduce((s, c) => s + c.contributedDays, 0);

    // 배당 재원/기여자가 없으면 지급할 것이 없음.
    if (totalDays === 0 || escrowBalance <= 0n) {
      return {
        year, dryRun, alreadySettled,
        escrowBalance,
        totalContributors: contributors.length,
        totalDistributed: 0n,
        remainder: escrowBalance > 0n ? escrowBalance : 0n,
        lines: [],
      };
    }

    const totalDaysBig = BigInt(totalDays);
    // floor[u] = escrow × days / totalDays  (양수 정수 나눗셈 = floor)
    const floors = contributors.map((c) => (escrowBalance * BigInt(c.contributedDays)) / totalDaysBig);
    const sumFloor = floors.reduce((s, v) => s + v, 0n);
    const remainder = escrowBalance - sumFloor; // ≥ 0, < 기여자 수

    const lines: DividendLine[] = contributors.map((c, i) => {
      // 나머지는 stake 1위(정렬상 index 0)에게. (Σ = escrow 보장)
      const amount = floors[i] + (i === 0 ? remainder : 0n);
      return {
        userId: c.id,
        name: c.name,
        contributedDays: c.contributedDays,
        stakeRatio: c.contributedDays / totalDays,
        amount,
        isTopStake: i === 0,
      };
    });

    // 0원 배당은 지급/원장 노이즈라 제외(지분은 totalDays에 이미 반영됨).
    const payable = lines.filter((l) => l.amount > 0n);

    if (!dryRun) {
      await this.payoutChannel.payout(
        payable.map((l) => ({
          userId: UserId.of(l.userId),
          amount: Point.of(l.amount),
          refNote: `${year}년 연말 배당 (지분 ${(l.stakeRatio * 100).toFixed(1)}%)`,
        })),
      );
    }

    const totalDistributed = lines.reduce((s, l) => s + l.amount, 0n);
    // 사후 불변식: Σ배당 == escrow (NFR-2). 어긋나면 계산 버그이므로 강제 실패.
    if (totalDistributed !== escrowBalance) {
      throw new Error(
        `배당 합(${totalDistributed})이 에스크로(${escrowBalance})와 불일치 — NFR-2 위반`,
      );
    }

    return {
      year, dryRun, alreadySettled,
      escrowBalance,
      totalContributors: contributors.length,
      totalDistributed,
      remainder,
      lines: payable,
    };
  }
}
