// 연말 풀 수집·발행 — ADMIN 전용 (ADR-017, 2026-06-02 점진 발행).
//   POST /api/admin/leave-pool/collect?dryRun=true   → 미리보기(수집 안 함)
//   POST /api/admin/leave-pool/collect               → 실제 수집(supply만, 매물 X). 멱등.
//   POST /api/admin/leave-pool/release?force=true    → 다음 회차를 정책 무시하고 즉시 발행.
//   POST /api/admin/leave-pool/release               → 회차 도래 시에만 발행(자동 배치와 동일).
//   ?sourceYear= 로 수집/발행 대상 연도 지정(기본 올해).

import { Controller, Post, Query } from "@nestjs/common";
import { CollectLeavePoolUseCase } from "@/application/leave-pool/collect-leave-pool.use-case";
import { ReleaseInventoryUseCase } from "@/application/leave-pool/release-inventory.use-case";
import { Roles, ADMIN_ROLES, CompanyScope } from "./auth/auth.decorators";

@Roles(...ADMIN_ROLES)
@Controller("api/admin/leave-pool")
export class AdminLeavePoolController {
  constructor(
    private readonly collect: CollectLeavePoolUseCase,
    private readonly release: ReleaseInventoryUseCase,
  ) {}

  @Post("collect")
  async collectPool(
    @CompanyScope() companyId: bigint | null,
    @Query("dryRun") dryRun?: string,
    @Query("sourceYear") sourceYear?: string,
  ) {
    const opts = {
      dryRun: dryRun === "true" || dryRun === "1",
      sourceYear: sourceYear ? Number(sourceYear) : undefined,
    };
    if (companyId == null) return this.collect.executeAll(opts);
    return this.collect.execute({ ...opts, companyId });
  }

  @Post("release")
  async releaseInventory(
    @CompanyScope() companyId: bigint | null,
    @Query("force") force?: string,
    @Query("sourceYear") sourceYear?: string,
  ) {
    const opts = {
      force: force === "true" || force === "1",
      sourceYear: sourceYear ? Number(sourceYear) : undefined,
    };
    if (companyId == null) return this.release.executeAll(opts);
    return this.release.execute({ ...opts, companyId });
  }
}
