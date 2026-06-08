// CollectLeavePool — 연말 풀 수집 배치 (ADR-017, 2026-06-02 점진 발행 결정).
//
// sourceYear의 REGULAR 미사용 연차를 취합(OP-2 전량 1:1)해서:
//   1. 기여자별 Stake(contributedDays) 기록 → 연말 배당(ADR-008)이 소비.
//   2. 기여자별 Supply(remainingDays) 기록 → ReleaseInventoryUseCase가 정책 주기마다 소비.
//   3. leave_pool_run 마커 기록 → 멱등성(동일 targetYear 재실행 시 409).
// 매물 자체는 만들지 않는다 — ReleaseInventoryScheduler가 ReleasePolicy 주기마다
// supply에서 N개씩 차감해 1일권 매물을 생성한다.
//
// dryRun=true면 계산만 하고 커밋하지 않는다(미리보기).
//
// 제약(ADR-017): REGULAR만 풀 대상 — AUCTION/EVENT는 절대 재투입 금지(무한순환 방지).

import { ConflictException, Inject, Injectable } from "@nestjs/common";
import { LEAVE_POOL, type LeavePoolPort } from "@/ports/leave-pool.port";
import { planLeavePool } from "@/domain/leave-pool/leave-pool-plan";

export type CollectLeavePoolInput = {
  sourceYear?: number;
  dryRun?: boolean;
  /** 멀티테넌시: 수집 대상 회사. 생략(super "전체") 시 EZPASS(1). */
  companyId?: bigint | null;
};

export type CollectLeavePoolResult = {
  sourceYear: number;
  targetYear: number;
  dryRun: boolean;
  alreadyCollected: boolean;
  contributorCount: number;
  daysCollected: number;
  /** 미리보기용 상위 기여자(최대 10명, 기여일 내림차순). */
  topContributors: { userId: string; name: string; days: number }[];
};

@Injectable()
export class CollectLeavePoolUseCase {
  constructor(@Inject(LEAVE_POOL) private readonly pool: LeavePoolPort) {}

  /** 멀티테넌시: 모든 활성 회사에 대해 수집(스케줄러용). 회사별 결과 배열 반환. */
  async executeAll(input?: Omit<CollectLeavePoolInput, "companyId">): Promise<CollectLeavePoolResult[]> {
    const companyIds = await this.pool.activeCompanyIds();
    const results: CollectLeavePoolResult[] = [];
    for (const companyId of companyIds) {
      try {
        results.push(await this.execute({ ...input, companyId }));
      } catch (err) {
        if (err instanceof ConflictException) continue;
        throw err;
      }
    }
    return results;
  }

  async execute(input?: CollectLeavePoolInput): Promise<CollectLeavePoolResult> {
    const sourceYear = input?.sourceYear ?? new Date().getFullYear();
    const targetYear = sourceYear + 1;
    const dryRun = input?.dryRun ?? false;
    // super "전체"(null)면 EZPASS(1) 기본 — 회사를 특정해 수집.
    const companyId = input?.companyId ?? 1n;

    const alreadyCollected = await this.pool.isCollected(targetYear, companyId);
    if (alreadyCollected && !dryRun) {
      throw new ConflictException(
        `${targetYear}년 풀이 이미 수집되었습니다 (leave_pool_run 존재)`,
      );
    }

    const contributions = await this.pool.regularContributions(sourceYear, companyId);
    const plan = planLeavePool(contributions);

    const top = [...contributions]
      .filter((c) => c.days > 0)
      .sort((a, b) => b.days - a.days)
      .slice(0, 10)
      .map((c) => ({ userId: c.userId.toString(), name: c.name, days: c.days }));

    const base: CollectLeavePoolResult = {
      sourceYear,
      targetYear,
      dryRun,
      alreadyCollected,
      contributorCount: plan.summary.contributorCount,
      daysCollected: plan.summary.daysCollected,
      topContributors: top,
    };

    if (dryRun || plan.stakes.length === 0) return base;

    await this.pool.commit({
      sourceYear,
      targetYear,
      companyId,
      stakes: plan.stakes,
      summary: plan.summary,
    });

    return base;
  }
}
