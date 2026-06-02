// 관리자 충전 요청 워크플로 — ADMIN 전용 (ADR-024).
//   GET  /api/admin/charge-requests?status=PENDING — 목록
//   POST /api/admin/charge-requests/:id/approve    — 승인 (잔액 적립)
//   POST /api/admin/charge-requests/:id/reject     — 반려

import { BadRequestException, Body, Controller, Get, NotFoundException, Param, Post, Query } from "@nestjs/common";
import { z } from "zod";
import { ApproveChargeRequestUseCase } from "@/application/wallet/charge/approve-charge-request.use-case";
import { RejectChargeRequestUseCase } from "@/application/wallet/charge/reject-charge-request.use-case";
import { ListChargeRequestsUseCase } from "@/application/wallet/charge/list-charge-requests.use-case";
import { CurrentUser, CompanyScope, Roles, ADMIN_ROLES, type AuthUser } from "./auth/auth.decorators";
import { ZodValidationPipe } from "./zod.pipe";

const decisionSchema = z.object({
  note: z.string().max(200).optional(),
});

const STATUSES = ["PENDING", "APPROVED", "REJECTED"] as const;

@Roles(...ADMIN_ROLES)
@Controller("api/admin/charge-requests")
export class AdminChargesController {
  constructor(
    private readonly approve: ApproveChargeRequestUseCase,
    private readonly reject: RejectChargeRequestUseCase,
    private readonly list: ListChargeRequestsUseCase,
  ) {}

  @Get()
  async listAll(@CompanyScope() companyId: bigint | null, @Query("status") status?: string) {
    const s = status && (STATUSES as readonly string[]).includes(status) ? (status as (typeof STATUSES)[number]) : undefined;
    return this.list.forAdmin(s, 50, companyId);
  }

  /** 알림 deep-link이 회원관리에서 prefill에 사용. */
  @Get(":id")
  async getOne(@Param("id") idRaw: string) {
    if (!/^\d+$/.test(idRaw)) throw new BadRequestException("잘못된 요청 id");
    const row = await this.list.byId(Number(idRaw));
    if (!row) throw new NotFoundException(`충전 요청 #${idRaw}을 찾을 수 없습니다`);
    return row;
  }

  @Post(":id/approve")
  async approveOne(
    @CurrentUser() me: AuthUser,
    @Param("id") idRaw: string,
    @Body(new ZodValidationPipe(decisionSchema)) body: z.infer<typeof decisionSchema>,
  ) {
    if (!/^\d+$/.test(idRaw)) throw new BadRequestException("잘못된 요청 id");
    return this.approve.execute(Number(idRaw), me.userId, body.note ?? null);
  }

  @Post(":id/reject")
  async rejectOne(
    @CurrentUser() me: AuthUser,
    @Param("id") idRaw: string,
    @Body(new ZodValidationPipe(decisionSchema)) body: z.infer<typeof decisionSchema>,
  ) {
    if (!/^\d+$/.test(idRaw)) throw new BadRequestException("잘못된 요청 id");
    return this.reject.execute(Number(idRaw), me.userId, body.note ?? null);
  }
}
