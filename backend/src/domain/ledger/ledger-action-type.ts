// The ledger action types (stored as a TEXT column on SQLite — no DB enum).
// Each action type also implies a sign convention that the adapter can verify:
//   credit (positive amount): REFUND, WIN-payout, DIVIDEND, CREDIT_ADMIN
//   debit  (negative amount): BID, EXPIRE
// WIN is special — see ADR-018 for the settlement rules.

export const LEDGER_ACTION_TYPES = [
  "BID",
  "REFUND",
  "WIN",
  "DIVIDEND",
  "CREDIT_ADMIN",
  "EXPIRE",
] as const;

export type LedgerActionType = (typeof LEDGER_ACTION_TYPES)[number];

export function isCreditAction(t: LedgerActionType): boolean {
  return t === "REFUND" || t === "DIVIDEND" || t === "CREDIT_ADMIN";
}

export function isDebitAction(t: LedgerActionType): boolean {
  return t === "BID" || t === "EXPIRE";
}
