// 관리자 비상조치 — 우리 leave_balance.AUCTION ↔ ezpass mdat 정합 검사·복구.
// 평소엔 자동 sync(낙찰 시 Outbox→relay→streYryc). 이슈로 drift 발생 시에만 사용.
//   POST /api/admin/leave-sync/check               — 전체 점검(무거움, 명시 트리거)
//   POST /api/admin/leave-sync/:userId/reconcile   — 단일 사용자 강제 동기

import { BadRequestException, Controller, Param, Post, Query } from "@nestjs/common";
import { GetLeaveSyncReportUseCase } from "@/application/leave-sync/get-leave-sync-report.use-case";
import { ReconcileUserLeaveUseCase } from "@/application/leave-sync/reconcile-user-leave.use-case";
import { Roles } from "./auth/auth.decorators";

@Roles("ADMIN")
@Controller("api/admin/leave-sync")
export class AdminLeaveSyncController {
  constructor(
    private readonly report: GetLeaveSyncReportUseCase,
    private readonly reconcile: ReconcileUserLeaveUseCase,
  ) {}

  @Post("check")
  async check(@Query("year") yearRaw?: string) {
    const year = yearRaw && /^\d{4}$/.test(yearRaw) ? Number(yearRaw) : undefined;
    return this.report.execute(year);
  }

  @Post(":userId/reconcile")
  async reconcileOne(@Param("userId") userIdRaw: string, @Query("year") yearRaw?: string) {
    if (!/^\d+$/.test(userIdRaw)) throw new BadRequestException("잘못된 userId");
    const year = yearRaw && /^\d{4}$/.test(yearRaw) ? Number(yearRaw) : undefined;
    return this.reconcile.execute(BigInt(userIdRaw), year);
  }
}
