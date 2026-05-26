// ListAuctions — for the auction list pages (Grid / Row / Timeline).

import { Inject, Injectable } from "@nestjs/common";
import { AUCTION_REPOSITORY, type AuctionRepository } from "@/ports/auction-repository";
import type { AuctionStatus } from "@/domain/auction/auction-status";

export type AuctionListItem = {
  id: string;
  status: AuctionStatus;
  startPrice: bigint;
  highest: bigint;
  highestBidder: bigint | null;
  bidCount: number;
  minIncrement: bigint;
  leaveDays: number;
  startedAt: Date;
  endsAt: Date;
};

@Injectable()
export class ListAuctionsUseCase {
  constructor(
    @Inject(AUCTION_REPOSITORY) private readonly auctions: AuctionRepository,
  ) {}

  async execute(filter?: { status?: AuctionStatus | AuctionStatus[]; limit?: number }): Promise<AuctionListItem[]> {
    const auctions = await this.auctions.list(filter);
    return auctions.map((a) => {
      const s = a.snapshot();
      return {
        id: s.id.toString(),
        status: s.status,
        startPrice: s.startPrice.toBigInt(),
        highest: s.highest.toBigInt(),
        highestBidder: s.highestBidder?.toBigInt() ?? null,
        bidCount: s.bidCount,
        minIncrement: s.minIncrement.toBigInt(),
        leaveDays: s.leaveDays,
        startedAt: s.startedAt,
        endsAt: s.endsAt,
      };
    });
  }
}
