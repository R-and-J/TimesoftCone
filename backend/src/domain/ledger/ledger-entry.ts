// LedgerEntry — append-only log row. Constructed by domain services and handed
// to LedgerRepository.append() which INSERTs. Never updated, never deleted
// (CLAUDE.md DB-RULE-1, enforced by Postgres trigger).

import { Currency } from "../shared/value-objects/currency";
import { Cone } from "../shared/value-objects/cone";
import { UserId } from "../shared/value-objects/user-id";
import type { LedgerActionType } from "./ledger-action-type";

export type LedgerEntryProps = {
  userId: UserId;
  currency: Currency;
  actionType: LedgerActionType;
  /** Signed amount. Positive = credit, negative = debit. */
  amount: bigint;
  /** Wallet balance after this entry has been applied — snapshotted for audit. */
  balanceAfter: Cone;
  auctionId?: string;
  refNote?: string;
};

export class LedgerEntry {
  private constructor(readonly props: LedgerEntryProps) {}

  static create(props: LedgerEntryProps): LedgerEntry {
    if (props.actionType === "CREDIT_ADMIN" && !props.refNote) {
      // Mirrors the DB check constraint so the failure surfaces at the
      // domain boundary instead of as a Postgres error.
      throw new Error("CREDIT_ADMIN requires a non-empty refNote");
    }
    return new LedgerEntry(props);
  }
}
