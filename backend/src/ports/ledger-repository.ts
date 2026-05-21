// LedgerRepository — append-only. There is NO update() or delete() on this
// interface by design (CLAUDE.md DB-RULE-1). Corrections happen via new
// compensating INSERTs (REFUND / CREDIT_ADMIN).

import type { LedgerEntry } from "../domain/ledger/ledger-entry";

export const LEDGER_REPOSITORY = Symbol("LedgerRepository");

export interface LedgerRepository {
  append(entry: LedgerEntry): Promise<void>;
}
