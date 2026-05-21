// ADR-010 BiddingCurrency — the only surface the auction/bid code sees when
// touching points. Implementations debit/credit a wallet AND append the
// matching ledger entry inside the same DB transaction (ADR-018 invariant 6).
//
// Note: this interface does not include payout() — that lives on a separate
// PayoutChannel port (year-end dividend, future PR).

import type { Point } from "../domain/shared/value-objects/point";
import type { UserId } from "../domain/shared/value-objects/user-id";
import type { TransactionRef } from "../domain/ledger/transaction-ref";

export const BIDDING_CURRENCY = Symbol("BiddingCurrency");

export interface BiddingCurrency {
  readonly currencyCode: string;

  getBalance(userId: UserId): Promise<Point>;

  /** Atomic: wallet debit + ledger INSERT. Throws if balance < amount. */
  debit(userId: UserId, amount: Point, ref: TransactionRef): Promise<void>;

  /** Atomic: wallet credit + ledger INSERT. Used for REFUND and CREDIT_ADMIN. */
  credit(userId: UserId, amount: Point, ref: TransactionRef): Promise<void>;
}
