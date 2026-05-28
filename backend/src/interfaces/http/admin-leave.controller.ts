// FR-3.1 + FR-4.2 ADMIN HTTP 엔드포인트.
//   POST /api/admin/leave/use                휴가 사용(우선순위 차감) — FR-3.1
//   POST /api/admin/auctions/:id/grant-event UNSOLD → EVENT 휴가 변환 — FR-4.2
//   POST /api/admin/auctions/purge-unsold    UNSOLD 재고 영구 삭제 — FR-4.2
//
// 분석용: 세 라우트 모두 ADMIN 전용. FR-3.1 use leave는 본래 그룹웨어 트리거가
// 담당할 책임이라 직원 self 라우트로 노출하지 않고 관리자 디버그/시연용으로만 둠.

import { BadRequestException, Body, ConflictException, Controller, Param, Post, Query } from "@nestjs/common";
import { z } from "zod";
import { UseLeaveUseCase } from "@/application/leave/use-leave.use-case";
import { GrantEventFromUnsoldUseCase } from "@/application/leave/grant-event-from-unsold.use-case";
import { PurgeUnsoldAuctionsUseCase } from "@/application/leave/purge-unsold-auctions.use-case";
import { ZodValidationPipe } from "./zod.pipe";
import { Roles } from "./auth/auth.decorators";

const useLeaveSchema = z.object({
  userId: z.union([z.string(), z.number()]),
  days: z.number().int().positive(),
  year: z.number().int().optional(),
});

const grantEventSchema = z.object({
  userId: z.union([z.string(), z.number()]),
});

@Roles("ADMIN")
@Controller("api/admin")
export class AdminLeaveController {
  constructor(
    private readonly useLeave: UseLeaveUseCase,
    private readonly grantEvent: GrantEventFromUnsoldUseCase,
    private readonly purge: PurgeUnsoldAuctionsUseCase,
  ) {}

  @Post("leave/use")
  async use(@Body(new ZodValidationPipe(useLeaveSchema)) body: z.infer<typeof useLeaveSchema>) {
    try {
      return await this.useLeave.execute({ userId: body.userId, days: body.days, year: body.year });
    } catch (e) {
      // ConflictException은 그대로 전파(insufficient 등). 나머지 도메인 검증은 BadRequest.
      if (e instanceof ConflictException) throw e;
      throw new BadRequestException((e as Error).message);
    }
  }

  @Post("auctions/:id/grant-event")
  async grantEventFromUnsold(
    @Param("id") id: string,
    @Body(new ZodValidationPipe(grantEventSchema)) body: z.infer<typeof grantEventSchema>,
  ) {
    return this.grantEvent.execute({ auctionId: id, userId: body.userId });
  }

  @Post("auctions/purge-unsold")
  async purgeUnsold(@Query("upToYear") upToYear?: string) {
    const y = upToYear ? Number(upToYear) : undefined;
    return this.purge.execute({ upToYear: y });
  }
}
