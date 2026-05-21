// Backend query functions. All "money" fields are strings (bigint-as-string
// from the backend); UI does Number(x) at display.

import { apiGet, apiPost } from "./api";

export type AuctionStatus = "CREATED" | "OPEN" | "AWARDED" | "UNSOLD";

export type AuctionListItem = {
  id: string;
  status: AuctionStatus;
  startPrice: string;
  highest: string;
  highestBidder: string | null;
  bidCount: number;
  minIncrement: string;
  startedAt: string;
  endsAt: string;
};

export type AuctionDetailResponse = AuctionListItem & {
  recentBids: {
    userId: string;
    userName: string;
    amount: string;
    placedAt: string;
  }[];
};

export type PlaceBidResponse = {
  auctionId: string;
  newHighest: string;
  newBidCount: number;
  refundedTo: string | null;
  refundedAmount: string | null;
};

export type ActivityResponse = {
  history: {
    occurredAt: string;
    actionType: string;
    auctionId: string | null;
    amount: string;
    balanceAfter: string;
    refNote: string | null;
  }[];
  summary: {
    totalBids: number;
    totalWins: number;
    totalRefunds: number;
    activeAuctions: number;
  };
};

export type BalanceResponse = {
  userId: string;
  currency: string;
  balance: string;
};

export function listAuctions(status?: AuctionStatus[]) {
  const qs = status && status.length > 0 ? `?status=${status.join(",")}` : "";
  return apiGet<AuctionListItem[]>(`/auctions${qs}`);
}

export function getAuction(id: string) {
  return apiGet<AuctionDetailResponse>(`/auctions/${id}`);
}

export function placeBid(
  auctionId: string,
  userId: string | number,
  amount: number,
) {
  return apiPost<PlaceBidResponse>(`/auctions/${auctionId}/bids`, {
    userId,
    amount,
  });
}

export function getBalance(userId: string | number) {
  return apiGet<BalanceResponse>(`/users/${userId}/balance`);
}

export function getActivity(userId: string | number) {
  return apiGet<ActivityResponse>(`/users/${userId}/activity`);
}

export type LeaveResponse = {
  userId: string;
  regular: number;
  auction: number;
  event: number;
  total: number;
};

export function getLeave(userId: string | number) {
  return apiGet<LeaveResponse>(`/users/${userId}/leave`);
}

// ── Auth ──────────────────────────────────────────────────────────
export type LoginResponse = {
  userId: string;
  empId: string;
  name: string;
  role: "EMPLOYEE" | "ADMIN";
  team: string | null;
};

export function login(empId: string) {
  return apiPost<LoginResponse>("/auth/login", { empId });
}

// ── Dividend ──────────────────────────────────────────────────────
export type DividendStake = {
  userId: string;
  name: string;
  days: number;
  ratio: number;
  isMe: boolean;
};

export type MyDividendResponse = {
  userId: string;
  name: string;
  contributedDays: number;
  stakeRatio: number;
  rank: number | null;
  totalContributors: number;
  escrowBalance: string;
  myDividend: string;
  topStakes: DividendStake[];
};

export function getMyDividend(userId: string | number) {
  return apiGet<MyDividendResponse>(`/dividend/me/${userId}`);
}

// ── Admin ─────────────────────────────────────────────────────────
export type AdminStatsResponse = {
  escrowBalance: string;
  openAuctions: number;
  upcomingAuctions: number;
  unsoldAuctions: number;
  awardedToday: number;
  dlqDepth: number;
};

export function getAdminStats() {
  return apiGet<AdminStatsResponse>("/admin/stats");
}

export type LedgerActionType =
  | "BID"
  | "REFUND"
  | "WIN"
  | "DIVIDEND"
  | "CREDIT_ADMIN"
  | "EXPIRE";

export type LedgerRow = {
  id: string;
  occurredAt: string;
  userId: string;
  userName: string;
  currency: string;
  actionType: LedgerActionType;
  amount: string;
  balanceAfter: string;
  auctionId: string | null;
  refNote: string | null;
};

export type ListLedgerResponse = {
  rows: LedgerRow[];
  nextCursor: string | null;
  totalEstimate: number;
};

export function listLedger(params: {
  actionTypes?: LedgerActionType[];
  from?: string;
  to?: string;
  limit?: number;
  cursor?: string;
}) {
  const qs = new URLSearchParams();
  if (params.actionTypes && params.actionTypes.length > 0) {
    qs.set("actionTypes", params.actionTypes.join(","));
  }
  if (params.from) qs.set("from", params.from);
  if (params.to) qs.set("to", params.to);
  if (params.limit !== undefined) qs.set("limit", String(params.limit));
  if (params.cursor) qs.set("cursor", params.cursor);
  const tail = qs.toString();
  return apiGet<ListLedgerResponse>(`/admin/ledger${tail ? `?${tail}` : ""}`);
}
