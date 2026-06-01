// LeavePool 아웃바운드 포트(ADR-017). 풀 수집 Use Case가 의존하는 인터페이스.
// 어댑터(PrismaLeavePoolAdapter)가 구현, app.module에서 LEAVE_POOL 심볼로 바인딩.
//   - regularContributions: Leave 컨텍스트(leave_balance REGULAR) 조회만 — 단방향 소비.
//   - isCollected: 멱등성 판정(leave_pool_run).
//   - commit: 매물 생성 + Stake 기록 + run 마커를 단일 트랜잭션으로(원자성).
import type { PoolContribution, InventoryItem } from "@/domain/leave-pool/leave-pool-plan";

export const LEAVE_POOL = Symbol("LeavePool");

export type LeavePoolCommit = {
  sourceYear: number;
  targetYear: number;
  /** 기여자별 Stake(= contributedDays)로 기록. */
  stakes: { userId: bigint; days: number }[];
  items: InventoryItem[];
  summary: { contributorCount: number; daysCollected: number; auctionsCreated: number };
  /** true면 매물을 DRAFT(보류)로 만든다(자동 OPEN 안 함). 분산 정책=none일 때 사용. */
  asDraft?: boolean;
};

export interface LeavePoolPort {
  /** 해당 targetYear 풀이 이미 수집됐는가(멱등 키). */
  isCollected(targetYear: number): Promise<boolean>;
  /** sourceYear의 REGULAR 미사용 잔액을 기여 목록으로(잔여 > 0만). */
  regularContributions(sourceYear: number): Promise<PoolContribution[]>;
  /** 매물·Stake·run 마커를 한 트랜잭션에 커밋. 생성된 경매 ID들을 반환. */
  commit(c: LeavePoolCommit): Promise<{ auctionIds: string[] }>;
}
