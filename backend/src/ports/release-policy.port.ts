// ReleasePolicy 아웃바운드 포트 — 풀 수집 매물의 startedAt 분산 정책 저장소.
// 싱글톤(행 1개). LeavePool 수집 / 재분산 Use Case가 의존.
import type { ReleasePolicy } from "@/domain/leave-pool/release-plan";

export const RELEASE_POLICY = Symbol("ReleasePolicyRepository");

export interface ReleasePolicyRepository {
  /** 현 정책 조회 — 행이 없을 일은 없지만(시드/마이그레이션이 보장), 없으면 null. */
  get(): Promise<ReleasePolicy | null>;
  /** 정책 갱신(전체 덮어쓰기). */
  set(policy: ReleasePolicy): Promise<void>;
}
