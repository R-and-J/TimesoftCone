// ListAuctions — for the auction list pages (Grid / Row / Timeline).

import { Inject, Injectable } from "@nestjs/common";
import { AUCTION_REPOSITORY, type AuctionRepository } from "@/ports/auction-repository";
import type { AuctionStatus } from "@/domain/auction/auction-status";
import { PrismaService } from "@/adapters/persistence/prisma.service";

export type AuctionListItem = {
  id: string;
  status: AuctionStatus;
  startPrice: bigint;
  highest: bigint;
  highestBidder: bigint | null;
  /** 최고가 입찰자(OPEN) 또는 낙찰자(AWARDED) 이름 — 없으면 null. */
  highestBidderName: string | null;
  bidCount: number;
  minIncrement: bigint;
  leaveDays: number;
  startedAt: Date;
  endsAt: Date;
  /** 정산(낙찰/유찰) 시각 — 마감 카드 표시에 사용. AWARDED/UNSOLD만 채움. */
  settledAt: Date | null;
};

@Injectable()
export class ListAuctionsUseCase {
  constructor(
    @Inject(AUCTION_REPOSITORY) private readonly auctions: AuctionRepository,
    private readonly prisma: PrismaService,
  ) {}

  async execute(
    filter?: { status?: AuctionStatus | AuctionStatus[]; year?: number; limit?: number; companyId?: bigint | null },
  ): Promise<AuctionListItem[]> {
    const auctions = await this.auctions.list(filter);
    // 한 번의 batch 쿼리로 highestBidder id → name 매핑(N+1 회피).
    const bidderIds = Array.from(
      new Set(
        auctions
          .map((a) => a.snapshot().highestBidder?.toBigInt())
          .filter((v): v is bigint => v !== undefined && v !== null),
      ),
    );
    const users = bidderIds.length > 0
      ? await this.prisma.user.findMany({
          where: { id: { in: bidderIds } },
          select: { id: true, name: true },
        })
      : [];
    const nameById = new Map<bigint, string>();
    for (const u of users) nameById.set(u.id, u.name);

    return auctions.map((a) => {
      const s = a.snapshot();
      const bidderId = s.highestBidder?.toBigInt() ?? null;
      return {
        id: s.id.toString(),
        status: s.status,
        startPrice: s.startPrice.toBigInt(),
        highest: s.highest.toBigInt(),
        highestBidder: bidderId,
        highestBidderName: bidderId !== null ? nameById.get(bidderId) ?? null : null,
        bidCount: s.bidCount,
        minIncrement: s.minIncrement.toBigInt(),
        leaveDays: s.leaveDays,
        startedAt: s.startedAt,
        endsAt: s.endsAt,
        settledAt: s.settledAt,
      };
    });
  }
}
