// CreateAuction — admin creates a new auction in CREATED status.
// No RBAC yet (scope-cuts.md CUT-8).

import { Inject, Injectable } from "@nestjs/common";
import { AUCTION_REPOSITORY, type AuctionRepository } from "@/ports/auction-repository";
import { Auction } from "@/domain/auction/auction";
import { AuctionId } from "@/domain/shared/value-objects/auction-id";
import { Point } from "@/domain/shared/value-objects/point";

export type CreateAuctionInput = {
  id: string;
  startPrice: bigint | number | string;
  minIncrement?: bigint | number | string;
  /** 낙찰자에게 부여할 AUCTION 연차 일수 (기본 1). */
  leaveDays?: number | string;
  startedAt: Date | string;
  endsAt: Date | string;
};

@Injectable()
export class CreateAuctionUseCase {
  constructor(
    @Inject(AUCTION_REPOSITORY) private readonly auctions: AuctionRepository,
  ) {}

  async execute(input: CreateAuctionInput): Promise<{ id: string }> {
    const auction = Auction.create({
      id: AuctionId.of(input.id),
      startPrice: Point.of(input.startPrice),
      minIncrement: Point.of(input.minIncrement ?? 100),
      leaveDays: Number(input.leaveDays ?? 1),
      startedAt: new Date(input.startedAt),
      endsAt: new Date(input.endsAt),
    });
    await this.auctions.save(auction);
    return { id: auction.id.toString() };
  }
}
