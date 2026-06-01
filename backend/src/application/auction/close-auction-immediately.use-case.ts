// CloseAuctionImmediately — 관리자가 OPEN 매물의 endsAt을 now로 당기고 즉시 정산.
// 도메인 메서드(adminAdjustDeadline)로 마감 시각을 now로 박은 뒤 SettleAuctionUseCase를
// 그대로 재사용해 정산 흐름(낙찰/유찰 + WIN ledger + AuctionWonEvent)을 한 줄로 이어붙인다.
import { BadRequestException, Inject, Injectable, NotFoundException } from "@nestjs/common";
import { AUCTION_REPOSITORY, type AuctionRepository } from "@/ports/auction-repository";
import { AuctionId } from "@/domain/shared/value-objects/auction-id";
import { DomainError } from "@/domain/shared/errors";
import { SettleAuctionUseCase, type SettleAuctionResult } from "./settle-auction.use-case";

@Injectable()
export class CloseAuctionImmediatelyUseCase {
  constructor(
    @Inject(AUCTION_REPOSITORY) private readonly auctions: AuctionRepository,
    private readonly settleUC: SettleAuctionUseCase,
  ) {}

  async execute(idRaw: string): Promise<SettleAuctionResult> {
    const auctionId = AuctionId.of(idRaw);
    const auction = await this.auctions.findById(auctionId);
    if (!auction) throw new NotFoundException(`Auction ${idRaw} not found`);
    const now = new Date();
    try {
      // newEndsAt <= now → endsAt을 now로 박음(즉시 마감 준비).
      auction.adminAdjustDeadline(now, now);
    } catch (e) {
      if (e instanceof DomainError) throw new BadRequestException((e as Error).message);
      if (e instanceof Error) throw new BadRequestException(e.message);
      throw e;
    }
    await this.auctions.save(auction);
    return await this.settleUC.execute(idRaw);
  }
}
