import { useState } from "react";
import { PALETTES, FONT, fmt } from "@/lib/tokens";
import type { Palette } from "@/lib/tokens";
import { Card, Pill, TopNav } from "@/components/atoms";
import { DataGrid } from "@/components/DataGrid";
import { ScreenFrame } from "@/components/ScreenFrame";
import { useCurrentUser } from "@/lib/current-user";
import { useQuery } from "@/lib/use-query";
import {
  getActivity,
  getBalance,
  getLeave,
  listAuctions,
  type AuctionListItem,
  type LeaveResponse,
} from "@/lib/queries";
import { useNavigate } from "react-router-dom";

const TYPE_LABEL: Record<string, { bg: string; fg: string; label: string }> = {
  BID:              { bg: "#EEF2F7", fg: "#3b4a5e", label: "입찰" },
  REFUND:           { bg: "#E6F6F0", fg: "#16A07A", label: "환불" },
  WIN:              { bg: "#eef4ff", fg: "#1B64DA", label: "낙찰" },
  DIVIDEND:         { bg: "#FFF4E0", fg: "#E08B19", label: "배당" },
  CREDIT_ADMIN:     { bg: "#F3F0FF", fg: "#7C3AED", label: "관리자 적립" },
  EXPIRE:           { bg: "#FDECEE", fg: "#DC3F4A", label: "만료" },
  REDEEM:           { bg: "#FFF1E6", fg: "#C2410C", label: "스토어 결제" },
  REDEEM_REFUND:    { bg: "#FFEFE6", fg: "#9A3412", label: "스토어 환불" },
  CHARGE_REQUESTED: { bg: "#F1F5F9", fg: "#475569", label: "충전 신청" },
  CHARGE_REJECTED:  { bg: "#FDECEE", fg: "#9F1239", label: "충전 거절" },
};

// default(주요만) 뷰에서 숨길 액션 타입 — 중간 흐름·잔액 무영향 감사 entry.
//   BID/REFUND     : 입찰·자동환불 (서로 상쇄, outcome=낙찰 한 줄로 충분)
//   CHARGE_*       : 잔액 안 바꾸는 충전 신청 라이프사이클 audit
const OUTCOME_HIDDEN = new Set([
  "BID",
  "REFUND",
  "CHARGE_REQUESTED",
  "CHARGE_REJECTED",
]);

