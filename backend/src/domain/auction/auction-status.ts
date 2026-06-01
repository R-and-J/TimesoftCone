// scope-cuts.md CUT-3 — we chose a status enum + guard clauses inside Auction
// methods instead of the ADR-014 State Pattern. If state-specific method sets
// ever diverge significantly, revisit.
//
// DRAFT(보류): 매물은 만들었지만 오픈 스케줄이 잡히지 않은 상태. 자동 OPEN 대상이
// 아니다. 관리자가 schedule()로 시간 정해 CREATED로 보내거나 open(force=true)로 즉시 OPEN.

export const AUCTION_STATUSES = ["DRAFT", "CREATED", "OPEN", "AWARDED", "UNSOLD"] as const;
export type AuctionStatus = (typeof AUCTION_STATUSES)[number];
