// Public-facing auction endpoints (read + place bid).
// Admin-only endpoints live in admin-auctions.controller.ts.

import {
  BadRequestException,
  Body,
  ConflictException,
  Controller,
  Get,
  Inject,
  type MessageEvent,
  Param,
  Post,
  Query,
  Sse,
} from "@nestjs/common";
import type { Observable } from "rxjs";
import { z } from "zod";
import { ListAuctionsUseCase } from "@/application/auction/list-auctions.use-case";
import { GetAuctionDetailUseCase } from "@/application/auction/get-auction-detail.use-case";
import { PlaceBidUseCase } from "@/application/auction/place-bid.use-case";
import { AUCTION_STREAM, type AuctionStreamPort } from "@/ports/auction-stream.port";
import { DomainError } from "@/domain/shared/errors";
import { ZodValidationPipe } from "./zod.pipe";
import { CurrentUser, Public, type AuthUser } from "./auth/auth.decorators";
import type { AuctionStatus } from "@/domain/auction/auction-status";

// 입찰자는 토큰 주체로 고정 — body의 userId는 받지 않는다(타인 명의 입찰 차단, AC-3).
const placeBidSchema = z.object({
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
    @Inject(AUCTION_STREAM) private readonly stream: AuctionStreamPort,
  ) {}

  // 실시간 경매 업데이트 스트림(CUT-6). EventSource는 헤더를 못 실으므로 @Public —
  // 단 "신호"만 보낸다(민감정보 없음). 프론트는 신호 수신 시 인증된 상세를 다시 읽음.
  @Public()
  @Sse(":id/stream")
  liveStream(@Param("id") id: string): Observable<MessageEvent> {
    return this.stream.streamFor(id);
  }

  @Get()
  async list(
    @CurrentUser() user: AuthUser,
    @Query("status") status?: string,
    @Query("year") year?: string,
  ) {
    const parsed = status?.split(",").filter(Boolean) as
      | AuctionStatus[]
      | undefined;
    const y = year ? Number(year) : undefined;
    // 회사 스코프: super ADMIN(companyId=null)은 전 회사, 그 외는 자기 회사만.
    const companyId = user.role === "ADMIN" ? null : user.companyId;
    const opts: { status?: AuctionStatus[]; year?: number; companyId?: bigint | null } = { companyId };
    if (parsed) opts.status = parsed;
    if (y !== undefined && Number.isFinite(y)) opts.year = y;
    return this.listUC.execute(opts);
  }

  @Get(":id")
  async detail(@Param("id") id: string) {
    return this.detailUC.execute(id);
  }

  @Post(":id/bids")
  async placeBid(
    @Param("id") id: string,
    @CurrentUser() user: AuthUser,
    // Pipe is bound to @Body (NOT the method) on purpose: a method-level
    // @UsePipes would also run this object schema against the :id string param.
    @Body(new ZodValidationPipe(placeBidSchema)) body: z.infer<typeof placeBidSchema>,
  ) {
    try {
      return await this.placeBidUC.execute({
        auctionId: id,
        userId: user.userId, // 토큰 주체 = 입찰자 (body 신뢰 안 함)
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
