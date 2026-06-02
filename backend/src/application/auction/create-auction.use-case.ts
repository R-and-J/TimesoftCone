// CreateAuction — 관리자가 1일권 매물 N개를 같은 조건으로 일괄 생성.
// ADR-007 1일권 고정 정책에 맞춰 leaveDays는 항상 1, "N일권 1개" 대신
// "1일권 N개"로 표현. ID는 서버가 nextIdForYear로 자동 채번(사용자 수정 불가).
// 시작가도 30,000 P 고정 정책(2026-06-02) — input.startPrice는 받기만 하고 무시한다.

import { Inject, Injectable } from "@nestjs/common";
import { AUCTION_REPOSITORY, type AuctionRepository } from "@/ports/auction-repository";
import { Auction } from "@/domain/auction/auction";
import { AuctionId } from "@/domain/shared/value-objects/auction-id";
import { Point } from "@/domain/shared/value-objects/point";

/** 시작가 30,000 P 고정. 모든 매물(수동 생성·LeavePool 폴백 제외)에 강제. */
const FIXED_START_PRICE = 30000n;

export type CreateAuctionInput = {
  /** 1일권 발행 수량(기본 1). */
  quantity?: number | string;
  /** @deprecated 시작가는 30,000 P 고정 — 호환성을 위해 받지만 무시한다. */
  startPrice?: bigint | number | string;
  minIncrement?: bigint | number | string;
  /** 보류(DRAFT) 모드 — 오픈 스케줄 미정. true면 startedAt/endsAt 무시. */
  asDraft?: boolean;
  startedAt?: Date | string;
  endsAt?: Date | string;
  /** 멀티테넌시: 매물이 속할 회사. 생략/ null(super 전체) 시 EZPASS(1). */
  companyId?: bigint | null;
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

    // 시작가는 input과 무관하게 항상 30,000 P(정책 고정).
    const startPrice = Point.of(FIXED_START_PRICE);
    const minIncrement = Point.of(input.minIncrement ?? 100);
    // super ADMIN이 "전체"로 만들면 회사 미상 → EZPASS(1) 기본.
    const companyId = input.companyId ?? 1n;

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
      await this.auctions.save(auction, companyId);
      ids.push(id);
    }
    return { ids, created: ids.length };
  }
}
