// 사용자 주도 충전 요청 (ADR-024) — 인증 사용자가 본인 토큰으로 요청.
//   POST /api/wallet/charge-requests       — 요청 등록
//   GET  /api/wallet/charge-requests       — 내 요청 목록

import { Body, Controller, Get, Post } from "@nestjs/common";
import { z } from "zod";
import { SubmitChargeRequestUseCase } from "@/application/wallet/charge/submit-charge-request.use-case";
import { ListChargeRequestsUseCase } from "@/application/wallet/charge/list-charge-requests.use-case";
import { CurrentUser, type AuthUser } from "./auth/auth.decorators";
import { ZodValidationPipe } from "./zod.pipe";

const submitSchema = z.object({
  amount: z.union([z.number().int().positive(), z.string().regex(/^\d+$/)]),
  note: z.string().max(200).optional(),
});

@Controller("api/wallet/charge-requests")
export class WalletChargeController {
  constructor(
    private readonly submit: SubmitChargeRequestUseCase,
    private readonly list: ListChargeRequestsUseCase,
  ) {}

  @Post()
  async create(
    @CurrentUser() me: AuthUser,
    @Body(new ZodValidationPipe(submitSchema)) body: z.infer<typeof submitSchema>,
  ) {
    return this.submit.execute({ userId: me.userId, amount: body.amount, note: body.note ?? null });
  }

  @Get()
  async mine(@CurrentUser() me: AuthUser) {
    return this.list.forUser(me.userId);
  }
}
