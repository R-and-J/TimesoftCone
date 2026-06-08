// 교환 신청 — 사용자 흐름 (ADR-023 v2).
//   POST /api/redemption/requests             — 신청 등록(인증 사용자 본인)
//   GET  /api/redemption/requests             — 내 신청 목록
//   POST /api/redemption/requests/:id/confirm — 수령 컨펌(APPROVED → RECEIVED)
//
// 즉시 결제 라우트(POST /api/redemption/orders)는 폐기 — RedemptionController에서 제거 예정.

import { BadRequestException, Body, Controller, Get, Param, Post } from "@nestjs/common";
import { z } from "zod";
import { SubmitRedemptionRequestUseCase } from "@/application/redemption/submit-redemption-request.use-case";
import { SubmitCustomRedemptionRequestUseCase } from "@/application/redemption/submit-custom-redemption-request.use-case";
import { ConfirmRedemptionReceivedUseCase } from "@/application/redemption/confirm-redemption-received.use-case";
import { ListRedemptionRequestsUseCase } from "@/application/redemption/list-redemption-requests.use-case";
import { CurrentUser, type AuthUser } from "./auth/auth.decorators";
import { ZodValidationPipe } from "./zod.pipe";

const submitSchema = z.object({
  itemId: z.number().int().positive(),
  note: z.string().max(200).optional(),
});

const customSubmitSchema = z.object({
  customName: z.string().min(1).max(100),
  customPriceP: z.union([z.string(), z.number()]),
  note: z.string().max(200).optional(),
});

@Controller("api/redemption/requests")
export class RedemptionRequestsController {
  constructor(
    private readonly submit: SubmitRedemptionRequestUseCase,
    private readonly submitCustom: SubmitCustomRedemptionRequestUseCase,
    private readonly confirm: ConfirmRedemptionReceivedUseCase,
    private readonly list: ListRedemptionRequestsUseCase,
  ) {}

  @Post()
  async create(
    @CurrentUser() me: AuthUser,
    @Body(new ZodValidationPipe(submitSchema)) body: z.infer<typeof submitSchema>,
  ) {
    return this.submit.execute({ userId: me.userId, itemId: body.itemId, note: body.note ?? null });
  }

  /** "원하는대로 담기" — 카탈로그에 없는 자유 제안형 신청. */
  @Post("custom")
  async createCustom(
    @CurrentUser() me: AuthUser,
    @Body(new ZodValidationPipe(customSubmitSchema)) body: z.infer<typeof customSubmitSchema>,
  ) {
    return this.submitCustom.execute({
      userId: me.userId,
      customName: body.customName,
      customPriceP: body.customPriceP,
      note: body.note ?? null,
    });
  }

  @Get()
  async mine(@CurrentUser() me: AuthUser) {
    return this.list.forUser(me.userId);
  }

  @Post(":id/confirm")
  async confirmReceived(@CurrentUser() me: AuthUser, @Param("id") idRaw: string) {
    if (!/^\d+$/.test(idRaw)) throw new BadRequestException("잘못된 요청 id");
    return this.confirm.execute(Number(idRaw), me.userId);
  }
}
