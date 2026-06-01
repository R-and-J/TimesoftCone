// 관리자 교환 신청 워크플로 — ADMIN 전용 (ADR-023 v2).
//   GET  /api/admin/redemption-requests?status=PENDING — 목록(필터)
//   POST /api/admin/redemption-requests/:id/approve    — 승인 + 쿠폰 발급
//   POST /api/admin/redemption-requests/:id/reject     — 반려 + 환불

import { BadRequestException, Body, Controller, Get, Param, Post, Query } from "@nestjs/common";
import { z } from "zod";
import { ApproveRedemptionRequestUseCase } from "@/application/redemption/approve-redemption-request.use-case";
import { RejectRedemptionRequestUseCase } from "@/application/redemption/reject-redemption-request.use-case";
import { ListRedemptionRequestsUseCase } from "@/application/redemption/list-redemption-requests.use-case";
import { CurrentUser, Roles, type AuthUser } from "./auth/auth.decorators";
import { ZodValidationPipe } from "./zod.pipe";

const approveSchema = z.object({
  couponCode: z.string().min(1).max(500),
  note: z.string().max(200).optional(),
});

const rejectSchema = z.object({
  note: z.string().min(1).max(200),
});

const STATUSES = ["PENDING", "APPROVED", "RECEIVED", "REJECTED"] as const;

@Roles("ADMIN")
@Controller("api/admin/redemption-requests")
export class AdminRedemptionRequestsController {
  constructor(
    private readonly approve: ApproveRedemptionRequestUseCase,
    private readonly reject: RejectRedemptionRequestUseCase,
    private readonly list: ListRedemptionRequestsUseCase,
  ) {}

  @Get()
  async listAll(@Query("status") status?: string) {
    const s = status && (STATUSES as readonly string[]).includes(status)
      ? (status as (typeof STATUSES)[number])
      : undefined;
    return this.list.forAdmin(s);
  }

  @Post(":id/approve")
  async approveOne(
    @CurrentUser() me: AuthUser,
    @Param("id") idRaw: string,
    @Body(new ZodValidationPipe(approveSchema)) body: z.infer<typeof approveSchema>,
  ) {
    if (!/^\d+$/.test(idRaw)) throw new BadRequestException("잘못된 요청 id");
    return this.approve.execute(Number(idRaw), me.userId, body.couponCode, body.note ?? null);
  }

  @Post(":id/reject")
  async rejectOne(
    @CurrentUser() me: AuthUser,
    @Param("id") idRaw: string,
    @Body(new ZodValidationPipe(rejectSchema)) body: z.infer<typeof rejectSchema>,
  ) {
    if (!/^\d+$/.test(idRaw)) throw new BadRequestException("잘못된 요청 id");
    return this.reject.execute(Number(idRaw), me.userId, body.note);
  }
}
