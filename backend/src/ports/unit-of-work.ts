// UnitOfWork — abstracts "do these repository writes in one DB transaction".
// Use cases that need to atomically write across Wallet + Ledger + Auction
// depend on this port (not on Prisma directly), preserving ADR-012.
//
// scope-cuts.md CUT-1: lockAuction() serializes bids on the same auction. The
// SQLite adapter takes the database write lock via a no-op UPDATE; a future
// adapter could swap the lock strategy without touching the use case.

import type { AuctionId } from "../domain/shared/value-objects/auction-id";
import type { WalletRepository } from "./wallet-repository";
import type { LedgerRepository } from "./ledger-repository";
import type { AuctionRepository } from "./auction-repository";

export const UNIT_OF_WORK = Symbol("UnitOfWork");

export interface TxContext {
  wallets: WalletRepository;
  ledger: LedgerRepository;
  auctions: AuctionRepository;
  /** Append a BidEvent row (audit log of accepted bids). */
  recordBid(input: { auctionId: AuctionId; userId: bigint; amount: bigint }): Promise<void>;
  /** 멀티테넌시: 경매가 속한 회사 id(없으면 null). 입찰 전 타사 경매 차단 검증용. */
  auctionCompanyId(auctionId: AuctionId): Promise<bigint | null>;
  /**
   * Serialize concurrent bids on this auction for the duration of the
   * transaction (SQLite write lock via a no-op UPDATE). Auto-released on
   * commit/rollback.
   */
  lockAuction(auctionId: AuctionId): Promise<void>;
  /**
   * Credit AUCTION-type leave to the winner in the same transaction as
   * auction settlement (ADR-016 leave master, ADR-002 3-flag). Upserts
   * leave_balance(userId, year, AUCTION).adjustedDays += days.
   */
  grantAuctionLeave(input: { userId: bigint; year: number; days: number }): Promise<void>;
  /**
   * Append a transactional Outbox message in the SAME transaction as the
   * domain change (ADR-005/013). A relay worker delivers it to the external
   * system later, with retry/DLQ. External calls go through here, never inline.
   */
  enqueueOutbox(input: { topic: string; payload: unknown }): Promise<void>;
}

export interface UnitOfWork {
  run<T>(fn: (ctx: TxContext) => Promise<T>): Promise<T>;
}
