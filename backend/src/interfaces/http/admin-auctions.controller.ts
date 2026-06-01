// Admin auction operations. ADMIN 전용 (permission-matrix AC-5~7).

import {
  BadRequestException,
  Body,
  Controller,
  Param,
  Post,
  UsePipes,
} from "@nestjs/common";
import { z } from "zod";
import { CreateAuctionUseCase } from "@/application/auction/create-auction.use-case";
import { OpenAuctionUseCase } from "@/application/auction/open-auction.use-case";
import { SettleAuctionUseCase } from "@/application/auction/settle-auction.use-case";
import { SettleDueAuctionsUseCase } from "@/application/auction/settle-due-auctions.use-case";
import { DomainError } from "@/domain/shared/errors";
import { ZodValidationPipe } from "./zod.pipe";
import { Roles } from "./auth/auth.decorators";

const isoDate = z.string().refine((v) => !Number.isNaN(Date.parse(v)), {
  message: "Must be an ISO timestamp",
});

const createSchema = z.object({
  id: z.string().regex(/^A-\d{4}-\d{3,}$/, "id must match A-YYYY-NNN"),
  startPrice: z.union([z.string(), z.number()]),
  minIncrement: z.union([z.string(), z.number()]).optional(),
  leaveDays: z
    .union([z.string(), z.number()])
    .refine((v) => Number.isInteger(Number(v)) && Number(v) >= 1, "leaveDays must be a positive integer")
    .optional(),
  startedAt: isoDate,
  endsAt: isoDate,
});

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

@Roles("ADMIN")
@Controller("api/admin/auctions")
export class AdminAuctionsController {
  constructor(
    private readonly createUC: CreateAuctionUseCase,
    private readonly openUC: OpenAuctionUseCase,
    private readonly settleUC: SettleAuctionUseCase,
    private readonly settleDueUC: SettleDueAuctionsUseCase,
  ) {}

  @Post()
  @UsePipes(new ZodValidationPipe(createSchema))
  async create(@Body() body: z.infer<typeof createSchema>) {
    try {
      return await this.createUC.execute(body);
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
}
