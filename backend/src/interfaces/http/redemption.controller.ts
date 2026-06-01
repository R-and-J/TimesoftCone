// 스토어 — 자립형 배포 포인트 소모처 (ADR-023).
//   GET  /api/redemption/items           — 인증 사용자: 카탈로그 조회
//   POST /api/redemption/orders          — 인증 사용자: 자기 토큰으로 교환(body.userId 무시)
//   GET  /api/users/:userId/redemption-orders — 본인 또는 ADMIN

import { Body, Controller, Get, Param, ParseIntPipe, Post } from "@nestjs/common";
import { z } from "zod";
import { ListRedemptionItemsUseCase } from "@/application/redemption/list-redemption-items.use-case";
import { RedeemItemUseCase } from "@/application/redemption/redeem-item.use-case";
import { ListMyRedemptionOrdersUseCase } from "@/application/redemption/list-my-redemption-orders.use-case";
import { CurrentUser, SelfParam, type AuthUser } from "./auth/auth.decorators";
import { ZodValidationPipe } from "./zod.pipe";

const redeemSchema = z.object({
  itemId: z.number().int().positive(),
});

@Controller("api/redemption")
export class RedemptionController {
  constructor(
    private readonly list: ListRedemptionItemsUseCase,
    private readonly redeem: RedeemItemUseCase,
  ) {}

  @Get("items")
  async listItems() {
    return this.list.execute();
  }

  @Post("orders")
  async redeemItem(
    @CurrentUser() me: AuthUser,
    @Body(new ZodValidationPipe(redeemSchema)) body: z.infer<typeof redeemSchema>,
  ) {
    // 결제 주체는 토큰 — body.userId 같은 건 받지 않는다(CUT-8 정책).
    return this.redeem.execute(me.userId, body.itemId);
  }
}

@Controller("api/users/:userId/redemption-orders")
export class UserRedemptionOrdersController {
  constructor(private readonly listMyOrders: ListMyRedemptionOrdersUseCase) {}

  @Get()
  @SelfParam("userId")
  async myOrders(@Param("userId", ParseIntPipe) userId: number) {
    return this.listMyOrders.execute(userId);
  }
}