export default function MyActivityPage() {
  const p = PALETTES.cobalt;
  const { user } = useCurrentUser();
  const activityQ = useQuery(() => getActivity(user.id), [user.id]);
  const balanceQ = useQuery(() => getBalance(user.id), [user.id]);
  const openQ = useQuery(() => listAuctions(["OPEN"]), []);
  const leaveQ = useQuery(() => getLeave(user.id), [user.id]);
  const myActiveBids = (openQ.data ?? []).filter(
    (a) => a.highestBidder !== null && Number(a.highestBidder) === user.id,
  );

  const [showAll, setShowAll] = useState(false);
  const allHistory = activityQ.data?.history ?? [];
  const visibleHistory = showAll
    ? allHistory
    : allHistory.filter((h) => !OUTCOME_HIDDEN.has(h.actionType));
  const hiddenCount = allHistory.length - visibleHistory.length;

  return (
    <ScreenFrame>
      <div
        style={{
          width: "100%",
          minHeight: 900,
          background: p.bg,
          fontFamily: FONT.sans,
          display: "flex",
          flexDirection: "column",
        }}
      >
        <TopNav p={p} active="activity" />
        <div
          style={{
            flex: 1,
            padding: "28px 40px",
            overflow: "hidden",
            display: "grid",
            gridTemplateColumns: "1.6fr 1fr",
            gap: 16,
          }}
        >
          <div style={{ display: "flex", flexDirection: "column", gap: 16, minHeight: 0 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end" }}>
              <div>
                <div style={{ fontSize: 13, color: p.inkMuted, fontWeight: 500 }}>내 활동</div>
                <div
                  style={{
                    fontSize: 28,
                    fontWeight: 800,
                    color: p.ink,
                    letterSpacing: "-0.025em",
                    marginTop: 4,
                  }}
                >
                  거래 내역 · {user.name}
                </div>
              </div>
              <ScopeToggle
                p={p}
                showAll={showAll}
                onChange={setShowAll}
                hiddenCount={showAll ? 0 : hiddenCount}
              />
            </div>

            <SummaryCards p={p} summary={activityQ.data?.summary} loading={activityQ.loading} />

            <DataGrid
              p={p}
              fill
              rows={visibleHistory}
              rowKey={(_, i) => i}
              loading={activityQ.loading}
              error={activityQ.error ? new Error(`백엔드 연결 실패: ${activityQ.error.message}`) : null}
              emptyText={
                allHistory.length === 0
                  ? "아직 거래 내역이 없습니다."
                  : "주요 거래가 없습니다 — 우상단 '전체 보기'로 입찰/환불 등 중간 내역까지 확인하세요."
              }
              zebra={false}
              rowBackground={(h) => (h.actionType === "WIN" ? p.accentSoft : undefined)}
              rowPadding="16px 24px"
              rowFontSize={13}
              columns={[
                {
                  key: "time",
                  header: "시각",
                  width: "140px",
                  render: (h) => (
                    <span style={{ color: p.inkMuted, fontSize: 12 }}>
                      {formatTime(new Date(h.occurredAt))}
                    </span>
                  ),
                },
                {
                  key: "type",
                  header: "구분",
                  width: "100px",
                  render: (h) => {
                    const c = TYPE_LABEL[h.actionType] ?? { bg: p.bg, fg: p.inkSoft, label: h.actionType };
                    return (
                      <Pill p={p} size="sm" style={{ background: c.bg, color: c.fg }}>
                        {c.label}
                      </Pill>
                    );
                  },
                },
                {
                  key: "auction",
                  header: "경매",
                  width: "120px",
                  render: (h) => (
                    <span className="mono" style={{ color: p.inkSoft, fontSize: 12, fontWeight: 600 }}>
                      {h.auctionId ?? "—"}
                    </span>
                  ),
                },
                {
                  key: "desc",
                  header: "설명",
                  width: "1fr",
                  render: (h) => (
                    <span style={{ color: p.ink, fontWeight: h.actionType === "WIN" ? 700 : 500 }}>
                      {h.refNote ?? defaultDesc(h.actionType)}
                    </span>
                  ),
                },
                {
                  key: "amount",
                  header: "금액",
                  width: "130px",
                  align: "right",
                  render: (h) => {
                    const amount = Number(h.amount);
                    // WIN(낙찰) 행은 ledger amount=0이지만 사용자에겐 낙찰가가 보여야 자연스럽다.
                    // backend가 winningAmount(=매물 highest)를 부가해 주므로 그것을 표시.
                    if (h.actionType === "WIN" && h.winningAmount != null) {
                      const win = Number(h.winningAmount);
                      return (
                        <span
                          className="mono"
                          style={{ fontWeight: 800, color: p.ink }}
                          title="낙찰가(실제 차감은 입찰 시점에 이미 일어났음)"
                        >
                          {fmt.point(win)}
                          <span style={{ color: p.inkMuted, marginLeft: 3, fontWeight: 500 }}>콘</span>
                        </span>
                      );
                    }
                    return (
                      <span
                        className="mono"
                        style={{
                          fontWeight: 800,
                          color: amount > 0 ? p.success : amount < 0 ? p.ink : p.inkMuted,
                        }}
                      >
                        {amount > 0 ? "+" : ""}
                        {amount === 0 ? "—" : fmt.point(amount)}
                        {amount !== 0 && (
                          <span style={{ color: p.inkMuted, marginLeft: 3, fontWeight: 500 }}>콘</span>
                        )}
                      </span>
                    );
                  },
                },
                {
                  key: "balance",
                  header: "잔액",
                  width: "130px",
                  align: "right",
                  render: (h) => (
                    <span className="mono" style={{ color: p.inkSoft, fontSize: 13 }}>
                      {fmt.point(Number(h.balanceAfter))}
                      <span style={{ color: p.inkMuted, marginLeft: 3 }}>콘</span>
                    </span>
                  ),
                },
              ]}
            />
          </div>

          <RightColumn
            p={p}
            balance={balanceQ.data ? Number(balanceQ.data.balance) : null}
            leave={leaveQ.data ?? null}
            leaveLoading={leaveQ.loading}
            myActiveBids={myActiveBids}
            activeBidsLoading={openQ.loading}
          />
        </div>
      </div>
    </ScreenFrame>
  );
}

function SummaryCards({
  p,
  summary,
  loading,
}: {
  p: Palette;
  summary?: { totalBids: number; totalWins: number; totalRefunds: number; activeAuctions: number };
  loading: boolean;
}) {
  const cards = [
    { k: "총 입찰 횟수", v: summary?.totalBids, sub: "이번 분기" },
    { k: "낙찰 횟수", v: summary?.totalWins, sub: "획득 연차" },
    { k: "환불 받음", v: summary?.totalRefunds, sub: "추월 시 자동 환불" },
    { k: "현재 입찰 중", v: summary?.activeAuctions, sub: "최고가 보유" },
  ];
  return (
    <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 12 }}>
      {cards.map((s, i) => (
        <Card key={i} p={p} padding={16}>
          <div style={{ fontSize: 11, color: p.inkMuted, fontWeight: 600 }}>{s.k}</div>
          <div
            className="mono"
            style={{
              fontSize: 26,
              fontWeight: 800,
              color: p.ink,
              marginTop: 4,
              letterSpacing: "-0.02em",
            }}
          >
            {loading ? "—" : (s.v ?? 0)}
          </div>
          <div style={{ fontSize: 11, color: p.inkMuted, marginTop: 2 }}>{s.sub}</div>
        </Card>
      ))}
    </div>
  );
}

