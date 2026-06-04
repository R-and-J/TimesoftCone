// ScheduleAuction — CREATED 매물의 운영 파라미터(예약 시간/일수/증분)만 갱신.
// OpenAuctionUseCase와 달리 상태를 바꾸지 않는다(여전히 CREATED).
// "오픈 예정" 모달에서 "예약 저장" 버튼이 호출 → 시간이 되면 OpenDueAuctionsScheduler가 OPEN.
// 시작가는 30,000 P 고정 정책(2026-06-02) — input.startPrice는 받기만 하고 무시한다.
import { BadRequestException, Inject, Injectable, NotFoundException } from "@nestjs/common";
import { AUCTION_REPOSITORY, type AuctionRepository } from "@/ports/auction-repository";
import { AuctionId } from "@/domain/shared/value-objects/auction-id";
import { Cone } from "@/domain/shared/value-objects/cone";
import { DomainError } from "@/domain/shared/errors";

export type ScheduleAuctionInput = {
  startedAt?: Date | string;
  endsAt?: Date | string;
  /** @deprecated 시작가는 30,000 P 고정 — 호환성을 위해 받지만 무시한다. */
  startPrice?: bigint | number | string;
  leaveDays?: number | string;
  minIncrement?: bigint | number | string;
};

export type ScheduleAuctionResult = {
  id: string;
  status: string;
  startedAt: Date;
  endsAt: Date;
  startPrice: string;
  leaveDays: number;
};

@Injectable()
export class ScheduleAuctionUseCase {
  constructor(@Inject(AUCTION_REPOSITORY) private readonly auctions: AuctionRepository) {}

  async execute(idRaw: string, input: ScheduleAuctionInput): Promise<ScheduleAuctionResult> {
    const auctionId = AuctionId.of(idRaw);
    const auction = await this.auctions.findById(auctionId);
    if (!auction) throw new NotFoundException(`Auction ${idRaw} not found`);
    try {
      // 시작가 포함 모든 설정 input 우선 — 정책 고정 해제(2026-06-04).
      auction.configureBeforeOpen({
        startedAt: input.startedAt !== undefined ? new Date(input.startedAt) : undefined,
        endsAt: input.endsAt !== undefined ? new Date(input.endsAt) : undefined,
        startPrice: input.startPrice !== undefined ? Cone.of(input.startPrice) : undefined,
        leaveDays: input.leaveDays !== undefined ? Number(input.leaveDays) : undefined,
        minIncrement: input.minIncrement !== undefined ? Cone.of(input.minIncrement) : undefined,
      });
      // DRAFT(보류) 매물에 시간 정해줬으면 CREATED로 승급(자동 OPEN 대상에 올림).
      auction.markScheduled();
    } catch (e) {
      if (e instanceof DomainError) throw new BadRequestException((e as Error).message);
      if (e instanceof Error) throw new BadRequestException(e.message);
      throw e;
    }
    await this.auctions.save(auction);
    const s = auction.snapshot();
    return {
      id: idRaw,
      status: s.status,
      startedAt: s.startedAt,
      endsAt: s.endsAt,
      startPrice: s.startPrice.toBigInt().toString(),
      leaveDays: s.leaveDays,
    };
  }
}
