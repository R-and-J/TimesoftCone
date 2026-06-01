// CancelAuctions — 관리자 "오픈 예정" 매물을 다중 취소(삭제).
// CREATED 매물에 한해 row 삭제. OPEN 이상은 입찰이 들어갔거나 진행 중이므로
// 영구 보존(skipped로 응답에 표기). 학교 프로젝트 단순화: 풀 Stake와의 일관성은
// 디스플레이 카운터 차이로 드러나며, 감사 목적의 leave_pool_run 행은 그대로.
import { Inject, Injectable } from "@nestjs/common";
import { AUCTION_REPOSITORY, type AuctionRepository } from "@/ports/auction-repository";
import { AuctionId } from "@/domain/shared/value-objects/auction-id";

export type CancelAuctionsResult = {
  requested: number;
  deletedIds: string[];
  skippedIds: string[];
  /** 풀 수집으로 생성된 매물 — 보호되어 삭제되지 않음. */
  protectedIds: string[];
};

@Injectable()
export class CancelAuctionsUseCase {
  constructor(@Inject(AUCTION_REPOSITORY) private readonly auctions: AuctionRepository) {}

  async execute(ids: string[]): Promise<CancelAuctionsResult> {
    if (ids.length === 0) return { requested: 0, deletedIds: [], skippedIds: [], protectedIds: [] };
    const auctionIds = ids.map((i) => AuctionId.of(i));
    const r = await this.auctions.deleteCreated(auctionIds);
    return {
      requested: ids.length,
      deletedIds: r.deletedIds,
      skippedIds: r.skippedIds,
      protectedIds: r.protectedIds,
    };
  }
}