function RightColumn({
  p,
  balance,
  leave,
  leaveLoading,
  myActiveBids,
  activeBidsLoading,
}: {
  p: Palette;
  balance: number | null;
  leave: LeaveResponse | null;
  leaveLoading: boolean;
  myActiveBids: AuctionListItem[];
  activeBidsLoading: boolean;
}) {
  const navigate = useNavigate();
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16, minHeight: 0 }}>
      <Card p={p} padding={20} style={{ background: p.ink, color: "#fff" }}>
        <div style={{ fontSize: 12, color: "rgba(255,255,255,0.6)", fontWeight: 600 }}>현재 잔액</div>
        <div
          className="mono"
          style={{
            fontSize: 56,
            fontWeight: 800,
            letterSpacing: "-0.03em",
            lineHeight: 1,
            marginTop: 10,
          }}
        >
          {balance !== null ? fmt.point(balance) : "—"}
          <span style={{ fontSize: 22, color: "rgba(255,255,255,0.6)", marginLeft: 6 }}>콘</span>
        </div>
        <div style={{ fontSize: 12, color: "rgba(255,255,255,0.5)", marginTop: 4 }}>실시간 잔액</div>
      </Card>

      <LeaveCard p={p} leave={leave} loading={leaveLoading} />

      <Card p={p} padding={20} style={{ flex: 1 }}>
        <div style={{ fontSize: 13, color: p.inkMuted, fontWeight: 700, marginBottom: 12 }}>
          내가 최고가인 입찰{" "}
          <span style={{ color: p.inkMuted, fontWeight: 500 }}>
            ({activeBidsLoading ? "—" : myActiveBids.length}건)
          </span>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {activeBidsLoading && <div style={{ fontSize: 12, color: p.inkMuted }}>불러오는 중…</div>}
          {!activeBidsLoading && myActiveBids.length === 0 && (
            <div
              style={{
                padding: 12,
                background: p.bg,
                borderRadius: 10,
                fontSize: 12,
                color: p.inkMuted,
                textAlign: "center",
              }}
            >
              현재 최고가인 입찰이 없습니다.
            </div>
          )}
          {myActiveBids.map((a) => {
            const highest = Number(a.highest);
            const minLeft = Math.max(0, Math.floor((new Date(a.endsAt).getTime() - Date.now()) / 60000));
            return (
              <div
                key={a.id}
                onClick={() => navigate(`/auction/detail/${a.id}`)}
                style={{
                  padding: 12,
                  background: p.accentSoft,
                  borderRadius: 12,
                  borderLeft: `3px solid ${p.accent}`,
                  cursor: "pointer",
                }}
              >
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                  }}
                >
                  <div className="mono" style={{ fontSize: 12, color: p.accent, fontWeight: 700 }}>
                    {a.id}
                  </div>
                  <Pill p={p} tone="accent" size="sm">
                    최고가
                  </Pill>
                </div>
                <div
                  className="mono"
                  style={{
                    fontSize: 22,
                    fontWeight: 800,
                    color: p.ink,
                    marginTop: 6,
                    letterSpacing: "-0.02em",
                  }}
                >
                  {fmt.point(highest)}
                  <span style={{ fontSize: 12, color: p.inkMuted, marginLeft: 3 }}>콘</span>
                </div>
                <div style={{ fontSize: 11, color: p.inkSoft, marginTop: 4 }}>
                  마감까지 약{" "}
                  {minLeft >= 60
                    ? `${Math.floor(minLeft / 60)}시간 ${minLeft % 60}분`
                    : `${minLeft}분`}
                </div>
              </div>
            );
          })}
        </div>
      </Card>
    </div>
  );
}

