// scope-cuts.md CUT-3 — we chose a status enum + guard clauses inside Auction
// methods instead of the ADR-014 State Pattern. If state-specific method sets
// ever diverge significantly, revisit.

export const AUCTION_STATUSES = ["CREATED", "OPEN", "AWARDED", "UNSOLD"] as const;
export type AuctionStatus = (typeof AUCTION_STATUSES)[number];
