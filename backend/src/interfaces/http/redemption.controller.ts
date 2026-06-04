// 스토어 — 자립형 배포 콘 소모처 (ADR-023 v2).
//   GET  /api/redemption/items               — 인증 사용자: 카탈로그 조회
//   GET  /api/users/:userId/redemption-orders — 옛 즉시결제 이력(history, deprecated)
//
// 신청 흐름은 RedemptionRequestsController(/api/redemption/requests/*) 참조.

import { Controller, Get, Param, ParseIntPipe } from "@nestjs/common";
import { ListRedemptionItemsUseCase } from "@/application/redemption/list-redemption-items.use-case";
import { ListMyRedemptionOrdersUseCase } from "@/application/redemption/list-my-redemption-orders.use-case";
import { CompanyScope, SelfParam } from "./auth/auth.decorators";

@Controller("api/redemption")
export class RedemptionController {
  constructor(private readonly list: ListRedemptionItemsUseCase) {}

  @Get("items")
  async listItems(@CompanyScope() companyId: bigint | null) {
    return this.list.execute(companyId);
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
