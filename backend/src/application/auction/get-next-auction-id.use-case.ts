// GetNextAuctionId — 수동 추가 모달에서 다음 채번 추천.
// "A-YYYY-NNN" 중 YYYY 내 max(NNN) + 1을 0-pad 3자리로.
import { Inject, Injectable } from "@nestjs/common";
import { AUCTION_REPOSITORY, type AuctionRepository } from "@/ports/auction-repository";

@Injectable()
export class GetNextAuctionIdUseCase {
  constructor(@Inject(AUCTION_REPOSITORY) private readonly auctions: AuctionRepository) {}

  async execute(year?: number): Promise<{ year: number; nextId: string }> {
    const y = year ?? new Date().getFullYear();
    const nextId = await this.auctions.nextIdForYear(y);
    return { year: y, nextId };
  }
}
