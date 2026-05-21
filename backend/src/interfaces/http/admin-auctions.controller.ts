// Admin auction operations. RBAC is NOT enforced (scope-cuts.md CUT-8).

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
import { SettleAuctionUseCase } from "@/application/auction/settle-auction.use-case";
import { SettleDueAuctionsUseCase } from "@/application/auction/settle-due-auctions.use-case";
import { DomainError } from "@/domain/shared/errors";
import { ZodValidationPipe } from "./zod.pipe";

const isoDate = z.string().refine((v) => !Number.isNaN(Date.parse(v)), {
  message: "Must be an ISO timestamp",
});

const createSchema = z.object({
  id: z.string().regex(/^A-\d{4}-\d{3,}$/, "id must match A-YYYY-NNN"),
  startPrice: z.union([z.string(), z.number()]),
  minIncrement: z.union([z.string(), z.number()]).optional(),
  startedAt: isoDate,
  endsAt: isoDate,
});

@Controller("api/admin/auctions")
export class AdminAuctionsController {
  constructor(
    private readonly createUC: CreateAuctionUseCase,
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
