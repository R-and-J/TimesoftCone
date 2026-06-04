// 풀 매물 분산 오픈 정책 — ADMIN 전용.
//   GET   /api/admin/release-policy
//   PATCH /api/admin/release-policy   body: ReleasePolicy(union)
//
// 검증은 zod로 파이프, 추가 의미 검증은 UseCase 안에서.
import { Body, Controller, Get, Patch } from "@nestjs/common";
import { z } from "zod";
import { ZodValidationPipe } from "./zod.pipe";
import { GetReleasePolicyUseCase } from "@/application/leave-pool/get-release-policy.use-case";
import { UpdateReleasePolicyUseCase } from "@/application/leave-pool/update-release-policy.use-case";
import { Roles, ADMIN_ROLES } from "./auth/auth.decorators";

// 정책별 시작가(콘) — null/생략은 ENV/기본값 사용. 양의 정수 string/number 허용.
const startPriceSchema = z
  .union([z.string(), z.number()])
  .nullable()
  .optional()
  .refine(
    (v) => v == null || (Number.isFinite(Number(v)) && Number(v) > 0),
    "startPrice 는 양수여야 합니다",
  );

const policySchema = z.discriminatedUnion("cadence", [
  z.object({ cadence: z.literal("none"), startPrice: startPriceSchema }),
  z.object({
    cadence: z.literal("daily"),
    timeOfDay: z.string(),
    quantity: z.number().int().positive(),
    startPrice: startPriceSchema,
  }),
  z.object({
    cadence: z.literal("weekly"),
    dayOfWeek: z.number().int().min(0).max(6),
    timeOfDay: z.string(),
    quantity: z.number().int().positive(),
    startPrice: startPriceSchema,
  }),
  z.object({
    cadence: z.literal("monthly"),
    dayOfMonth: z.number().int().min(1).max(31),
    timeOfDay: z.string(),
    quantity: z.number().int().positive(),
    startPrice: startPriceSchema,
  }),
]);

@Roles(...ADMIN_ROLES)
@Controller("api/admin/release-policy")
export class AdminReleasePolicyController {
  constructor(
    private readonly get: GetReleasePolicyUseCase,
    private readonly update: UpdateReleasePolicyUseCase,
  ) {}

  @Get()
  async read() {
    return this.get.execute();
  }

  @Patch()
  async patch(@Body(new ZodValidationPipe(policySchema)) body: z.infer<typeof policySchema>) {
    return this.update.execute(body);
  }
}
