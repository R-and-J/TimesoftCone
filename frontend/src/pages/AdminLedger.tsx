import { useEffect, useMemo, useState } from "react";
import { PALETTES, FONT, fmt } from "@/lib/tokens";
import { Btn, Card, Pill, TopNav } from "@/components/atoms";
import { Icon } from "@/components/icons";
import { ScreenFrame } from "@/components/ScreenFrame";
import { AdminTabs } from "@/components/AdminTabs";
import { DataGrid } from "@/components/DataGrid";
import {
  listLedger,
  type LedgerActionType,
  type LedgerRow,
} from "@/lib/queries";

const ALL_ACTIONS: LedgerActionType[] = [
  "BID",
  "REFUND",
  "WIN",
  "DIVIDEND",
  "CREDIT_ADMIN",
  "EXPIRE",
  "CHARGE_REQUESTED",
  "CHARGE_REJECTED",
];

const ACTION_COLORS: Record<
  LedgerActionType,
  { bg: string; fg: string; dot: string }
> = {
  BID:              { bg: "#EEF2F7", fg: "#3b4a5e", dot: "#94A3B8" },
  REFUND:           { bg: "#E6F6F0", fg: "#16A07A", dot: "#16A07A" },
  WIN:              { bg: "#eef4ff", fg: "#1B64DA", dot: "#1B64DA" },
  DIVIDEND:         { bg: "#FFF4E0", fg: "#E08B19", dot: "#E08B19" },
  CREDIT_ADMIN:     { bg: "#F3F0FF", fg: "#7C3AED", dot: "#7C3AED" },
  EXPIRE:           { bg: "#FDECEE", fg: "#DC3F4A", dot: "#DC3F4A" },
  CHARGE_REQUESTED: { bg: "#FEF3C7", fg: "#92400E", dot: "#D97706" },
  CHARGE_REJECTED:  { bg: "#FEE2E2", fg: "#991B1B", dot: "#DC2626" },
};

const ACTION_LABELS: Record<LedgerActionType, string> = {
  BID: "입찰",
  REFUND: "환불",
  WIN: "낙찰",
  DIVIDEND: "배당",
  CREDIT_ADMIN: "관리자 조정",
  EXPIRE: "만료",
  CHARGE_REQUESTED: "충전요청",
  CHARGE_REJECTED: "충전반려",
};

