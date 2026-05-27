// Backend query functions. All "money" fields are strings (bigint-as-string
// from the backend); UI does Number(x) at display.

import { apiGet, apiPost, apiPatch } from "./api";

export type AuctionStatus = "CREATED" | "OPEN" | "AWARDED" | "UNSOLD";

export type AuctionListItem = {
  id: string;
  status: AuctionStatus;
  startPrice: string;
  highest: string;
  highestBidder: string | null;
  bidCount: number;
  minIncrement: string;
  /** 낙찰 시 받는 AUCTION 연차 일수. */
  leaveDays: number;
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
// 중앙 인증 위임(ADR-019): 이메일(id)+비밀번호를 우리 백엔드로 보내면,
// 백엔드가 사내 ezpass 로그인 API에 검증을 위임한다.
export type LoginResponse = {
  userId: string;
  empId: string;
  name: string;
  role: "EMPLOYEE" | "ADMIN";
  team: string | null;
  jobRank: string | null;
  jobTitle: string | null;
  email: string | null;
  provisioned: boolean;
};

export function login(id: string, password: string, cmpnyNo?: string) {
  return apiPost<LoginResponse>("/auth/login", { id, password, cmpnyNo });
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

// ── Members (회원관리) ─────────────────────────────────────────────
// 위임형(ezpass): ezpass 미러 → 읽기전용 + 동기화. 자립형(local): CRUD. (ADR-022)
export type MemberRow = {
  userId: string;
  empId: string;
  name: string;
  email: string | null;
  team: string | null;
  jobRank: string | null;
  jobTitle: string | null;
  role: "EMPLOYEE" | "ADMIN";
  active: boolean;
};

export type MemberListResponse = {
  mode: "ezpass" | "local";
  source: "ezpass-mirror" | "local";
  total: number;
  admins: number;
  members: MemberRow[];
};

export type SyncMembersResponse = {
  synced: number;
  created: number;
  updated: number;
  total: number;
  at: string;
  errors: string[];
};

export function listMembers() {
  return apiGet<MemberListResponse>("/admin/members");
}

export function syncMembers() {
  return apiPost<SyncMembersResponse>("/admin/members/sync", {});
}

// 자립형(local) 전용 CRUD — 위임형에선 백엔드가 409로 거부.
export type CreateMemberInput = {
  email: string;
  name: string;
  password: string;
  role: "EMPLOYEE" | "ADMIN";
  empId?: string;
  team?: string | null;
  jobRank?: string | null;
  jobTitle?: string | null;
};

export type UpdateMemberInput = {
  name?: string;
  role?: "EMPLOYEE" | "ADMIN";
  team?: string | null;
  jobRank?: string | null;
  jobTitle?: string | null;
  active?: boolean;
  password?: string;
};

export function createMember(input: CreateMemberInput) {
  return apiPost<MemberRow>("/admin/members", input);
}

export function updateMember(userId: string, input: UpdateMemberInput) {
  return apiPatch<MemberRow>(`/admin/members/${userId}`, input);
}

// ── Notifications (종 아이콘 피드 — ADR-013 Observer 구독 결과) ──────
export type NotificationItem = {
  id: string;
  type: "OUTBID" | "AUCTION_WON";
  title: string;
  message: string;
  auctionId: string | null;
  read: boolean;
  createdAt: string;
};

export type NotificationListResponse = {
  unread: number;
  items: NotificationItem[];
};

export function listNotifications(userId: string | number) {
  return apiGet<NotificationListResponse>(`/users/${userId}/notifications`);
}

export function markNotificationsRead(userId: string | number, ids?: string[]) {
  return apiPost<{ updated: number }>(`/users/${userId}/notifications/read`, ids ? { ids } : {});
}
