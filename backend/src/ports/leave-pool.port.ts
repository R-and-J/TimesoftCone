// LeavePool 아웃바운드 포트(ADR-017). 풀 수집/발행 Use Case가 의존하는 인터페이스.
// 어댑터(PrismaLeavePoolAdapter)가 구현, app.module에서 LEAVE_POOL 심볼로 바인딩.
//   - regularContributions: Leave 컨텍스트(leave_balance REGULAR) 조회만 — 단방향 소비.
//   - isCollected: 멱등성 판정(leave_pool_run).
//   - commit: Stake + supply + run 마커를 단일 트랜잭션으로(원자성, 매물 X — 점진 발행).
//   - findSupplies/releaseBatch: 점진 발행 경로(2026-06-02 결정) — ReleaseInventoryUseCase 전용.

export const LEAVE_POOL = Symbol("LeavePool");

export type LeavePoolCommit = {
  sourceYear: number;
  targetYear: number;
  /** 멀티테넌시: 이 수집이 속한 회사. supply·Stake·run 마커 모두 이 회사로 태깅. */
  companyId: bigint;
  /** 기여자별 Stake(= contributedDays). 어댑터가 stake/supply 두 테이블에 같은 값을 적재. */
  stakes: { userId: bigint; days: number }[];
  summary: { contributorCount: number; daysCollected: number };
};

export type SupplyRow = {
  userId: bigint;
  remainingDays: number;
};

export type ReleaseBatch = {
  targetYear: number;
  companyId: bigint;
  /** 매물 시작·마감(모든 매물 동일 시각 — 회차 도래 시점). */
  startedAt: Date;
  endsAt: Date;
  startPrice: bigint;
  minIncrement: bigint;
  /** 기여자별 차감 분배(release-allocator 결과). */
  allocations: { userId: bigint; take: number }[];
  /** 멱등 마커용 — cadence별 ISO 식별자. */
  periodIndex: string;
  cadence: string;
};

export interface LeavePoolPort {
  /** 해당 (회사, targetYear) 풀이 이미 수집됐는가(멱등 키). */
  isCollected(targetYear: number, companyId: bigint): Promise<boolean>;
  /** sourceYear의 REGULAR 미사용 잔액을 기여 목록으로(회사 스코프, 잔여 > 0만). */
  regularContributions(
    sourceYear: number,
    companyId: bigint,
  ): Promise<{ userId: bigint; name: string; days: number }[]>;
  /** Stake/supply/run 마커를 한 트랜잭션에 커밋. */
  commit(c: LeavePoolCommit): Promise<void>;
  /** (회사, targetYear) supply 잔여 — release 발화 시 ReleaseInventoryUseCase가 사용. */
  findSupplies(targetYear: number, companyId: bigint): Promise<SupplyRow[]>;
  /** 회차 멱등 마커 존재? */
  isReleased(targetYear: number, companyId: bigint, periodIndex: string): Promise<boolean>;
  /** 매물 N개 생성 + supply 차감 + release_run 마커를 단일 트랜잭션에. 생성된 ID 반환. */
  releaseBatch(b: ReleaseBatch): Promise<{ auctionIds: string[] }>;
  /** 멀티테넌시: 풀 수집/발행 대상(활성) 회사 id 목록(스케줄러 루프용). */
  activeCompanyIds(): Promise<bigint[]>;
}
