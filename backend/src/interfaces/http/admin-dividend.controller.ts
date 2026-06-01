// 연말 배당 정산 — ADMIN 전용 (ADR-008). 운영자가 연말에 1회 실행.
//   POST /api/admin/dividend/settle?dryRun=true   → 미리보기(지급 안 함)
//   POST /api/admin/dividend/settle               → 실제 지급(멱등: 재호출 시 409)

import { Controller, Post, Query } from "@nestjs/common";
import { SettleYearEndDividendUseCase } from "@/application/dividend/settle-year-end-dividend.use-case";
import { Roles, ADMIN_ROLES } from "./auth/auth.decorators";

@Roles(...ADMIN_ROLES)
@Controller("api/admin/dividend")
export class AdminDividendController {
  constructor(private readonly settle: SettleYearEndDividendUseCase) {}

  @Post("settle")
  async settleDividend(
    @Query("dryRun") dryRun?: string,
    @Query("year") year?: string,
  ) {
    return this.settle.execute({
      dryRun: dryRun === "true" || dryRun === "1",
      year: year ? Number(year) : undefined,
    });
  }
}
