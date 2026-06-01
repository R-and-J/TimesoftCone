// UpdateReleasePolicy — 분산 정책 갱신(전체 덮어쓰기). 관리자 전용.
// 검증은 도메인 측 planRelease와 동일 규칙(timeOfDay HH:MM, quantity>0,
// weekly dayOfWeek 0..6, monthly dayOfMonth 1..31).
import { BadRequestException, Inject, Injectable } from "@nestjs/common";
import { RELEASE_POLICY, type ReleasePolicyRepository } from "@/ports/release-policy.port";
import type { ReleasePolicy } from "@/domain/leave-pool/release-plan";

export type UpdateReleasePolicyInput = ReleasePolicy;

@Injectable()
export class UpdateReleasePolicyUseCase {
  constructor(@Inject(RELEASE_POLICY) private readonly repo: ReleasePolicyRepository) {}

  async execute(input: UpdateReleasePolicyInput): Promise<ReleasePolicy> {
    validate(input);
    await this.repo.set(input);
    return input;
  }
}

function validate(p: ReleasePolicy) {
  if (p.cadence === "none") return; // 추가 검증 없음
  if (!/^([01]?\d|2[0-3]):([0-5]\d)$/.test(p.timeOfDay)) {
    throw new BadRequestException("timeOfDay는 HH:MM(24시간) 형식이어야 합니다");
  }
  if (!Number.isInteger(p.quantity) || p.quantity <= 0) {
    throw new BadRequestException("quantity는 1 이상 정수여야 합니다");
  }
  if (p.cadence === "weekly") {
    if (!Number.isInteger(p.dayOfWeek) || p.dayOfWeek < 0 || p.dayOfWeek > 6) {
      throw new BadRequestException("weekly에서 dayOfWeek는 0(일)~6(토) 정수여야 합니다");
    }
  } else if (p.cadence === "monthly") {
    if (!Number.isInteger(p.dayOfMonth) || p.dayOfMonth < 1 || p.dayOfMonth > 31) {
      throw new BadRequestException("monthly에서 dayOfMonth는 1~31 정수여야 합니다");
    }
  } else if (p.cadence !== "daily") {
    throw new BadRequestException("cadence는 none | daily | weekly | monthly 중 하나여야 합니다");
  }
}
