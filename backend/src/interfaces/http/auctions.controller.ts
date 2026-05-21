// Public-facing auction endpoints (read + place bid).
// Admin-only endpoints live in admin-auctions.controller.ts.

import {
  BadRequestException,
  Body,
  ConflictException,
  Controller,
  Get,
  Param,
  Post,
  Query,
  UsePipes,
} from "@nestjs/common";
import { z } from "zod";
import { ListAuctionsUseCase } from "@/application/auction/list-auctions.use-case";
import { GetAuctionDetailUseCase } from "@/application/auction/get-auction-detail.use-case";
import { PlaceBidUseCase } from "@/application/auction/place-bid.use-case";
import { DomainError } from "@/domain/shared/errors";
import { ZodValidationPipe } from "./zod.pipe";
import type { AuctionStatus } from "@/domain/auction/auction-status";

const placeBidSchema = z.object({
  userId: z.union([z.string(), z.number()]),
  amount: z
    .union([z.string(), z.number()])
    .refine((v) => {
      try { return BigInt(v) > 0n; } catch { return false; }
    }, "amount must be a positive integer"),
});

@Controller("api/auctions")
export class AuctionsController {
  constructor(
    private readonly listUC: ListAuctionsUseCase,
    private readonly detailUC: GetAuctionDetailUseCase,
    private readonly placeBidUC: PlaceBidUseCase,
  ) {}

  @Get()
  async list(@Query("status") status?: string) {
    const parsed = status?.split(",").filter(Boolean) as
      | AuctionStatus[]
      | undefined;
    return this.listUC.execute(parsed ? { status: parsed } : undefined);
  }

  @Get(":id")
  async detail(@Param("id") id: string) {
    return this.detailUC.execute(id);
  }

  @Post(":id/bids")
  @UsePipes(new ZodValidationPipe(placeBidSchema))
  async placeBid(
    @Param("id") id: string,
    @Body() body: z.infer<typeof placeBidSchema>,
  ) {
    try {
      return await this.placeBidUC.execute({
        auctionId: id,
        userId: body.userId,
        amount: body.amount,
      });
    } catch (e) {
      if (e instanceof DomainError) {
        // Domain errors are *user-facing rule violations* — 409 Conflict feels
        // right for "auction ended" / "bid too low" / "not OPEN"; the client
        // can show the message verbatim.
        throw new ConflictException(e.message);
      }
      throw e;
    }
  }
}
