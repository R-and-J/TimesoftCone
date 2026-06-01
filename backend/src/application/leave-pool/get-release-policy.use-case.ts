// GetReleasePolicy — 현 분산 정책 조회. 없으면 안전 폴백(none).
import { Inject, Injectable } from "@nestjs/common";
import { RELEASE_POLICY, type ReleasePolicyRepository } from "@/ports/release-policy.port";
import type { ReleasePolicy } from "@/domain/leave-pool/release-plan";

@Injectable()
export class GetReleasePolicyUseCase {
  constructor(@Inject(RELEASE_POLICY) private readonly repo: ReleasePolicyRepository) {}

  async execute(): Promise<ReleasePolicy> {
    const p = await this.repo.get();
    if (p) return p;
    // 마이그레이션이 시드를 보장하지만 안전망.
    return { cadence: "none" };
  }
}
