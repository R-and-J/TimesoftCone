// CreateAuction — 관리자가 1일권 매물 N개를 같은 조건으로 일괄 생성.
// ADR-007 1일권 고정 정책에 맞춰 leaveDays는 항상 1, "N일권 1개" 대신
// "1일권 N개"로 표현. ID는 서버가 nextIdForYear로 자동 채번(사용자 수정 불가).

import { Inject, Injectable } from "@nestjs/common";
import { AUCTION_REPOSITORY, type AuctionRepository } from "@/ports/auction-repository";
import { Auction } from "@/domain/auction/auction";
import { AuctionId } from "@/domain/shared/value-objects/auction-id";
import { Point } from "@/domain/shared/value-objects/point";

export type CreateAuctionInput = {
  /** 1일권 발행 수량(기본 1). */
  quantity?: number | string;
  startPrice: bigint | number | string;
  minIncrement?: bigint | number | string;
  /** 보류(DRAFT) 모드 — 오픈 스케줄 미정. true면 startedAt/endsAt 무시. */
  asDraft?: boolean;
  startedAt?: Date | string;
  endsAt?: Date | string;
};

export type CreateAuctionResult = {
  ids: string[];
  created: number;
};

@Injectable()
export class CreateAuctionUseCase {
  constructor(
    @Inject(AUCTION_REPOSITORY) private readonly auctions: AuctionRepository,
  ) {}

  async execute(input: CreateAuctionInput): Promise<CreateAuctionResult> {
    const quantity = Math.max(1, Math.floor(Number(input.quantity ?? 1)));
    if (!Number.isFinite(quantity) || quantity > 1000) {
      throw new Error("quantity는 1~1000 사이여야 합니다");
    }

    const asDraft = !!input.asDraft;
    if (!asDraft && (!input.startedAt || !input.endsAt)) {
      throw new Error("예약 생성에는 startedAt/endsAt가 필요합니다 (asDraft=true면 생략 가능)");
    }
    const startedAt = asDraft ? new Date() : new Date(input.startedAt!);
    const endsAt = asDraft ? new Date(Date.now() + 1) : new Date(input.endsAt!);

    // 채번 연도: DRAFT는 오늘 연도, 예약은 startedAt 연도.
    const year = asDraft ? new Date().getFullYear() : startedAt.getFullYear();
    const startedId = await this.auctions.nextIdForYear(year);
    const prefix = `A-${year}-`;
    const startNum = Number.parseInt(startedId.slice(prefix.length), 10);

    const startPrice = Point.of(input.startPrice);
    const minIncrement = Point.of(input.minIncrement ?? 100);

    const ids: string[] = [];
    for (let i = 0; i < quantity; i++) {
      const id = `${prefix}${String(startNum + i).padStart(3, "0")}`;
      const auction = asDraft
        ? Auction.createDraft({
            id: AuctionId.of(id),
            startPrice,
            minIncrement,
            leaveDays: 1, // ADR-007 1일권 고정.
          })
        : Auction.create({
            id: AuctionId.of(id),
            startPrice,
            minIncrement,
            leaveDays: 1,
            startedAt,
            endsAt,
          });
      await this.auctions.save(auction);
      ids.push(id);
    }
    return { ids, created: ids.length };
  }
}
