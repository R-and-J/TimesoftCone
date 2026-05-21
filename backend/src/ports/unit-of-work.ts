// UnitOfWork — abstracts "do these repository writes in one DB transaction".
// Use cases that need to atomically write across Wallet + Ledger + Auction
// depend on this port (not on Prisma directly), preserving ADR-012.
//
// scope-cuts.md CUT-1: lockAuction() uses pg_advisory_xact_lock(hashtext(id))
// in the Prisma adapter. Future Redis-backed implementations can replace it
// without touching the use case.

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
  /**
   * Acquire an advisory lock keyed on the auction ID for the duration of
   * this transaction. Auto-released on commit/rollback.
   */
  lockAuction(auctionId: AuctionId): Promise<void>;
}

export interface UnitOfWork {
  run<T>(fn: (ctx: TxContext) => Promise<T>): Promise<T>;
}
