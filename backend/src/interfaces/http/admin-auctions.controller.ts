// Admin auction operations. ADMIN 전용 (permission-matrix AC-5~7).

import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Param,
  Post,
  Query,
  UsePipes,
} from "@nestjs/common";
import { z } from "zod";
import { CreateAuctionUseCase } from "@/application/auction/create-auction.use-case";
import { OpenAuctionUseCase } from "@/application/auction/open-auction.use-case";
import { ScheduleAuctionUseCase } from "@/application/auction/schedule-auction.use-case";
import { SettleAuctionUseCase } from "@/application/auction/settle-auction.use-case";
import { SettleDueAuctionsUseCase } from "@/application/auction/settle-due-auctions.use-case";
import { OpenDueAuctionsUseCase } from "@/application/auction/open-due-auctions.use-case";
import { CancelAuctionsUseCase } from "@/application/auction/cancel-auctions.use-case";
import { GetAuctionsSummaryUseCase } from "@/application/auction/get-auctions-summary.use-case";
import { GetNextAuctionIdUseCase } from "@/application/auction/get-next-auction-id.use-case";
import { ExtendAuctionDeadlineUseCase } from "@/application/auction/extend-auction-deadline.use-case";
import { CloseAuctionImmediatelyUseCase } from "@/application/auction/close-auction-immediately.use-case";
import { DomainError } from "@/domain/shared/errors";
import { ZodValidationPipe } from "./zod.pipe";
import { Roles, ADMIN_ROLES, CompanyScope } from "./auth/auth.decorators";

const isoDate = z.string().refine((v) => !Number.isNaN(Date.parse(v)), {
  message: "Must be an ISO timestamp",
});

const createSchema = z.object({
  /** 1일권 발행 수량(기본 1). id는 서버 채번, leaveDays는 1 고정. */
  quantity: z
    .union([z.string(), z.number()])
    .refine((v) => Number.isInteger(Number(v)) && Number(v) >= 1 && Number(v) <= 1000, "quantity must be 1~1000")
    .optional(),
  startPrice: z.union([z.string(), z.number()]),
  minIncrement: z.union([z.string(), z.number()]).optional(),
  /** true면 DRAFT(보류) 매물로 생성. startedAt/endsAt 불필요. */
  asDraft: z.boolean().optional(),
  startedAt: isoDate.optional(),
  endsAt: isoDate.optional(),
});

const cancelSchema = z.object({
  ids: z.array(z.string().regex(/^A-\d{4}-\d{3,}$/, "id must match A-YYYY-NNN")).min(1),
});

const extendSchema = z.object({ endsAt: isoDate });

const openSchema = z.object({
  startedAt: isoDate.optional(),
  endsAt: isoDate.optional(),
  startPrice: z.union([z.string(), z.number()]).optional(),
  minIncrement: z.union([z.string(), z.number()]).optional(),
  leaveDays: z
    .union([z.string(), z.number()])
    .refine((v) => Number.isInteger(Number(v)) && Number(v) >= 1, "leaveDays must be a positive integer")
    .optional(),
  force: z.boolean().optional(),
});

@Roles(...ADMIN_ROLES)
@Controller("api/admin/auctions")
export class AdminAuctionsController {
  constructor(
    private readonly createUC: CreateAuctionUseCase,
    private readonly openUC: OpenAuctionUseCase,
    private readonly scheduleUC: ScheduleAuctionUseCase,
    private readonly settleUC: SettleAuctionUseCase,
    private readonly settleDueUC: SettleDueAuctionsUseCase,
    private readonly openDueUC: OpenDueAuctionsUseCase,
    private readonly cancelUC: CancelAuctionsUseCase,
    private readonly summaryUC: GetAuctionsSummaryUseCase,
    private readonly nextIdUC: GetNextAuctionIdUseCase,
    private readonly extendUC: ExtendAuctionDeadlineUseCase,
    private readonly closeNowUC: CloseAuctionImmediatelyUseCase,
  ) {}

