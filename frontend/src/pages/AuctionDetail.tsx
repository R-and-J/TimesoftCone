import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { PALETTES, FONT, fmt } from "@/lib/tokens";
import type { Palette } from "@/lib/tokens";
import { Avatar, Btn, Card, Pill, TopNav } from "@/components/atoms";
import { Icon } from "@/components/icons";
import { ScreenFrame } from "@/components/ScreenFrame";
import { useQuery } from "@/lib/use-query";
import { getAuction, getBalance, placeBid } from "@/lib/queries";
import { useCurrentUser } from "@/lib/current-user";
import { useToast } from "@/lib/toast";
import { ApiError } from "@/lib/api";
import type { ReactNode } from "react";

const DEFAULT_ID = "A-2026-106";

export default function AuctionDetailPage() {
  const p = PALETTES.cobalt;
  const { id: idParam } = useParams();
  const id = idParam ?? DEFAULT_ID;

  const { user } = useCurrentUser();
  const toast = useToast();

  const auctionQ = useQuery(() => getAuction(id), [id]);
  const balanceQ = useQuery(() => getBalance(user.id), [user.id]);

  const [bidAmount, setBidAmount] = useState<number | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (auctionQ.data) {
      const highest = Number(auctionQ.data.highest);
      const inc = Number(auctionQ.data.minIncrement);
      setBidAmount(highest + inc);
    }
  }, [auctionQ.data?.highest, auctionQ.data?.minIncrement, auctionQ.data]);

  if (auctionQ.loading || auctionQ.data === null) {
    return (
      <ScreenFrame>
        <div style={{ width: "100%", minHeight: 900, background: p.bg, padding: 40 }}>
          {auctionQ.error ? (
            <Card p={p} padding={20} style={{ borderLeft: `3px solid ${p.danger}` }}>
              <div style={{ fontSize: 14, color: p.danger, fontWeight: 700 }}>
                경매를 불러올 수 없습니다.
              </div>
              <div style={{ fontSize: 12, color: p.inkMuted, marginTop: 4 }}>
                {auctionQ.error.message}
              </div>
            </Card>
          ) : (
            <div style={{ color: p.inkMuted }}>불러오는 중…</div>
          )}
        </div>
      </ScreenFrame>
    );
  }

  const a = auctionQ.data;
  const highest = Number(a.highest);
  const startPrice = Number(a.startPrice);
  const minIncrement = Number(a.minIncrement);
  const myBalance = balanceQ.data ? Number(balanceQ.data.balance) : null;
  const endsAt = new Date(a.endsAt);
  const startedAt = new Date(a.startedAt);
  const msLeft = endsAt.getTime() - Date.now();
  const isClosed = msLeft <= 0 || a.status !== "OPEN";

  const onSubmitBid = async () => {
    if (bidAmount === null) return;
    setSubmitting(true);
    try {
      const r = await placeBid(a.id, user.id, bidAmount);
      toast.push(
        "success",
        r.refundedTo
          ? `${fmt.point(bidAmount)} P 입찰 성공 · 이전 최고가 자동 환불됨`
          : `${fmt.point(bidAmount)} P 입찰 성공`,
      );
      await Promise.all([auctionQ.refetch(), balanceQ.refetch()]);
    } catch (e) {
      const msg = e instanceof ApiError ? e.message : (e as Error).message;
      toast.push("error", msg);
    } finally {
      setSubmitting(false);
    }
  };

  const afterBalance =
    myBalance !== null && bidAmount !== null ? myBalance - bidAmount : null;
  const insufficient = afterBalance !== null && afterBalance < 0;

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
        <TopNav p={p} active="auction" />

        <div
          style={{
            flex: 1,
            padding: "20px 32px 24px",
            overflow: "hidden",
            display: "flex",
            flexDirection: "column",
          }}
        >
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              marginBottom: 14,
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12, color: p.inkMuted }}>
              <span style={{ cursor: "pointer" }}>경매장</span>
              <Icon.chev size={12} dir="right" />
              <span style={{ cursor: "pointer" }}>진행 중인 경매</span>
              <Icon.chev size={12} dir="right" />
              <span className="mono" style={{ color: p.ink, fontWeight: 700 }}>
                {a.id}
              </span>
            </div>
            <div style={{ display: "flex", gap: 8 }}>
              <Btn p={p} variant="ghost" size="sm">
                관심 등록
              </Btn>
              <Btn p={p} variant="ghost" size="sm">
                공유
              </Btn>
            </div>
          </div>

          <div
            style={{
              display: "grid",
              gridTemplateColumns: "440px 1fr 320px",
              gap: 16,
              flex: 1,
              minHeight: 0,
            }}
          >
            {/* LEFT — Item showcase */}
            <Card p={p} padding={0} style={{ display: "flex", flexDirection: "column", overflow: "hidden" }}>
              <ItemPortrait p={p} auctionId={a.id} />
              <div style={{ padding: "20px 24px 18px" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
                  <Pill p={p} tone="accent" size="sm">
                    <span
                      style={{
                        width: 6,
                        height: 6,
                        background: p.accent,
                        borderRadius: "50%",
                        marginRight: 2,
                      }}
                    />
                    연차 아이템
                  </Pill>
                  <span className="mono" style={{ fontSize: 11, color: p.inkMuted, fontWeight: 600 }}>
                    {a.id}
                  </span>
                </div>
                <div
                  style={{
                    fontSize: 24,
                    fontWeight: 800,
                    color: p.ink,
                    letterSpacing: "-0.025em",
                    lineHeight: 1.1,
                  }}
                >
                  연차 {a.leaveDays}일권
                </div>
                <div style={{ fontSize: 13, color: p.inkSoft, marginTop: 8, lineHeight: 1.5 }}>
                  낙찰 시 즉시 연차 {a.leaveDays}일이 부여됩니다. 사용 시점은 자유롭게 선택할 수 있어요.
                </div>
              </div>

              <div style={{ padding: "0 24px 18px", display: "flex", flexDirection: "column", gap: 6 }}>
                <AttrRow p={p} icon={<Icon.cal size={14} />} k="사용 기한" v="2026-12-31까지" />
                <AttrRow p={p} icon={<Icon.bolt size={14} />} k="차감 순위" v="최우선 (1순위)" />
                <AttrRow p={p} icon={<Icon.shield size={14} />} k="정산 영향" v="연말 수당 제외" />
                <AttrRow p={p} icon={<Icon.gift size={14} />} k="양도 가능" v="불가 · 본인 사용만" />
              </div>

              <div
                style={{
                  marginTop: "auto",
                  padding: "14px 24px 18px",
                  borderTop: `1px solid ${p.line}`,
                  background: p.bg,
                }}
              >
                <div style={{ fontSize: 11, color: p.inkMuted, fontWeight: 600, marginBottom: 8 }}>
                  출처
                </div>
                <div style={{ fontSize: 12, color: p.inkSoft, lineHeight: 1.4 }}>
                  공용 풀 · 다수의 직원이 기여
                </div>
              </div>
            </Card>

            {/* CENTER — Bid panel */}
            <Card p={p} padding={0} style={{ display: "flex", flexDirection: "column", overflow: "hidden" }}>
              <div
                style={{
                  padding: "14px 24px",
                  borderBottom: `1px solid ${p.line}`,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <Pill p={p} tone={a.status === "OPEN" ? "success" : "neutral"} size="sm">
                    <span
                      style={{
                        width: 6,
                        height: 6,
                        background: a.status === "OPEN" ? p.success : p.inkMuted,
                        borderRadius: "50%",
                        marginRight: 2,
                      }}
                    />
                    {a.status === "OPEN" ? "진행 중" : a.status}
                  </Pill>
                  <span style={{ fontSize: 12, color: p.inkMuted }}>
                    <span className="mono" style={{ color: p.inkSoft, fontWeight: 600 }}>
                      {a.bidCount}
                    </span>
                    회 입찰
                  </span>
                </div>
                <div
                  style={{
                    fontSize: 12,
                    color: p.inkMuted,
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 6,
                  }}
                >
                  <Icon.clock size={13} />
                  {isClosed ? (
                    "마감됨"
                  ) : (
                    <>
                      마감까지{" "}
                      <span className="mono" style={{ color: p.ink, fontWeight: 700, marginLeft: 2 }}>
                        <Countdown endsAt={endsAt} />
                      </span>
                    </>
                  )}
                </div>
              </div>

              <div style={{ padding: "28px 28px 20px" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end" }}>
                  <div>
                    <div style={{ fontSize: 12, color: p.inkMuted, fontWeight: 600, marginBottom: 6 }}>
                      현재 입찰가
                    </div>
                    <div style={{ display: "flex", alignItems: "baseline", gap: 8 }}>
                      <div
                        className="mono"
                        style={{
                          fontSize: 52,
                          fontWeight: 800,
                          letterSpacing: "-0.035em",
                          color: p.ink,
                          lineHeight: 1,
                        }}
                      >
                        {fmt.point(highest)}
                      </div>
                      <div style={{ fontSize: 20, fontWeight: 700, color: p.inkSoft }}>P</div>
                    </div>
                    <div style={{ fontSize: 12, color: p.inkMuted, marginTop: 8 }}>
                      최고 입찰자{" "}
                      <span style={{ color: p.ink, fontWeight: 600 }}>
                        {a.recentBids[0]?.userName ?? "—"}
                      </span>
                    </div>
                  </div>
                  <div style={{ textAlign: "right" }}>
                    <div style={{ fontSize: 11, color: p.inkMuted, fontWeight: 600, marginBottom: 4 }}>
                      시작가
                    </div>
                    <div className="mono" style={{ fontSize: 16, fontWeight: 700, color: p.inkSoft }}>
                      {fmt.point(startPrice)} P
                    </div>
                    {highest > startPrice && (
                      <div style={{ fontSize: 11, color: p.success, fontWeight: 600, marginTop: 4 }}>
                        +{Math.round(((highest - startPrice) / startPrice) * 100)}%
                      </div>
                    )}
                  </div>
                </div>

                <div style={{ marginTop: 18 }}>
                  <div
                    style={{
                      height: 6,
                      background: p.bg,
                      borderRadius: 999,
                      overflow: "hidden",
                      position: "relative",
                    }}
                  >
                    <div
                      style={{
                        width: `${progressPct(startedAt, endsAt)}%`,
                        height: "100%",
                        background: p.accent,
                        borderRadius: 999,
                      }}
                    />
                  </div>
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      marginTop: 6,
                      fontSize: 11,
                      color: p.inkMuted,
                    }}
                  >
                    <span>
                      <span className="mono">{formatDateTime(startedAt)}</span> 시작
                    </span>
                    <span>
                      <span className="mono">{formatDateTime(endsAt)}</span> 마감
                    </span>
                  </div>
                </div>
              </div>

              <div
                style={{
                  margin: "0 28px",
                  padding: 20,
                  background: p.bg,
                  borderRadius: 16,
                  opacity: isClosed ? 0.5 : 1,
                }}
              >
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    marginBottom: 12,
                  }}
                >
                  <div style={{ fontSize: 13, color: p.inkSoft, fontWeight: 700 }}>입찰가 입력</div>
                  <div style={{ fontSize: 11, color: p.inkMuted }}>
                    최소 입찰{" "}
                    <span className="mono" style={{ color: p.inkSoft, fontWeight: 600 }}>
                      +{fmt.point(minIncrement)} P
                    </span>
                  </div>
                </div>
                <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                  <button
                    style={btnStep(p)}
                    disabled={isClosed || bidAmount === null}
                    onClick={() =>
                      setBidAmount((b) => Math.max(highest + minIncrement, (b ?? 0) - minIncrement))
                    }
                  >
                    −
                  </button>
                  <div
                    style={{
                      flex: 1,
                      height: 52,
                      borderRadius: 12,
                      background: p.surface,
                      border: `1px solid ${p.line}`,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      padding: "0 16px",
                    }}
                  >
                    <div style={{ fontSize: 11, color: p.inkMuted, fontWeight: 600 }}>내 입찰가</div>
                    <div
                      className="mono"
                      style={{
                        fontSize: 22,
                        fontWeight: 800,
                        color: p.ink,
                        letterSpacing: "-0.025em",
                      }}
                    >
                      {fmt.point(bidAmount ?? 0)}
                      <span style={{ fontSize: 13, color: p.inkMuted, marginLeft: 4 }}>P</span>
                    </div>
                  </div>
                  <button
                    style={btnStep(p)}
                    disabled={isClosed}
                    onClick={() => setBidAmount((b) => (b ?? highest) + minIncrement)}
                  >
                    +
                  </button>
                </div>
                <div style={{ display: "flex", gap: 6, marginTop: 10 }}>
                  {[100, 200, 500, 1000].map((q) => (
                    <button
                      key={q}
                      className="mono"
                      style={chipStyle(p)}
                      disabled={isClosed}
                      onClick={() => setBidAmount((b) => (b ?? highest) + q)}
                    >
                      +{q} P
                    </button>
                  ))}
                </div>
              </div>

              <div style={{ padding: "14px 28px 22px", display: "flex", alignItems: "center", gap: 12 }}>
                <div style={{ flex: 1, fontSize: 12, color: p.inkMuted }}>
                  내 잔액{" "}
                  <span className="mono" style={{ color: p.ink, fontWeight: 700, marginLeft: 4 }}>
                    {myBalance !== null ? `${fmt.point(myBalance)} P` : "—"}
                  </span>
                  {afterBalance !== null && (
                    <span style={{ marginLeft: 8, color: insufficient ? p.danger : p.inkMuted }}>
                      · 입찰 후 잔액{" "}
                      <span
                        className="mono"
                        style={{
                          color: insufficient ? p.danger : p.inkSoft,
                          fontWeight: 600,
                        }}
                      >
                        {fmt.point(afterBalance)} P
                      </span>
                    </span>
                  )}
                </div>
                <Btn
                  p={p}
                  variant="primary"
                  size="lg"
                  style={{ padding: "0 32px" }}
                  disabled={isClosed || submitting || insufficient || bidAmount === null}
                  onClick={onSubmitBid}
                >
                  <span style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
                    <Icon.hammer size={18} />
                    {submitting ? "처리 중…" : isClosed ? "마감됨" : "입찰하기"}
                  </span>
                </Btn>
              </div>
            </Card>

            {/* RIGHT — Bid history */}
            <Card
              p={p}
              padding={0}
              style={{ display: "flex", flexDirection: "column", overflow: "hidden", minHeight: 0 }}
            >
              <div
                style={{
                  padding: "16px 18px 12px",
                  borderBottom: `1px solid ${p.line}`,
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                }}
              >
                <div style={{ fontSize: 14, fontWeight: 800, color: p.ink, letterSpacing: "-0.01em" }}>
                  입찰 기록
                </div>
                <span className="mono" style={{ fontSize: 11, color: p.inkMuted, fontWeight: 600 }}>
                  총 {a.bidCount}건
                </span>
              </div>
              <div
                style={{
                  padding: "8px 18px",
                  display: "grid",
                  gridTemplateColumns: "1fr auto auto",
                  gap: 10,
                  fontSize: 10,
                  color: p.inkMuted,
                  fontWeight: 700,
                  letterSpacing: "0.04em",
                  borderBottom: `1px solid ${p.line}`,
                  textTransform: "uppercase",
                }}
              >
                <span>입찰자</span>
                <span style={{ textAlign: "right" }}>금액</span>
                <span style={{ textAlign: "right", minWidth: 50 }}>시각</span>
              </div>
              <div style={{ overflow: "auto", flex: 1 }}>
                {a.recentBids.length === 0 && (
                  <div style={{ padding: 24, textAlign: "center", color: p.inkMuted, fontSize: 12 }}>
                    아직 입찰이 없습니다.
                  </div>
                )}
                {a.recentBids.map((b, i) => {
                  const mine = b.userId === String(user.id);
                  return (
                    <div
                      key={`${b.placedAt}-${i}`}
                      style={{
                        padding: "11px 18px",
                        display: "grid",
                        gridTemplateColumns: "1fr auto auto",
                        gap: 10,
                        alignItems: "center",
                        borderBottom:
                          i < a.recentBids.length - 1 ? `1px solid ${p.line}` : "none",
                        background: mine ? p.accentSoft : "transparent",
                      }}
                    >
                      <div style={{ display: "flex", alignItems: "center", gap: 8, minWidth: 0 }}>
                        <Avatar p={p} name={b.userName} size={24} />
                        <div
                          style={{
                            display: "flex",
                            alignItems: "center",
                            gap: 4,
                            minWidth: 0,
                          }}
                        >
                          <span
                            style={{
                              fontSize: 13,
                              fontWeight: 600,
                              color: p.ink,
                              overflow: "hidden",
                              textOverflow: "ellipsis",
                              whiteSpace: "nowrap",
                            }}
                          >
                            {b.userName}
                          </span>
                          {mine && (
                            <span
                              style={{
                                fontSize: 9,
                                fontWeight: 700,
                                color: p.accent,
                                padding: "1px 5px",
                                background: p.surface,
                                borderRadius: 4,
                                border: `1px solid ${p.accent}`,
                              }}
                            >
                              나
                            </span>
                          )}
                          {i === 0 && (
                            <span
                              style={{
                                fontSize: 9,
                                fontWeight: 700,
                                color: p.success,
                                padding: "1px 5px",
                                background: "#E6F6F0",
                                borderRadius: 4,
                              }}
                            >
                              1위
                            </span>
                          )}
                        </div>
                      </div>
                      <div
                        className="mono"
                        style={{
                          fontSize: 13,
                          fontWeight: 700,
                          color: i === 0 ? p.ink : p.inkSoft,
                          letterSpacing: "-0.01em",
                          textAlign: "right",
                        }}
                      >
                        {fmt.point(Number(b.amount))}
                        <span style={{ fontSize: 10, color: p.inkMuted, marginLeft: 2, fontWeight: 600 }}>
                          P
                        </span>
                      </div>
                      <div
                        className="mono"
                        style={{
                          fontSize: 10,
                          color: p.inkMuted,
                          textAlign: "right",
                          minWidth: 50,
                          fontWeight: 600,
                        }}
                      >
                        {relTime(new Date(b.placedAt))}
                      </div>
                    </div>
                  );
                })}
              </div>
            </Card>
          </div>
        </div>
      </div>
    </ScreenFrame>
  );
}

