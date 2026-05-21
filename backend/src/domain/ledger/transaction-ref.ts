// ADR-010 TransactionRef — carried alongside every BiddingCurrency call so the
// ledger row knows WHY a debit/credit happened. Pure data, no behavior.

import type { LedgerActionType } from "./ledger-action-type";

export type TransactionRef = {
  actionType: LedgerActionType;
  auctionId?: string;
  reason?: string;
};