export default function AdminLedgerPage() {
  const p = PALETTES.cobalt;
  const [active, setActive] = useState<Set<LedgerActionType>>(new Set(ALL_ACTIONS));
  const [rows, setRows] = useState<LedgerRow[]>([]);
  const [cursor, setCursor] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const [total, setTotal] = useState(0);

  const activeArr = useMemo(() => ALL_ACTIONS.filter((a) => active.has(a)), [active]);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    listLedger({ actionTypes: activeArr, limit: 50 })
      .then((res) => {
        if (cancelled) return;
        setRows(res.rows);
        setCursor(res.nextCursor);
        setTotal(res.totalEstimate);
      })
      .catch((e: Error) => !cancelled && setError(e))
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, [activeArr.join(",")]);

  const loadMore = async () => {
    if (!cursor) return;
    setLoading(true);
    try {
      const res = await listLedger({
        actionTypes: activeArr,
        limit: 50,
        cursor,
      });
      setRows((prev) => [...prev, ...res.rows]);
      setCursor(res.nextCursor);
    } catch (e) {
      setError(e as Error);
    } finally {
      setLoading(false);
    }
  };

  const toggle = (a: LedgerActionType) => {
    setActive((prev) => {
      const next = new Set(prev);
      if (next.has(a)) next.delete(a);
      else next.add(a);
      if (next.size === 0) return new Set(ALL_ACTIONS);
      return next;
    });
  };

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
        <TopNav p={p} active="admin" />
        <div style={{ flex: 1, padding: "24px 40px", overflow: "auto" }}>
          <AdminTabs p={p} active="ledger" />
          <div
            style={{
              display: "flex",
              alignItems: "flex-end",
              justifyContent: "space-between",
              marginBottom: 20,
            }}
          >
            <div>
              <div
                style={{
                  fontSize: 13,
                  color: p.inkMuted,
                  fontWeight: 500,
                  display: "flex",
                  alignItems: "center",
                  gap: 6,
                }}
              >
                <Icon.ledger size={14} /> 거래 내역
              </div>
              <div
                style={{
                  fontSize: 28,
                  fontWeight: 800,
                  color: p.ink,
                  letterSpacing: "-0.025em",
                  marginTop: 4,
                }}
              >
                거래 원장
              </div>
              <div style={{ fontSize: 12, color: p.inkMuted, marginTop: 6 }}>
                모든 포인트 입·출금 내역을 기록하며 수정·삭제할 수 없습니다
              </div>
            </div>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "240px 1fr", gap: 16 }}>
            <Card p={p} padding={20}>
              <div style={{ fontSize: 12, color: p.inkMuted, fontWeight: 700, marginBottom: 12 }}>
                유형 필터
              </div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 16 }}>
                {ALL_ACTIONS.map((t) => (
                  <Pill
                    key={t}
                    p={p}
                    tone={active.has(t) ? "accent" : "neutral"}
                    size="sm"
                    style={{ cursor: "pointer" }}
                  >
                    <span onClick={() => toggle(t)}>{ACTION_LABELS[t]}</span>
                  </Pill>
                ))}
              </div>
              <div
                style={{
                  padding: 12,
                  background: "#FFF4E0",
                  borderRadius: 10,
                  fontSize: 11,
                  color: p.warn,
                  lineHeight: 1.5,
                }}
              >
                <strong>⚠ 읽기 전용</strong>
                <br />
                <span style={{ color: p.inkSoft, fontWeight: 500 }}>
                  관리자도 거래 내역을 수정·삭제할 수 없습니다. 정정이 필요하면 환불 또는 관리자 조정으로만 처리됩니다.
                </span>
              </div>
            </Card>

            <DataGrid<LedgerRow>
              p={p}
              rows={rows}
              rowKey={(r) => r.id}
              loading={loading}
              error={error}
              emptyText="표시할 원장 항목이 없습니다."
              rowAccent={(r) => (ACTION_COLORS[r.actionType] ?? ACTION_COLORS.BID).dot}
              maxHeight={540}
              rowPadding="14px 20px"
              columns={[
                {
                  key: "id",
                  header: "번호",
                  width: "70px",
                  render: (r) => (
                    <span className="mono" style={{ color: p.inkMuted, fontWeight: 600 }}>
                      {r.id}
                    </span>
                  ),
                },
                {
                  key: "time",
                  header: "시각",
                  width: "130px",
                  render: (r) => (
                    <span className="mono" style={{ color: p.inkSoft }}>
                      {formatTime(new Date(r.occurredAt))}
                    </span>
                  ),
                },
                {
                  key: "action",
                  header: "유형",
                  width: "110px",
                  render: (r) => {
                    const c = ACTION_COLORS[r.actionType] ?? ACTION_COLORS.BID;
                    return (
                      <Pill
                        p={p}
                        size="sm"
                        style={{ background: c.bg, color: c.fg, fontSize: 10, fontWeight: 700 }}
                      >
                        {ACTION_LABELS[r.actionType] ?? r.actionType}
                      </Pill>
                    );
                  },
                },
                {
                  key: "auction",
                  header: "경매",
                  width: "110px",
                  render: (r) => (
                    <span className="mono" style={{ color: p.inkSoft, fontSize: 11, fontWeight: 600 }}>
                      {r.auctionId ?? "—"}
                    </span>
                  ),
                },
                {
                  key: "user",
                  header: "사용자",
                  width: "130px",
                  render: (r) => <span style={{ color: p.ink, fontWeight: 600 }}>{r.userName}</span>,
                },
                {
                  key: "note",
                  header: "비고",
                  width: "1fr",
                  render: (r) => (
                    <span style={{ color: p.inkMuted, fontSize: 11 }}>{r.refNote || "—"}</span>
                  ),
                },
                {
                  key: "amount",
                  header: "금액",
                  width: "130px",
                  align: "right",
                  render: (r) => {
                    const amount = Number(r.amount);
                    return (
                      <span
                        className="mono"
                        style={{
                          fontWeight: 800,
                          color: amount > 0 ? p.success : amount < 0 ? p.ink : p.inkMuted,
                        }}
                      >
                        {amount > 0 ? "+" : ""}
                        {amount === 0 ? "0" : fmt.point(amount)}
                      </span>
                    );
                  },
                },
                {
                  key: "balance",
                  header: "잔액",
                  width: "130px",
                  align: "right",
                  render: (r) => (
                    <span className="mono" style={{ color: p.inkSoft, fontSize: 11, fontWeight: 600 }}>
                      {fmt.point(Number(r.balanceAfter))}
                    </span>
                  ),
                },
              ]}
              footer={
                <>
                  <span>
                    총 {total}건 · 현재 {rows.length}건 표시
                  </span>
                  <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                    <Btn
                      p={p}
                      variant="ghost"
                      size="sm"
                      disabled={!cursor || loading}
                      onClick={loadMore}
                    >
                      {cursor ? "더 보기" : "마지막 페이지"}
                    </Btn>
                  </div>
                </>
              }
            />
          </div>
        </div>
      </div>
    </ScreenFrame>
  );
}

function formatTime(d: Date): string {
  return d.toLocaleString("ko-KR", {
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}