function LeaveCard({
  p,
  leave,
  loading,
}: {
  p: Palette;
  leave: LeaveResponse | null;
  loading: boolean;
}) {
  const total = leave ? leave.total : 0;
  const safe = (v: number | undefined) => (loading || v === undefined ? 0 : v);
  const auctionPct = total > 0 ? (safe(leave?.auction) / total) * 100 : 0;
  const eventPct = total > 0 ? (safe(leave?.event) / total) * 100 : 0;
  const regularPct = total > 0 ? (safe(leave?.regular) / total) * 100 : 100;

  return (
    <Card p={p} padding={20}>
      <div style={{ fontSize: 13, color: p.inkMuted, fontWeight: 700, marginBottom: 12 }}>
        내 연차 잔여
      </div>
      <div
        className="mono"
        style={{
          fontSize: 40,
          fontWeight: 800,
          color: p.ink,
          letterSpacing: "-0.03em",
          lineHeight: 1,
        }}
      >
        {loading ? "—" : total}
        <span style={{ fontSize: 18, color: p.inkMuted, marginLeft: 4 }}>일</span>
      </div>
      <div
        style={{
          marginTop: 14,
          height: 22,
          borderRadius: 8,
          overflow: "hidden",
          display: "flex",
          background: p.bg,
        }}
      >
        {auctionPct > 0 && (
          <div
            style={{
              width: `${auctionPct}%`,
              background: p.accent,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: 10,
              fontWeight: 700,
              color: "#fff",
            }}
          >
            {safe(leave?.auction)} AUC
          </div>
        )}
        {eventPct > 0 && (
          <div
            style={{
              width: `${eventPct}%`,
              background: p.warn,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: 10,
              fontWeight: 700,
              color: "#fff",
            }}
          >
            {safe(leave?.event)}
          </div>
        )}
        {regularPct > 0 && (
          <div
            style={{
              width: `${regularPct}%`,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: 10,
              fontWeight: 700,
              color: p.inkSoft,
            }}
          >
            {safe(leave?.regular)} 일반
          </div>
        )}
      </div>
      <div
        style={{
          fontSize: 10,
          color: p.inkMuted,
          marginTop: 6,
          lineHeight: 1.4,
        }}
      >
        차감 순위: 경매 연차 → 이벤트 연차 → 일반 연차
      </div>
    </Card>
  );
}

function defaultDesc(t: string): string {
  switch (t) {
    case "BID":
      return "입찰";
    case "REFUND":
      return "상위 입찰 발생 — 자동 환불";
    case "WIN":
      return "✨ 낙찰 — 연차 +1일";
    case "DIVIDEND":
      return "연말 배당";
    case "CREDIT_ADMIN":
      return "관리자 적립";
    case "EXPIRE":
      return "만료";
    case "REDEEM":
      return "스토어 결제";
    case "REDEEM_REFUND":
      return "스토어 환불";
    case "CHARGE_REQUESTED":
      return "충전 신청";
    case "CHARGE_REJECTED":
      return "충전 거절";
    default:
      return t;
  }
}

function ScopeToggle({
  p,
  showAll,
  onChange,
  hiddenCount,
}: {
  p: Palette;
  showAll: boolean;
  onChange: (v: boolean) => void;
  hiddenCount: number;
}) {
  const btn = (active: boolean, label: string, onClick: () => void) => (
    <button
      type="button"
      onClick={onClick}
      style={{
        padding: "5px 12px",
        borderRadius: 999,
        border: `1px solid ${active ? p.accent : p.line ?? "transparent"}`,
        background: active ? p.accent : "transparent",
        color: active ? "#fff" : p.inkSoft,
        fontSize: 12,
        fontWeight: 700,
        cursor: "pointer",
        fontFamily: "inherit",
      }}
    >
      {label}
    </button>
  );
  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 4 }}>
      <div style={{ display: "flex", gap: 4, alignItems: "center" }}>
        {btn(!showAll, "주요만", () => onChange(false))}
        {btn(showAll, "전체 보기", () => onChange(true))}
      </div>
      {!showAll && hiddenCount > 0 && (
        <div style={{ fontSize: 11, color: p.inkMuted }}>
          입찰·환불 등 {hiddenCount}건 숨김
        </div>
      )}
    </div>
  );
}

function formatTime(d: Date): string {
  return d.toLocaleString("ko-KR", {
    month: "numeric",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}
