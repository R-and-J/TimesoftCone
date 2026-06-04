// ReleaseInventory — 점진 발행 배치(2026-06-02 결정).
// CollectLeavePool은 supply만 적재해두고, 이 Use Case가 ReleasePolicy 주기마다
// supply에서 quantity를 빼서 1일권 매물을 생성한다.
//
// 회차 식별(periodIndex)는 cadence별 ISO 식별자(release-window). 한 회차는
// leave_pool_release_run UNIQUE로 한 번만 발행되도록 멱등 보장.
// 매물 시작·마감은 회차 도래 시각 기준 — startedAt=now, endsAt=now+auctionDays.
// startedAt이 이미 도래했으므로 OpenDueAuctionsScheduler가 다음 틱에 OPEN으로 승급.

import { ConflictException, Inject, Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { EventEmitter2 } from "@nestjs/event-emitter";
import { LEAVE_POOL, type LeavePoolPort } from "@/ports/leave-pool.port";
import { RELEASE_POLICY, type ReleasePolicyRepository } from "@/ports/release-policy.port";
import { allocateRelease } from "@/domain/leave-pool/release-allocator";
import { currentReleaseWindow, nextReleaseWindow } from "@/domain/leave-pool/release-window";
import type { ReleasePolicy } from "@/domain/leave-pool/release-plan";
import {
  AUCTION_EVENTS,
  AuctionInventoryCreatedEvent,
} from "@/application/events/auction-events";

export type ReleaseInventoryInput = {
  /** sourceYear 기준 — supply는 targetYear=sourceYear+1로 적재되어 있다. */
  sourceYear?: number;
  companyId?: bigint | null;
  /** 정책의 도래 시각 검사를 무시(관리자 수동 발행에 사용). */
  force?: boolean;
};

export type ReleaseInventoryResult = {
  targetYear: number;
  companyId: string;
  cadence: string;
  periodIndex: string;
  status: "RELEASED" | "EMPTY" | "WAITING" | "ALREADY_RELEASED";
  released: number;
  totalRemainingBefore: number;
  totalRemainingAfter: number;
};

const DEFAULTS = { startPrice: 30000n, minIncrement: 100n, auctionDays: 7 };

@Injectable()
export class ReleaseInventoryUseCase {
  constructor(
    @Inject(LEAVE_POOL) private readonly pool: LeavePoolPort,
    @Inject(RELEASE_POLICY) private readonly policyRepo: ReleasePolicyRepository,
    private readonly config: ConfigService,
    private readonly events: EventEmitter2,
  ) {}

  async executeAll(input?: Omit<ReleaseInventoryInput, "companyId">): Promise<ReleaseInventoryResult[]> {
    const companyIds = await this.pool.activeCompanyIds();
    const results: ReleaseInventoryResult[] = [];
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

  async execute(input?: ReleaseInventoryInput): Promise<ReleaseInventoryResult> {
    const sourceYear = input?.sourceYear ?? new Date().getFullYear();
    const targetYear = sourceYear + 1;
    const companyId = input?.companyId ?? 1n;
    const force = input?.force ?? false;

    const policy: ReleasePolicy = (await this.policyRepo.get()) ?? { cadence: "none" as const };
    const now = new Date();
    const window = currentReleaseWindow(policy, now);

    const supplies = await this.pool.findSupplies(targetYear, companyId);
    const totalRemainingBefore = supplies.reduce((s, r) => s + r.remainingDays, 0);

    // 멱등성 — 같은 (회사, 연도, 회차)에 두 번 발화 X. 소진과 무관하게 우선 검사.
    const already = await this.pool.isReleased(targetYear, companyId, window.periodIndex);
    if (already) {
      return {
        targetYear,
        companyId: companyId.toString(),
        cadence: policy.cadence,
        periodIndex: window.periodIndex,
        status: "ALREADY_RELEASED",
        released: 0,
        totalRemainingBefore,
        totalRemainingAfter: totalRemainingBefore,
      };
    }

    if (!force && now.getTime() < window.occurrenceDate.getTime()) {
      return {
        targetYear,
        companyId: companyId.toString(),
        cadence: policy.cadence,
        periodIndex: window.periodIndex,
        status: "WAITING",
        released: 0,
        totalRemainingBefore,
        totalRemainingAfter: totalRemainingBefore,
      };
    }

    if (totalRemainingBefore === 0) {
      return {
        targetYear,
        companyId: companyId.toString(),
        cadence: policy.cadence,
        periodIndex: window.periodIndex,
        status: "EMPTY",
        released: 0,
        totalRemainingBefore: 0,
        totalRemainingAfter: 0,
      };
    }

    // 회차당 발행 수량: none=전부, 그 외=policy.quantity(잔여로 캡).
    const quantity =
      policy.cadence === "none" ? totalRemainingBefore : Math.min(policy.quantity, totalRemainingBefore);
    const alloc = allocateRelease(supplies, quantity);
    if (alloc.released === 0) {
      return {
        targetYear,
        companyId: companyId.toString(),
        cadence: policy.cadence,
        periodIndex: window.periodIndex,
        status: "EMPTY",
        released: 0,
        totalRemainingBefore,
        totalRemainingAfter: totalRemainingBefore,
      };
    }

    const opts = this.options();
    const startedAt = new Date(now.getTime());
    const endsAt = new Date(startedAt.getTime() + opts.auctionDays * 24 * 60 * 60 * 1000);

    await this.pool.releaseBatch({
      targetYear,
      companyId,
      startedAt,
      endsAt,
      startPrice: opts.startPrice,
      minIncrement: opts.minIncrement,
      allocations: alloc.allocations,
      periodIndex: window.periodIndex,
      cadence: policy.cadence,
    });

    this.events.emit(
      AUCTION_EVENTS.INVENTORY_CREATED,
      new AuctionInventoryCreatedEvent(
        targetYear,
        alloc.released,
        alloc.allocations.length,
        companyId,
      ),
    );

    return {
      targetYear,
      companyId: companyId.toString(),
      cadence: policy.cadence,
      periodIndex: window.periodIndex,
      status: "RELEASED",
      released: alloc.released,
      totalRemainingBefore,
      totalRemainingAfter: totalRemainingBefore - alloc.released,
    };
  }

  /** 다음 자동 발행 회차 미리보기 — AdminAuctions "오픈 예정" 위에 안내용. */
  async previewNext(input?: { sourceYear?: number; companyId?: bigint | null }) {
    const sourceYear = input?.sourceYear ?? new Date().getFullYear();
    const targetYear = sourceYear + 1;
    const companyId = input?.companyId ?? 1n;

    const policy: ReleasePolicy = (await this.policyRepo.get()) ?? { cadence: "none" as const };
    const now = new Date();
    const win = currentReleaseWindow(policy, now);
    const supplies = await this.pool.findSupplies(targetYear, companyId);
    const totalRemaining = supplies.reduce((s, r) => s + r.remainingDays, 0);

    let occurrenceDate = win.occurrenceDate;
    let periodIndex = win.periodIndex;
    // 이미 발행된 회차거나 도래 시각이 지났으면 다음 회차로.
    const released = await this.pool.isReleased(targetYear, companyId, periodIndex);
    if (released && policy.cadence !== "none") {
      const next = nextReleaseWindow(policy, occurrenceDate);
      occurrenceDate = next.occurrenceDate;
      periodIndex = next.periodIndex;
    }

    const quantity =
      policy.cadence === "none"
        ? totalRemaining
        : Math.min(policy.quantity, totalRemaining);

    return {
      targetYear,
      companyId: companyId.toString(),
      cadence: policy.cadence,
      periodIndex,
      occurrenceDate: occurrenceDate.toISOString(),
      quantity,
      totalRemaining,
      hasPending: totalRemaining > 0 && quantity > 0,
    };
  }

  private options() {
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
      startPrice: num("LEAVEPOOL_START_PRICE", DEFAULTS.startPrice),
      minIncrement: num("LEAVEPOOL_MIN_INCREMENT", DEFAULTS.minIncrement),
      auctionDays: int("LEAVEPOOL_AUCTION_DAYS", DEFAULTS.auctionDays) || DEFAULTS.auctionDays,
    };
  }
}
