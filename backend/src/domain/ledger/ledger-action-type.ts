// The ledger action types (stored as a TEXT column on SQLite — no DB enum).
// Each action type also implies a sign convention that the adapter can verify:
//   credit (positive amount): REFUND, WIN-payout, DIVIDEND, CREDIT_ADMIN, REDEEM_REFUND
//   debit  (negative amount): BID, EXPIRE, REDEEM
// WIN is special — see ADR-018 for the settlement rules.
// REDEEM/REDEEM_REFUND — 자립형 배포 콘 소모(ADR-023).

export const LEDGER_ACTION_TYPES = [
  "BID",
  "REFUND",
  "WIN",
  "DIVIDEND",
  "CREDIT_ADMIN",
  "EXPIRE",
  "REDEEM",
  "REDEEM_REFUND",
  // 충전 요청 라이프사이클 감사 entry — 잔액은 안 바꾸고 흐름만 기록.
  "CHARGE_REQUESTED",
  "CHARGE_REJECTED",
] as const;

export type LedgerActionType = (typeof LEDGER_ACTION_TYPES)[number];

export function isCreditAction(t: LedgerActionType): boolean {
  return t === "REFUND" || t === "DIVIDEND" || t === "CREDIT_ADMIN" || t === "REDEEM_REFUND";
}

export function isDebitAction(t: LedgerActionType): boolean {
  return t === "BID" || t === "EXPIRE" || t === "REDEEM";
}