  @Post()
  @UsePipes(new ZodValidationPipe(createSchema))
  async create(
    @CompanyScope() companyId: bigint | null,
    @Body() body: z.infer<typeof createSchema>,
  ) {
    try {
      // 매물은 생성자(회사 관리자) 회사 소속. super가 "전체"면 use-case가 EZPASS(1)로.
      return await this.createUC.execute({ ...body, companyId });
    } catch (e) {
      if (e instanceof DomainError) throw new BadRequestException(e.message);
      throw e;
    }
  }

  /** CREATED 경매를 즉시 OPEN으로 전환. body로 운영 파라미터(시작/마감 시각, 시작금,
   *  일수, 증분) 변경 동반 가능 — 관리자 "오픈 예정" 모달이 사용. */
  @Post(":id/open")
  async openNow(
    @Param("id") id: string,
    @Body(new ZodValidationPipe(openSchema)) body: z.infer<typeof openSchema>,
  ) {
    try {
      return await this.openUC.execute(id, body);
    } catch (e) {
      if (e instanceof DomainError) throw new BadRequestException(e.message);
      throw e;
    }
  }

  /** CREATED 경매의 운영 파라미터만 갱신(예약 저장) — 상태는 CREATED 유지.
   *  시간이 되면 OpenDueAuctionsScheduler가 자동 OPEN 처리. */
  @Post(":id/schedule")
  async schedule(
    @Param("id") id: string,
    @Body(new ZodValidationPipe(openSchema.omit({ force: true }))) body: z.infer<typeof openSchema>,
  ) {
    try {
      return await this.scheduleUC.execute(id, body);
    } catch (e) {
      if (e instanceof DomainError) throw new BadRequestException(e.message);
      throw e;
    }
  }

  @Post(":id/settle")
  async settle(@Param("id") id: string) {
    try {
      return await this.settleUC.execute(id);
    } catch (e) {
      if (e instanceof DomainError) throw new BadRequestException(e.message);
      throw e;
    }
  }

  /**
   * Manual trigger for the auto-settlement batch. Useful in demos when you
   * don't want to wait for the next scheduler tick.
   */
  @Post("settle-due")
  async settleDue() {
    return this.settleDueUC.execute();
  }

  /** startedAt이 지난 CREATED 매물을 OPEN으로 자동 승급(수동 트리거). */
  @Post("open-due")
  async openDue() {
    return this.openDueUC.execute();
  }

  /** 경매관리 상단 카운터 — 총 / 오픈 예정 / 진행 중 / 종료. 회사 스코프. */
  @Get("summary")
  async summary(@CompanyScope() companyId: bigint | null) {
    return this.summaryUC.execute(companyId);
  }

  /** 수동 추가 모달용 — 다음 채번 추천("A-YYYY-NNN"). */
  @Get("next-id")
  async nextId(@Query("year") year?: string) {
    return this.nextIdUC.execute(year ? Number(year) : undefined);
  }

  /** OPEN 매물의 마감 시각 연장(앞으로 당기기는 close-now). */
  @Post(":id/extend")
  async extend(
    @Param("id") id: string,
    @Body(new ZodValidationPipe(extendSchema)) body: z.infer<typeof extendSchema>,
  ) {
    try {
      return await this.extendUC.execute(id, body);
    } catch (e) {
      if (e instanceof DomainError) throw new BadRequestException(e.message);
      throw e;
    }
  }

  /** OPEN 매물을 즉시 마감 + 정산(낙찰/유찰 처리). */
  @Post(":id/close-now")
  async closeNow(@Param("id") id: string) {
    try {
      return await this.closeNowUC.execute(id);
    } catch (e) {
      if (e instanceof DomainError) throw new BadRequestException(e.message);
      throw e;
    }
  }

  /** CREATED 매물 다중 취소(삭제). OPEN 이상은 skipped로 응답. */
  @Post("cancel")
  async cancel(
    @Body(new ZodValidationPipe(cancelSchema)) body: z.infer<typeof cancelSchema>,
  ) {
    return this.cancelUC.execute(body.ids);
  }
}
