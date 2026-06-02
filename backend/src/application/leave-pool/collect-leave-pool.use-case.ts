// CollectLeavePool — 연말 풀 수집 배치 (ADR-017).
//
// sourceYear의 REGULAR 미사용 연차를 취합해(OP-2 전량 1:1):
//   1. 기여자별 Stake(contributedDays) 기록 → 연말 배당(ADR-008)이 소비.
//   2. 익년도(sourceYear+1) 1일권 경매 매물 생성 → Auction 컨텍스트로.
//   3. leave_pool_run 마커 기록 → 멱등성(동일 targetYear 재실행 시 409).
// 매물 생성 + Stake 기록 + 마커는 어댑터에서 단일 트랜잭션(둘 중 하나만 성공 금지).
//
// dryRun=true면 계산만 하고 커밋하지 않는다(미리보기). 정책 변수(시작가/주당 개수
// 등)는 운영 knob(LEAVEPOOL_*)으로, 코드 기본값 보유.
//
// 제약(ADR-017): REGULAR만 풀 대상 — AUCTION/EVENT는 절대 재투입 금지(무한순환 방지).
// leave_balance에서 기여분을 차감하는 워크플로(기안/승인)는 기존 스코프 아웃(ADR-016).

import { ConflictException, Inject, Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { EventEmitter2 } from "@nestjs/event-emitter";
import { LEAVE_POOL, type LeavePoolPort } from "@/ports/leave-pool.port";
import { RELEASE_POLICY, type ReleasePolicyRepository } from "@/ports/release-policy.port";
import { planLeavePool } from "@/domain/leave-pool/leave-pool-plan";
import { planRelease } from "@/domain/leave-pool/release-plan";
import {
  AUCTION_EVENTS,
  AuctionInventoryCreatedEvent,
} from "@/application/events/auction-events";

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
  auctionsCreated: number;
  startPrice: string;
  /** 미리보기용 상위 기여자(최대 10명, 기여일 내림차순). */
  topContributors: { userId: string; name: string; days: number }[];
};

const DEFAULTS = { startPrice: 5000n, minIncrement: 100n, auctionDays: 7, weeklyQty: 0 };

@Injectable()
export class CollectLeavePoolUseCase {
  constructor(
    @Inject(LEAVE_POOL) private readonly pool: LeavePoolPort,
    @Inject(RELEASE_POLICY) private readonly policyRepo: ReleasePolicyRepository,
    private readonly config: ConfigService,
    private readonly events: EventEmitter2,
  ) {}

  /** 멀티테넌시: 모든 활성 회사에 대해 수집(스케줄러용). 회사별 결과 배열 반환. */
  async executeAll(input?: Omit<CollectLeavePoolInput, "companyId">): Promise<CollectLeavePoolResult[]> {
    const companyIds = await this.pool.activeCompanyIds();
    const results: CollectLeavePoolResult[] = [];
    for (const companyId of companyIds) {
      try {
        results.push(await this.execute({ ...input, companyId }));
      } catch (err) {
        // 이미 수집된 회사는 건너뛰고 나머지 계속(멱등). 그 외 오류는 전파.
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
    // 멱등성: 실제 수집은 targetYear당 1회. (미리보기는 항상 허용.)
    if (alreadyCollected && !dryRun) {
      throw new ConflictException(
        `${targetYear}년 풀이 이미 수집되었습니다 (leave_pool_run 존재)`,
      );
    }

    const contributions = await this.pool.regularContributions(sourceYear, companyId);
    const opts = this.options(targetYear);

    // 분산 정책 — 행이 없으면 폴백(none = 즉시 baseDate).
    const policy = (await this.policyRepo.get()) ?? { cadence: "none" as const };
    const totalDays = contributions.filter((c) => c.days > 0).reduce((s, c) => s + c.days, 0);
    const baseDate = computeBaseDate(targetYear);
    let startedAtSlots: Date[] = [];
    if (totalDays > 0) {
      startedAtSlots =
        policy.cadence === "none"
          ? Array.from({ length: totalDays }, () => new Date(baseDate.getTime()))
          : planRelease(policy, totalDays, baseDate);
    }
    const plan = planLeavePool(contributions, { ...opts, startedAtSlots });

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
      auctionsCreated: plan.summary.auctionsCreated,
      startPrice: opts.startPrice.toString(),
      topContributors: top,
    };

    if (dryRun || plan.items.length === 0) return base;

    await this.pool.commit({
      sourceYear,
      targetYear,
      companyId,
      stakes: plan.stakes,
      items: plan.items,
      summary: plan.summary,
      // 풀 매물은 항상 CREATED — 정책=none이면 모두 baseDate에서 즉시 시작.
    });

    // 커밋 후 발행 — 구독자(메트릭/알림 등)가 붙을 수 있음(Use Case는 무지, ADR-013).
    this.events.emit(
      AUCTION_EVENTS.INVENTORY_CREATED,
      new AuctionInventoryCreatedEvent(
        targetYear,
        plan.summary.auctionsCreated,
        plan.summary.contributorCount,
        companyId,
      ),
    );

    return base;
  }

  private options(targetYear: number) {
    const num = (key: string, def: bigint): bigint => {
      const raw = this.config.get<string>(key);
      if (raw === undefined) return def;
      try {
        const v = BigInt(raw);
        return v > 0n ? v : def;
      } catch {
        return def;
      }
    };
    const int = (key: string, def: number): number => {
      const v = Number(this.config.get<string>(key));
      return Number.isFinite(v) && v >= 0 ? v : def;
    };
    return {
      targetYear,
      startPrice: num("LEAVEPOOL_START_PRICE", DEFAULTS.startPrice),
      minIncrement: num("LEAVEPOOL_MIN_INCREMENT", DEFAULTS.minIncrement),
      auctionDays: int("LEAVEPOOL_AUCTION_DAYS", DEFAULTS.auctionDays) || DEFAULTS.auctionDays,
      weeklyQty: int("LEAVEPOOL_WEEKLY_QTY", DEFAULTS.weeklyQty),
    };
  }
}

/** 분산 시작 기준점 — targetYear 1/1과 현재 시각 중 더 늦은 쪽(과거 회차 X). */
function computeBaseDate(targetYear: number): Date {
  const yearStart = new Date(targetYear, 0, 1, 0, 0, 0, 0);
  const now = new Date();
  return now.getTime() > yearStart.getTime() ? now : yearStart;
}
