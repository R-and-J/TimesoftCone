// ExtendAuctionDeadline — 관리자가 OPEN 매물의 마감 시각을 늘린다.
// 입찰자 보호: 앞으로 당기는 건 막음(즉시 마감은 CloseAuctionImmediatelyUseCase로).
import { BadRequestException, Inject, Injectable, NotFoundException } from "@nestjs/common";
import { AUCTION_REPOSITORY, type AuctionRepository } from "@/ports/auction-repository";
import { AuctionId } from "@/domain/shared/value-objects/auction-id";
import { DomainError } from "@/domain/shared/errors";

export type ExtendDeadlineInput = { endsAt: Date | string };
export type ExtendDeadlineResult = { id: string; endsAt: Date };

@Injectable()
export class ExtendAuctionDeadlineUseCase {
  constructor(@Inject(AUCTION_REPOSITORY) private readonly auctions: AuctionRepository) {}

  async execute(idRaw: string, input: ExtendDeadlineInput): Promise<ExtendDeadlineResult> {
    const auctionId = AuctionId.of(idRaw);
    const auction = await this.auctions.findById(auctionId);
    if (!auction) throw new NotFoundException(`Auction ${idRaw} not found`);
    const newEndsAt = new Date(input.endsAt);
    const now = new Date();
    if (newEndsAt <= now) {
      throw new BadRequestException("연장은 미래 시각만 가능합니다 (즉시 마감은 close-now 사용)");
    }
    try {
      auction.adminAdjustDeadline(newEndsAt, now);
    } catch (e) {
      if (e instanceof DomainError) throw new BadRequestException((e as Error).message);
      if (e instanceof Error) throw new BadRequestException(e.message);
      throw e;
    }
    await this.auctions.save(auction);
    return { id: idRaw, endsAt: auction.endsAt };
  }
}
