// GetAuctionDetail — auction detail page (★ screen).
// Includes the recent bid history (up to N entries) so the frontend can
// render the right-column table without a second round-trip.

import { Inject, Injectable, NotFoundException } from "@nestjs/common";
import { AUCTION_REPOSITORY, type AuctionRepository } from "@/ports/auction-repository";
import { AuctionId } from "@/domain/shared/value-objects/auction-id";
import { PrismaService } from "@/adapters/persistence/prisma.service";
import type { AuctionStatus } from "@/domain/auction/auction-status";

export type AuctionDetail = {
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
  recentBids: { userId: bigint; userName: string; amount: bigint; placedAt: Date }[];
};

@Injectable()
export class GetAuctionDetailUseCase {
  constructor(
    @Inject(AUCTION_REPOSITORY) private readonly auctions: AuctionRepository,
    // Reaching into Prisma just for the bid-history projection. We could add
    // a BidEventRepository port but the read is purely a UI projection and
    // doesn't change domain state, so we keep the indirection low.
    private readonly prisma: PrismaService,
  ) {}

  async execute(idRaw: string, limit = 20): Promise<AuctionDetail> {
    const id = AuctionId.of(idRaw);
    const auction = await this.auctions.findById(id);
    if (!auction) {
      throw new NotFoundException(`Auction ${idRaw} not found`);
    }
    const s = auction.snapshot();

    const bids = await this.prisma.bidEvent.findMany({
      where: { auctionId: idRaw },
      orderBy: { placedAt: "desc" },
      take: limit,
      include: { user: { select: { id: true, name: true } } },
    });

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
      recentBids: bids.map((b) => ({
        userId: b.user.id,
        userName: b.user.name,
        amount: b.amount,
        placedAt: b.placedAt,
      })),
    };
  }
}
