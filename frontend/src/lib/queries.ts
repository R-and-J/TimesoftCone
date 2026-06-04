// Backend query functions. All "money" fields are strings (bigint-as-string
// from the backend); UI does Number(x) at display.

import { apiGet, apiPost, apiPatch } from "./api";

export type AuctionStatus = "DRAFT" | "CREATED" | "OPEN" | "AWARDED" | "UNSOLD";

export type AuctionListItem = {
  id: string;
  status: AuctionStatus;
  startPrice: string;
  highest: string;
  highestBidder: string | null;
  /** 최고가 입찰자(OPEN) / 낙찰자(AWARDED) 이름. 없으면 null. */
  highestBidderName: string | null;
  bidCount: number;
  minIncrement: string;
  /** 낙찰 시 받는 AUCTION 연차 일수. */
  leaveDays: number;
  startedAt: string;
  endsAt: string;
  /** 정산 시각(AWARDED/UNSOLD). 그 외 null. */
  settledAt: string | null;
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
  /** anti-snipe(CUT-5)로 마감이 연장됐으면 true. */
  extended: boolean;
  /** 현재(연장 반영) 마감 시각 ISO. */
  endsAt: string;
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

export function listAuctions(status?: AuctionStatus[], year?: number) {
  const qs = new URLSearchParams();
  if (status && status.length > 0) qs.set("status", status.join(","));
  if (year !== undefined) qs.set("year", String(year));
  const tail = qs.toString();
  return apiGet<AuctionListItem[]>(`/auctions${tail ? `?${tail}` : ""}`);
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
  role: "ADMIN" | "EZPASS_ADMIN" | "EXAM_ADMIN" | "EZPASS" | "EXAM";
  team: string | null;
  jobRank: string | null;
  jobTitle: string | null;
  email: string | null;
  /** 소속 회사 id(멀티테넌시). super ADMIN은 null. */
  companyId: string | null;
  /** 소속 회사 코드("EZPASS"|"EXAM"). super는 null. */
  companyCode: string | null;
  provisioned: boolean;
  /** 자체 발급 JWT(RBAC) — 이후 모든 요청에 Bearer로 붙인다. */
  token: string;
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

// 연말 배당 실지급 배치(ADMIN) — dryRun=true면 미리보기(지급 안 함),
// false면 실제 지급. 멱등: 이미 정산됐으면 백엔드가 409. (ADR-008)
export type DividendLine = {
  userId: string;
  name: string;
  contributedDays: number;
  stakeRatio: number;
  amount: string;
  isTopStake: boolean;
};

export type SettleDividendResponse = {
  year: number;
  dryRun: boolean;
  alreadySettled: boolean;
  escrowBalance: string;
  totalContributors: number;
  totalDistributed: string;
  remainder: string;
  /** 0보다 큰 배당만(지급 대상). */
  lines: DividendLine[];
};

// 연말 풀 수집(ADMIN, ADR-017) — REGULAR 미사용 연차를 익년도 1일권 매물로.
// dryRun=true면 미리보기, false면 실제 수집(멱등: 이미 수집됐으면 409).
export type CollectLeavePoolResponse = {
  sourceYear: number;
  targetYear: number;
  dryRun: boolean;
  alreadyCollected: boolean;
  contributorCount: number;
  daysCollected: number;
  auctionsCreated: number;
  startPrice: string;
  topContributors: { userId: string; name: string; days: number }[];
};

export function collectLeavePool(opts?: { dryRun?: boolean; sourceYear?: number }) {
  const qs = new URLSearchParams();
  if (opts?.dryRun) qs.set("dryRun", "true");
  if (opts?.sourceYear !== undefined) qs.set("sourceYear", String(opts.sourceYear));
  const tail = qs.toString();
  return apiPost<CollectLeavePoolResponse>(
    `/admin/leave-pool/collect${tail ? `?${tail}` : ""}`,
    {},
  );
}

export function settleDividend(opts?: { dryRun?: boolean; year?: number }) {
  const qs = new URLSearchParams();
  if (opts?.dryRun) qs.set("dryRun", "true");
  if (opts?.year !== undefined) qs.set("year", String(opts.year));
  const tail = qs.toString();
  return apiPost<SettleDividendResponse>(
    `/admin/dividend/settle${tail ? `?${tail}` : ""}`,
    {},
  );
}

// ── Admin ─────────────────────────────────────────────────────────
export type AdminStatsResponse = {
  escrowBalance: string;
  openAuctions: number;
  upcomingAuctions: number;
  unsoldAuctions: number;
  awardedToday: number;
  dlqDepth: number;
  /** 교환 신청 대기 건수(관리자 처리 대기 — ADR-023 v2). */
  redemptionPending: number;
  /** 승인 후 사용자가 아직 수령 컨펌 안 한 건수. */
  redemptionAwaitingReceipt: number;
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
  | "EXPIRE"
  | "CHARGE_REQUESTED"
  | "CHARGE_REJECTED";

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
  role: "ADMIN" | "EZPASS_ADMIN" | "EXAM_ADMIN" | "EZPASS" | "EXAM";
  active: boolean;
  /** WELFARE_POINT 잔액(bigint 문자열). */
  balance: string;
  /** 올해 연차(ADR-002 3-flag). 시각화: 파(REGULAR) + 노(AUCTION+EVENT) + 회(used). */
  leave: {
    regular: number;
    auction: number;
    event: number;
    used: number;
    total: number;
  };
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

// 로컬 회원 CRUD — EXAM(독립)/ADMIN만. EZPASS(회사 도메인)는 백엔드가 409로 거부.
export type CreateMemberInput = {
  email: string;
  name: string;
  password: string;
  role: "EXAM" | "EXAM_ADMIN";
  empId?: string;
  team?: string | null;
  jobRank?: string | null;
  jobTitle?: string | null;
};

export type UpdateMemberInput = {
  name?: string;
  role?: "EXAM" | "EXAM_ADMIN";
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

// 관리자 즉시 충전 — 회원관리에서 회원 클릭 → 모달.
export function adminCreditWallet(userId: string, amount: number, reason: string) {
  return apiPost<{
    userId: string;
    currency: string;
    newBalance: string;
    delta: string;
  }>("/admin/wallet/credit", { userId, amount, reason });
}

// ── Redemption (스토어 — ADR-023 자립형 포인트 소모처) ──────────────
export type RedemptionItem = {
  id: number;
  sku: string;
  name: string;
  description: string | null;
  priceP: string;
  stock: number | null; // null = 무제한
  category: string | null;
};

export type RedemptionOrder = {
  id: number;
  itemName: string;
  itemSku: string;
  pricePAtRedeem: string;
  status: "PENDING" | "FULFILLED" | "FAILED" | "REFUNDED";
  deliveryRef: string | null;
  createdAt: string;
};

export type RedeemResult = {
  orderId: number;
  itemId: number;
  itemName: string;
  pricePAtRedeem: string;
  status: "FULFILLED" | "PENDING" | "FAILED";
  deliveryRef: string | null;
  newBalance: string;
};

export function listRedemptionItems() {
  return apiGet<RedemptionItem[]>("/redemption/items");
}

export function listMyRedemptionOrders(userId: string | number) {
  return apiGet<RedemptionOrder[]>(`/users/${userId}/redemption-orders`);
}

// ── 교환 신청 워크플로 (ADR-023 v2) ─────────────────────────────────
// 흐름: PENDING(차감/잠금) → APPROVED(쿠폰 발급) → RECEIVED(사용자 컨펌)
//                       ↘ REJECTED(환불)

export type RedemptionRequestStatus = "PENDING" | "APPROVED" | "RECEIVED" | "REJECTED";

export type RedemptionRequestRow = {
  id: number;
  userId: string;
  userName: string;
  itemId: number;
  itemName: string;
  pricePAtRequest: string;
  note: string | null;
  status: RedemptionRequestStatus;
  couponCode: string | null;
  decidedByName: string | null;
  decidedAt: string | null;
  decisionNote: string | null;
  receivedAt: string | null;
  createdAt: string;
};

export function submitRedemptionRequest(itemId: number, note?: string) {
  return apiPost<{
    id: number;
    itemId: number;
    itemName: string;
    pricePAtRequest: string;
    status: "PENDING";
    createdAt: string;
  }>("/redemption/requests", note ? { itemId, note } : { itemId });
}

export function listMyRedemptionRequests() {
  return apiGet<RedemptionRequestRow[]>("/redemption/requests");
}

export function confirmRedemptionReceived(id: number) {
  return apiPost<{ requestId: number; receivedAt: string }>(
    `/redemption/requests/${id}/confirm`,
    {},
  );
}

export function listAdminRedemptionRequests(status?: RedemptionRequestStatus) {
  return apiGet<RedemptionRequestRow[]>(
    `/admin/redemption-requests${status ? `?status=${status}` : ""}`,
  );
}

export type RedemptionSummaryResponse = {
  pending: number;
  approved: number;
  received: number;
  rejected: number;
};

export function getRedemptionSummary() {
  return apiGet<RedemptionSummaryResponse>("/admin/redemption-requests/summary");
}

// ── 관리자 비상조치 — 우리 leave_balance.AUCTION ↔ ezpass mdat 정합 ────
// 평소엔 자동 sync(낙찰→Outbox→relay→streYryc). drift 발생 시 명시 트리거.
export type LeaveSyncRow = {
  userId: string;
  empId: string;
  name: string;
  email: string;
  year: number;
  ourRegular: number;
  ourAuctionDays: number;
  ourTotal: number;
  ezpassAtmc: number | null;
  ezpassMdat: number | null;
  ezpassTotal: number | null;
  inSync: boolean;
  error: string | null;
};
export type LeaveSyncReport = {
  year: number;
  checkedAt: string;
  rows: LeaveSyncRow[];
  driftCount: number;
};
export function checkLeaveSync(year?: number) {
  const qs = year !== undefined ? `?year=${year}` : "";
  return apiPost<LeaveSyncReport>(`/admin/leave-sync/check${qs}`, {});
}
export type ReconcileResult = {
  userId: string;
  email: string;
  year: number;
  ourRegular: number;
  ourAuctionDays: number;
  ourTotal: number;
  ezpassAtmc: number;
  ezpassMdatBefore: number;
  ezpassMdatApplied: number;
};
export function reconcileUserLeave(userId: string | number, year?: number) {
  const qs = year !== undefined ? `?year=${year}` : "";
  return apiPost<ReconcileResult>(`/admin/leave-sync/${userId}/reconcile${qs}`, {});
}

export function approveRedemptionRequest(id: number, couponCode: string, note?: string) {
  return apiPost<{ requestId: number; userId: string; itemName: string; couponCode: string }>(
    `/admin/redemption-requests/${id}/approve`,
    note ? { couponCode, note } : { couponCode },
  );
}

export function rejectRedemptionRequest(id: number, note: string) {
  return apiPost<{ requestId: number; userId: string; refundedP: string; newBalance: string }>(
    `/admin/redemption-requests/${id}/reject`,
    { note },
  );
}

// ── 충전 요청 워크플로 (ADR-024) ─────────────────────────────────
export type ChargeRequestRow = {
  id: number;
  userId: string;
  userName: string;
  amount: string;
  note: string | null;
  status: "PENDING" | "APPROVED" | "REJECTED";
  decidedByName: string | null;
  decidedAt: string | null;
  decisionNote: string | null;
  createdAt: string;
};

export function submitChargeRequest(amount: number, note?: string) {
  return apiPost<{ id: number; amount: string; status: string; createdAt: string }>(
    "/wallet/charge-requests",
    note ? { amount, note } : { amount },
  );
}

export function listMyChargeRequests() {
  return apiGet<ChargeRequestRow[]>("/wallet/charge-requests");
}

export function listAdminChargeRequests(status?: "PENDING" | "APPROVED" | "REJECTED") {
  return apiGet<ChargeRequestRow[]>(`/admin/charge-requests${status ? `?status=${status}` : ""}`);
}

export function getAdminChargeRequest(id: number) {
  return apiGet<ChargeRequestRow>(`/admin/charge-requests/${id}`);
}

export function approveChargeRequest(id: number, note?: string) {
  return apiPost<{ requestId: number; userId: string; amount: string; newBalance: string }>(
    `/admin/charge-requests/${id}/approve`,
    note ? { note } : {},
  );
}

export function rejectChargeRequest(id: number, note?: string) {
  return apiPost<{ requestId: number; status: "REJECTED" }>(
    `/admin/charge-requests/${id}/reject`,
    note ? { note } : {},
  );
}

// ── 경매 — 관리자 즉시 오픈 (CREATED → OPEN, 옵션 변경 동반) ─────
export type OpenAuctionInput = {
  startedAt?: string; // ISO
  endsAt?: string; // ISO
  startPrice?: string | number;
  leaveDays?: number;
  minIncrement?: string | number;
  force?: boolean;
};

export type OpenAuctionResult = {
  id: string;
  status: string;
  startedAt: string;
  endsAt: string;
  startPrice: string;
  leaveDays: number;
};

export function openAuction(id: string, opts: OpenAuctionInput = {}) {
  return apiPost<OpenAuctionResult>(`/admin/auctions/${id}/open`, opts);
}

/** 상태는 CREATED 유지 — 예약만 저장. 시간이 되면 OpenDueAuctionsScheduler가 OPEN. */
export function scheduleAuction(id: string, opts: Omit<OpenAuctionInput, "force">) {
  return apiPost<OpenAuctionResult>(`/admin/auctions/${id}/schedule`, opts);
}

/** OPEN 매물 마감 시각 연장 — 미래 시각만 허용. */
export function extendAuctionDeadline(id: string, endsAt: string) {
  return apiPost<{ id: string; endsAt: string }>(`/admin/auctions/${id}/extend`, { endsAt });
}

/** OPEN 매물 즉시 마감 + 정산. */
export function closeAuctionNow(id: string) {
  return apiPost<{
    auctionId: string;
    outcome: "AWARDED" | "UNSOLD";
    winnerId?: string;
    amount?: string;
    leaveDays?: number;
  }>(`/admin/auctions/${id}/close-now`, {});
}

// ── 풀 분산 정책 (관리자 경매관리 탭) ─────────────────────────────
export type ReleasePolicy =
  | { cadence: "none" }
  | { cadence: "daily"; timeOfDay: string; quantity: number }
  | { cadence: "weekly"; dayOfWeek: number; timeOfDay: string; quantity: number }
  | { cadence: "monthly"; dayOfMonth: number; timeOfDay: string; quantity: number };

export function getReleasePolicy() {
  return apiGet<ReleasePolicy>("/admin/release-policy");
}

export function updateReleasePolicy(p: ReleasePolicy) {
  return apiPatch<ReleasePolicy>("/admin/release-policy", p);
}

// ── 경매관리 — 카운터 / 채번 / 취소 / 수동 추가 ──────────────────
export type AuctionsSummary = {
  total: number;
  draft: number; // DRAFT(보류) — 오픈 스케줄 미정 매물
  upcoming: number; // CREATED — 예약된 오픈 예정
  open: number;
  ended: number;
  byStatus: { DRAFT: number; CREATED: number; OPEN: number; AWARDED: number; UNSOLD: number };
};

export function getAuctionsSummary() {
  return apiGet<AuctionsSummary>("/admin/auctions/summary");
}

export function getNextAuctionId(year?: number) {
  const qs = year !== undefined ? `?year=${year}` : "";
  return apiGet<{ year: number; nextId: string }>(`/admin/auctions/next-id${qs}`);
}

export function cancelAuctions(ids: string[]) {
  return apiPost<{
    requested: number;
    deletedIds: string[];
    skippedIds: string[];
    /** 풀 수집(LeavePoolRun) 매물 — 보호되어 삭제 안 됨. */
    protectedIds: string[];
  }>("/admin/auctions/cancel", { ids });
}

// 1일권 N개 일괄 생성. id는 서버 채번, leaveDays는 항상 1(ADR-007).
// asDraft=true면 startedAt/endsAt 불필요(보류 매물). false면 둘 다 필수.
export type CreateAuctionInput = {
  quantity?: number;
  startPrice: string | number;
  minIncrement?: string | number;
  asDraft?: boolean;
  startedAt?: string;
  endsAt?: string;
};

export function createAuction(body: CreateAuctionInput) {
  return apiPost<{ ids: string[]; created: number }>("/admin/auctions", body);
}

// ── UNSOLD 재고 수동 처리 (FR-4.2) ──────────────────────────────────
// 단건: 특정 직원에게 EVENT 휴가로 변환 지급. 변환 후 경매 행은 삭제(소진).
export function grantEventFromUnsold(auctionId: string, userId: string) {
  return apiPost<{ auctionId: string; userId: string; year: number; days: number }>(
    `/admin/auctions/${auctionId}/grant-event`,
    { userId },
  );
}

// 일괄: 지정 연도 이전(포함) UNSOLD 매물 영구 삭제.
export function purgeUnsold(upToYear?: number) {
  const qs = upToYear !== undefined ? `?upToYear=${upToYear}` : "";
  return apiPost<{ upToYear: number; deleted: number }>(`/admin/auctions/purge-unsold${qs}`, {});
}

// ── Notifications (종 아이콘 피드 — ADR-013 Observer 구독 결과) ──────
export type NotificationItem = {
  id: string;
  type:
    | "OUTBID"
    | "AUCTION_WON"
    | "INVENTORY_CREATED"
    | "CHARGE_REQUEST_SUBMITTED"
    | "CHARGE_APPROVED"
    | "CHARGE_REJECTED";
  title: string;
  message: string;
  auctionId: string | null;
  /** 클릭 시 이동할 프론트엔드 경로. 백엔드가 알림 만들 때 박음. null이면 비-네비. */
  linkPath: string | null;
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