function Countdown({ endsAt }: { endsAt: Date }) {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);
  const ms = endsAt.getTime() - now;
  if (ms <= 0) return <>마감됨</>;
  const s = Math.floor(ms / 1000);
  const days = Math.floor(s / 86400);
  const hours = Math.floor((s % 86400) / 3600);
  const mins = Math.floor((s % 3600) / 60);
  const secs = s % 60;
  if (days > 0)
    return (
      <>
        {days}일 {hours}시간
      </>
    );
  if (hours > 0)
    return (
      <>
        {hours}시간 {mins}분
      </>
    );
  return (
    <>
      {mins}분 {String(secs).padStart(2, "0")}초
    </>
  );
}

function progressPct(start: Date, end: Date): number {
  const total = end.getTime() - start.getTime();
  const elapsed = Date.now() - start.getTime();
  if (total <= 0) return 100;
  return Math.max(0, Math.min(100, (elapsed / total) * 100));
}

function formatDateTime(d: Date): string {
  return d.toLocaleString("ko-KR", {
    month: "numeric",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function relTime(d: Date): string {
  const diff = Math.max(0, Math.floor((Date.now() - d.getTime()) / 1000));
  if (diff < 5) return "방금";
  if (diff < 60) return `${diff}초 전`;
  if (diff < 3600) return `${Math.floor(diff / 60)}분 전`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}시간 전`;
  return `${Math.floor(diff / 86400)}일 전`;
}

function ItemPortrait({ p, auctionId }: { p: Palette; auctionId: string }) {
  return (
    <div
      style={{
        height: 240,
        background: `linear-gradient(180deg, ${p.bgDeep} 0%, ${p.bg} 100%)`,
        position: "relative",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        borderBottom: `1px solid ${p.line}`,
        overflow: "hidden",
      }}
    >
      <svg
        width="100%"
        height="100%"
        viewBox="0 0 440 240"
        preserveAspectRatio="xMidYMid slice"
        style={{ position: "absolute", inset: 0, opacity: 0.4 }}
      >
        <defs>
          <pattern id="dotgrid" x="0" y="0" width="20" height="20" patternUnits="userSpaceOnUse">
            <circle cx="10" cy="10" r="1" fill={p.accent} opacity="0.25" />
          </pattern>
        </defs>
        <rect width="100%" height="100%" fill="url(#dotgrid)" />
      </svg>
      <div
        style={{
          position: "absolute",
          width: 240,
          height: 240,
          borderRadius: "50%",
          background: `radial-gradient(circle, ${p.accent}22 0%, transparent 65%)`,
          filter: "blur(8px)",
        }}
      />
      <div style={{ position: "relative", zIndex: 1 }}>
        <DayPassCard p={p} auctionId={auctionId} />
      </div>
      <div
        style={{
          position: "absolute",
          top: 14,
          left: 14,
          display: "flex",
          alignItems: "center",
          gap: 6,
          padding: "5px 10px",
          borderRadius: 8,
          background: p.surface,
          border: `1px solid ${p.line}`,
          fontSize: 10,
          fontWeight: 700,
          color: p.inkSoft,
          letterSpacing: "0.04em",
          textTransform: "uppercase",
        }}
      >
        <span style={{ width: 6, height: 6, background: p.accent, borderRadius: 2 }} />
        Standard
      </div>
      <div
        style={{
          position: "absolute",
          top: 14,
          right: 14,
          padding: "5px 10px",
          borderRadius: 8,
          background: p.ink,
          color: "#fff",
          fontSize: 10,
          fontWeight: 700,
          letterSpacing: "0.04em",
          fontFamily: FONT.mono,
        }}
      >
        × 1
      </div>
    </div>
  );
}

function DayPassCard({ p, auctionId }: { p: Palette; auctionId: string }) {
  return (
    <div
      style={{
        width: 220,
        height: 168,
        background: p.surface,
        borderRadius: 14,
        border: `1.5px solid ${p.line}`,
        boxShadow: `0 8px 24px ${p.accent}1f, 0 1px 0 rgba(11,25,41,0.04)`,
        position: "relative",
        overflow: "hidden",
        display: "flex",
        flexDirection: "column",
      }}
    >
      <div
        style={{
          height: 38,
          background: p.accent,
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "0 14px",
        }}
      >
        <div style={{ fontSize: 10, fontWeight: 800, color: "#fff", letterSpacing: "0.12em" }}>
          ANNUAL LEAVE
        </div>
      </div>
      <div
        style={{
          flex: 1,
          padding: "14px 16px 12px",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
        }}
      >
        <div>
          <div style={{ fontSize: 10, color: p.inkMuted, fontWeight: 600, letterSpacing: "0.04em" }}>
            VALID FOR
          </div>
          <div style={{ display: "flex", alignItems: "baseline", gap: 6, marginTop: 2 }}>
            <div
              className="mono"
              style={{
                fontSize: 36,
                fontWeight: 800,
                color: p.ink,
                letterSpacing: "-0.04em",
                lineHeight: 1,
              }}
            >
              1
            </div>
            <div style={{ fontSize: 14, fontWeight: 700, color: p.inkSoft }}>DAY</div>
            <div style={{ fontSize: 11, color: p.inkMuted, marginLeft: 4 }}>OFF</div>
          </div>
        </div>
        <div className="mono" style={{ fontSize: 9, color: p.inkMuted, fontWeight: 700, letterSpacing: "0.06em" }}>
          NO. {auctionId}
        </div>
      </div>
    </div>
  );
}

function AttrRow({ p, icon, k, v }: { p: Palette; icon: ReactNode; k: string; v: string }) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 10,
        padding: "8px 12px",
        background: p.bg,
        borderRadius: 10,
      }}
    >
      <span style={{ color: p.inkMuted, display: "inline-flex" }}>{icon}</span>
      <span style={{ fontSize: 12, color: p.inkMuted, fontWeight: 500, flex: 1 }}>{k}</span>
      <span className="mono" style={{ fontSize: 12, color: p.ink, fontWeight: 700 }}>
        {v}
      </span>
    </div>
  );
}

function btnStep(p: Palette): React.CSSProperties {
  return {
    width: 44,
    height: 52,
    borderRadius: 12,
    background: p.surface,
    border: `1px solid ${p.line}`,
    color: p.inkSoft,
    fontSize: 20,
    fontWeight: 600,
    cursor: "pointer",
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    fontFamily: FONT.sans,
  };
}

function chipStyle(p: Palette): React.CSSProperties {
  return {
    padding: "6px 12px",
    fontSize: 12,
    fontWeight: 600,
    background: p.surface,
    color: p.inkSoft,
    borderRadius: 8,
    cursor: "pointer",
    border: `1px solid ${p.line}`,
    fontFamily: FONT.mono,
  };
}
