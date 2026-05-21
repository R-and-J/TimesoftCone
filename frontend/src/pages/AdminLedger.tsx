import { useEffect, useMemo, useState } from "react";
import { PALETTES, FONT, fmt } from "@/lib/tokens";
import { Btn, Card, Pill, TopNav } from "@/components/atoms";
import { Icon } from "@/components/icons";
import { ScreenFrame } from "@/components/ScreenFrame";
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
];

const ACTION_COLORS: Record<
  LedgerActionType,
  { bg: string; fg: string; dot: string }
> = {
  BID:          { bg: "#EEF2F7", fg: "#3b4a5e", dot: "#94A3B8" },
  REFUND:       { bg: "#E6F6F0", fg: "#16A07A", dot: "#16A07A" },
  WIN:          { bg: "#eef4ff", fg: "#1B64DA", dot: "#1B64DA" },
  DIVIDEND:     { bg: "#FFF4E0", fg: "#E08B19", dot: "#E08B19" },
  CREDIT_ADMIN: { bg: "#F3F0FF", fg: "#7C3AED", dot: "#7C3AED" },
  EXPIRE:       { bg: "#FDECEE", fg: "#DC3F4A", dot: "#DC3F4A" },
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
        <TopNav p={p} active="admin" user="박부장" role="관리자" />
        <div style={{ flex: 1, padding: "24px 40px", overflow: "auto" }}>
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
                <Icon.ledger size={14} /> LEDGER_ENTRY · Insert-Only
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
                원장 (감사 추적)
              </div>
              <div style={{ fontSize: 12, color: p.inkMuted, marginTop: 6 }}>
                DB-RULE-1 · UPDATE / DELETE는 트리거로 영구 차단됩니다
              </div>
            </div>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "240px 1fr", gap: 16 }}>
            <Card p={p} padding={20}>
              <div style={{ fontSize: 12, color: p.inkMuted, fontWeight: 700, marginBottom: 12 }}>
                action_type 필터
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
                    <span onClick={() => toggle(t)}>{t}</span>
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
                  관리자도 원장 행을 수정·삭제할 수 없습니다. 정정은 REFUND 또는 CREDIT_ADMIN INSERT로만 가능.
                </span>
              </div>
            </Card>

            <Card p={p} padding={0} style={{ display: "flex", flexDirection: "column", minHeight: 0 }}>
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "70px 130px 110px 110px 130px 1fr 130px 130px",
                  padding: "12px 20px",
                  fontSize: 11,
                  color: p.inkMuted,
                  fontWeight: 700,
                  letterSpacing: 0.4,
                  borderBottom: `1px solid ${p.line}`,
                  background: p.bg,
                }}
              >
                <div>id</div>
                <div>시각</div>
                <div>action</div>
                <div>경매</div>
                <div>user</div>
                <div>note</div>
                <div style={{ textAlign: "right" }}>amount</div>
                <div style={{ textAlign: "right" }}>balance</div>
              </div>
              <div style={{ overflow: "auto", maxHeight: 540 }}>
                {error && (
                  <div style={{ padding: 24, color: p.danger, fontSize: 13, fontWeight: 700 }}>
                    {error.message}
                  </div>
                )}
                {!error && rows.length === 0 && !loading && (
                  <div style={{ padding: 24, color: p.inkMuted, fontSize: 13, textAlign: "center" }}>
                    표시할 원장 항목이 없습니다.
                  </div>
                )}
                {rows.map((r, i) => {
                  const c = ACTION_COLORS[r.actionType] ?? ACTION_COLORS.BID;
                  const zebra = i % 2 === 1;
                  const amount = Number(r.amount);
                  const balance = Number(r.balanceAfter);
                  return (
                    <div
                      key={r.id}
                      style={{
                        display: "grid",
                        gridTemplateColumns: "70px 130px 110px 110px 130px 1fr 130px 130px",
                        padding: "14px 20px",
                        fontSize: 12,
                        alignItems: "center",
                        background: zebra ? p.bg : p.surface,
                        borderBottom: `1px solid ${p.line}`,
                        borderLeft: `3px solid ${c.dot}`,
                      }}
                    >
                      <div className="mono" style={{ color: p.inkMuted, fontWeight: 600 }}>
                        {r.id}
                      </div>
                      <div className="mono" style={{ color: p.inkSoft }}>
                        {formatTime(new Date(r.occurredAt))}
                      </div>
                      <div>
                        <Pill
                          p={p}
                          size="sm"
                          style={{
                            background: c.bg,
                            color: c.fg,
                            fontSize: 10,
                            fontWeight: 700,
                          }}
                        >
                          {r.actionType}
                        </Pill>
                      </div>
                      <div className="mono" style={{ color: p.inkSoft, fontSize: 11, fontWeight: 600 }}>
                        {r.auctionId ?? "—"}
                      </div>
                      <div style={{ color: p.ink, fontWeight: 600 }}>{r.userName}</div>
                      <div style={{ color: p.inkMuted, fontSize: 11 }}>{r.refNote || "—"}</div>
                      <div
                        className="mono"
                        style={{
                          textAlign: "right",
                          fontWeight: 800,
                          color: amount > 0 ? p.success : amount < 0 ? p.ink : p.inkMuted,
                        }}
                      >
                        {amount > 0 ? "+" : ""}
                        {amount === 0 ? "0" : fmt.point(amount)}
                      </div>
                      <div
                        className="mono"
                        style={{
                          textAlign: "right",
                          color: p.inkSoft,
                          fontSize: 11,
                          fontWeight: 600,
                        }}
                      >
                        {fmt.point(balance)}
                      </div>
                    </div>
                  );
                })}
                {loading && (
                  <div style={{ padding: 16, textAlign: "center", color: p.inkMuted, fontSize: 12 }}>
                    불러오는 중…
                  </div>
                )}
              </div>
              <div
                style={{
                  padding: "12px 20px",
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  borderTop: `1px solid ${p.line}`,
                  background: p.bg,
                  fontSize: 11,
                  color: p.inkMuted,
                }}
              >
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
              </div>
            </Card>
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
