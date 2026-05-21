// WalletRepository — port to load and persist Wallet aggregates.
// Implementations live in adapters/persistence/.
//
// Concurrency note: ADR-006 prescribes Redis distributed locks for the bid
// path. This repository assumes the caller has acquired any required lock
// before calling save().

import type { Wallet } from "../domain/wallet/wallet";
import type { Currency } from "../domain/shared/value-objects/currency";
import type { UserId } from "../domain/shared/value-objects/user-id";

export const WALLET_REPOSITORY = Symbol("WalletRepository");

export interface WalletRepository {
  /** Returns null if the user has no wallet for this currency yet. */
  find(userId: UserId, currency: Currency): Promise<Wallet | null>;

  /** Insert if absent, update balance if present. Caller manages concurrency. */
  save(wallet: Wallet): Promise<void>;
}
