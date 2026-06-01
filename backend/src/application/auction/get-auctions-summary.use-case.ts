// GetAuctionsSummary — 관리자 "경매관리" 카운터.
// 총 / 오픈 예정(CREATED) / 진행 중(OPEN) / 종료(AWARDED+UNSOLD)를 합산.
import { Inject, Injectable } from "@nestjs/common";
import { AUCTION_REPOSITORY, type AuctionRepository } from "@/ports/auction-repository";

export type AuctionsSummary = {
  total: number;
  draft: number; // DRAFT — 매물 있음, 오픈 스케줄 미정(보류)
  upcoming: number; // CREATED
  open: number;
  ended: number; // AWARDED + UNSOLD
  byStatus: { DRAFT: number; CREATED: number; OPEN: number; AWARDED: number; UNSOLD: number };
};

@Injectable()
export class GetAuctionsSummaryUseCase {
  constructor(@Inject(AUCTION_REPOSITORY) private readonly auctions: AuctionRepository) {}

  async execute(): Promise<AuctionsSummary> {
    const c = await this.auctions.countsByStatus();
    return {
      total: c.DRAFT + c.CREATED + c.OPEN + c.AWARDED + c.UNSOLD,
      draft: c.DRAFT,
      upcoming: c.CREATED,
      open: c.OPEN,
      ended: c.AWARDED + c.UNSOLD,
      byStatus: c,
    };
  }
}
