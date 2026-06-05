// 스쿱 마켓 관리 — ADMIN 전용 (2026-06-04). 회사 스코프.
//   GET    /api/admin/redemption/items            카탈로그 전체(비활성 포함)
//   POST   /api/admin/redemption/items            신규 추가
//   PATCH  /api/admin/redemption/items/:id        필드 수정
//   POST   /api/admin/redemption/items/:id/active 활성 토글({ active: boolean })
//   GET    /api/admin/redemption/items/:id/audits 변경 이력

import { BadRequestException, Body, Controller, Get, Param, ParseIntPipe, Patch, Post, Query } from "@nestjs/common";
import { z } from "zod";
import {
  AdminListRedemptionItemsUseCase,
  CreateRedemptionItemUseCase,
  ListRedemptionItemAuditsUseCase,
  SetRedemptionItemActiveUseCase,
  UpdateRedemptionItemUseCase,
} from "@/application/redemption/admin-redemption-items.use-case";
import { ZodValidationPipe } from "./zod.pipe";
import {
  ADMIN_ROLES,
  CompanyScope,
  CurrentUser,
  Roles,
  type AuthUser,
} from "./auth/auth.decorators";

const createSchema = z.object({
  sku: z.string().min(1),
  name: z.string().min(1),
  brand: z.string().nullable().optional(),
  description: z.string().nullable().optional(),
  priceP: z.union([z.string(), z.number()]),
  stock: z.number().int().nonnegative().nullable().optional(),
  category: z.string().nullable().optional(),
  displayOrder: z.number().int().optional(),
  active: z.boolean().optional(),
});

const updateSchema = z.object({
  name: z.string().min(1).optional(),
  brand: z.string().nullable().optional(),
  description: z.string().nullable().optional(),
  priceP: z.union([z.string(), z.number()]).optional(),
  stock: z.number().int().nonnegative().nullable().optional(),
  category: z.string().nullable().optional(),
  displayOrder: z.number().int().optional(),
});

const activeSchema = z.object({ active: z.boolean() });

@Roles(...ADMIN_ROLES)
@Controller("api/admin/redemption/items")
export class AdminRedemptionItemsController {
  constructor(
    private readonly list: AdminListRedemptionItemsUseCase,
    private readonly create: CreateRedemptionItemUseCase,
    private readonly update: UpdateRedemptionItemUseCase,
    private readonly setActive: SetRedemptionItemActiveUseCase,
    private readonly audits: ListRedemptionItemAuditsUseCase,
  ) {}

  @Get()
  async listItems(@CompanyScope() companyId: bigint | null) {
    return this.list.execute(companyId);
  }

  @Post()
  async createItem(
    @CompanyScope() companyId: bigint | null,
    @CurrentUser() user: AuthUser,
    @Body(new ZodValidationPipe(createSchema)) body: z.infer<typeof createSchema>,
  ) {
    // super "전체"(null)는 EZPASS(1)에 기본 등록 — UI에서 회사 선택은 일부러 노출 X.
    const targetCompany = companyId ?? 1n;
    return this.create.execute(targetCompany, user.userId, body);
  }

  @Patch(":id")
  async updateItem(
    @CompanyScope() companyId: bigint | null,
    @CurrentUser() user: AuthUser,
    @Param("id", ParseIntPipe) id: number,
    @Body(new ZodValidationPipe(updateSchema)) body: z.infer<typeof updateSchema>,
  ) {
    if (Object.keys(body).length === 0) {
      throw new BadRequestException("적어도 한 필드를 보내야 합니다");
    }
    return this.update.execute(companyId, user.userId, id, body);
  }

  @Post(":id/active")
  async toggleActive(
    @CompanyScope() companyId: bigint | null,
    @CurrentUser() user: AuthUser,
    @Param("id", ParseIntPipe) id: number,
    @Body(new ZodValidationPipe(activeSchema)) body: z.infer<typeof activeSchema>,
  ) {
    return this.setActive.execute(companyId, user.userId, id, body.active);
  }

  @Get(":id/audits")
  async listAudits(
    @CompanyScope() companyId: bigint | null,
    @Param("id", ParseIntPipe) id: number,
    @Query("limit") limit?: string,
  ) {
    const n = limit ? Number(limit) : undefined;
    return this.audits.execute(companyId, id, n);
  }
}
