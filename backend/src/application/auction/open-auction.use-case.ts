// OpenAuction — admin이 CREATED 경매를 즉시 OPEN으로 전환(설정 변경 동반 가능).
// 모달에서 leaveDays/startedAt/endsAt/startPrice/minIncrement를 바꿔 보내면
// configureBeforeOpen으로 적용 후 force-open(예약 시작 전이라도 즉시 OPEN).
// 이후 입찰 가능. settle은 endsAt이 지난 OPEN만 처리.

import { BadRequestException, Inject, Injectable, NotFoundException } from "@nestjs/common";
import { AUCTION_REPOSITORY, type AuctionRepository } from "@/ports/auction-repository";
import { AuctionId } from "@/domain/shared/value-objects/auction-id";
import { Point } from "@/domain/shared/value-objects/point";
import { DomainError } from "@/domain/shared/errors";

export type OpenAuctionInput = {
  startedAt?: Date | string;
  endsAt?: Date | string;
  startPrice?: bigint | number | string;
  leaveDays?: number | string;
  minIncrement?: bigint | number | string;
  force?: boolean; // 기본 true
};

export type OpenAuctionResult = {
  id: string;
  status: string;
  startedAt: Date;
  endsAt: Date;
  startPrice: string;
  leaveDays: number;
};

@Injectable()
export class OpenAuctionUseCase {
  constructor(
    @Inject(AUCTION_REPOSITORY) private readonly auctions: AuctionRepository,
  ) {}

  async execute(idRaw: string, input: OpenAuctionInput = {}): Promise<OpenAuctionResult> {
    const auctionId = AuctionId.of(idRaw);
    const auction = await this.auctions.findById(auctionId);
    if (!auction) throw new NotFoundException(`Auction ${idRaw} not found`);
    try {
      const hasAnyConfig =
        input.startedAt !== undefined ||
        input.endsAt !== undefined ||
        input.startPrice !== undefined ||
        input.leaveDays !== undefined ||
        input.minIncrement !== undefined;
      if (hasAnyConfig) {
        auction.configureBeforeOpen({
          startedAt: input.startedAt !== undefined ? new Date(input.startedAt) : undefined,
          endsAt: input.endsAt !== undefined ? new Date(input.endsAt) : undefined,
          startPrice: input.startPrice !== undefined ? Point.of(input.startPrice) : undefined,
          leaveDays: input.leaveDays !== undefined ? Number(input.leaveDays) : undefined,
          minIncrement: input.minIncrement !== undefined ? Point.of(input.minIncrement) : undefined,
        });
      }
      auction.open(new Date(), { force: input.force ?? true });
    } catch (e) {
      if (e instanceof DomainError) throw new BadRequestException((e as Error).message);
      if (e instanceof Error) throw new BadRequestException(e.message);
      throw e;
    }
    await this.auctions.save(auction);
    const snap = auction.snapshot();
    return {
      id: idRaw,
      status: snap.status,
      startedAt: snap.startedAt,
      endsAt: snap.endsAt,
      startPrice: snap.startPrice.toBigInt().toString(),
      leaveDays: snap.leaveDays,
    };
  }
}
