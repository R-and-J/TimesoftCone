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
}
