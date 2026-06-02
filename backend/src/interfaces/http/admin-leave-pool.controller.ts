// 연말 풀 수집 — ADMIN 전용 (ADR-017). 운영자가 연말에 1회 실행.
//   POST /api/admin/leave-pool/collect?dryRun=true   → 미리보기(수집 안 함)
//   POST /api/admin/leave-pool/collect               → 실제 수집(멱등: 재호출 409)
//   ?sourceYear= 로 수집 대상 연도 지정(기본 올해).

import { Controller, Post, Query } from "@nestjs/common";
import { CollectLeavePoolUseCase } from "@/application/leave-pool/collect-leave-pool.use-case";
import { Roles, ADMIN_ROLES, CompanyScope } from "./auth/auth.decorators";

@Roles(...ADMIN_ROLES)
@Controller("api/admin/leave-pool")
export class AdminLeavePoolController {
  constructor(private readonly collect: CollectLeavePoolUseCase) {}

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
    // 회사 관리자 → 자기 회사. super "전체"(null) → 전 회사 일괄 수집.
    if (companyId == null) return this.collect.executeAll(opts);
    return this.collect.execute({ ...opts, companyId });
  }
}
