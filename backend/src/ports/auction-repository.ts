import type { Auction } from "../domain/auction/auction";
import type { AuctionId } from "../domain/shared/value-objects/auction-id";
import type { AuctionStatus } from "../domain/auction/auction-status";

export const AUCTION_REPOSITORY = Symbol("AuctionRepository");

export type AuctionListFilter = {
  status?: AuctionStatus | AuctionStatus[];
  /** 경매가 속한 연도(id가 A-YYYY-NNN이므로 id prefix로 필터). */
  year?: number;
  limit?: number;
};

export interface AuctionRepository {
  findById(id: AuctionId): Promise<Auction | null>;
  list(filter?: AuctionListFilter): Promise<Auction[]>;
  save(auction: Auction): Promise<void>;
  /** For ListMyActivity — count distinct auctions a user has bid on. */
  countAuctionsBidByUser(userId: bigint): Promise<number>;
  /** 관리자 — DRAFT/CREATED 매물 삭제. 풀 수집(LeavePoolRun)으로 만들어진
   *  매물은 protectedIds로 따로 분리해 삭제하지 않는다. */
  deleteCreated(
    ids: AuctionId[],
  ): Promise<{ deletedIds: string[]; skippedIds: string[]; protectedIds: string[] }>;
  /** 관리자 — 상태별 카운트. 모든 키 보장(0 포함). */
  countsByStatus(): Promise<Record<AuctionStatus, number>>;
  /** A-YYYY-NNN의 다음 NNN을 채번해 "A-YYYY-NNN" 반환(연도 내 max suffix + 1). */
  nextIdForYear(year: number): Promise<string>;
}
