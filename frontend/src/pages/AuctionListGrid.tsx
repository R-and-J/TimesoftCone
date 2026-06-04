import { useState } from "react";
import { PALETTES, FONT, fmt } from "@/lib/tokens";
import { Btn, Card, Pill, TopNav } from "@/components/atoms";
import { Icon } from "@/components/icons";
import { ScreenFrame } from "@/components/ScreenFrame";
import { ListVariantSwitcher } from "@/components/ListVariantSwitcher";
import { YearSelect } from "@/components/YearSelect";
import type { Palette } from "@/lib/tokens";
import { useQuery } from "@/lib/use-query";
import { listAuctions, type AuctionListItem } from "@/lib/queries";
import { useNavigate } from "react-router-dom";

export default function AuctionListGridPage() {
  const p = PALETTES.cobalt;
  const navigate = useNavigate();
  // 연도 필터(CUT-9 이후 LeavePool 배치로 익년도 매물이 대량 생성되므로 기본 올해).
  const [year, setYear] = useState<number | undefined>(new Date().getFullYear());
  const [tab, setTab] = useState<"open" | "upcoming" | "closed">("open");
  const q = useQuery(() => listAuctions(undefined, year), [year]);

  const all = q.data ?? [];
  const open = all.filter((a) => a.status === "OPEN");
  const upcoming = all.filter((a) => a.status === "CREATED");
  const closed = all.filter((a) => a.status === "AWARDED" || a.status === "UNSOLD");
  const shown: AuctionListItem[] = tab === "open" ? open : tab === "upcoming" ? upcoming : closed;
  // 마감 탭 헤더 통계 — AWARDED 매물의 낙찰가 합계가 곧 에스크로우 적립.
  const awarded = closed.filter((a) => a.status === "AWARDED");
  const awardedEscrow = awarded.reduce((sum, a) => sum + Number(a.highest), 0);
  const unsoldCount = closed.length - awarded.length;

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
        <div style={{ flex: 1, padding: "28px 40px", overflow: "auto" }}>
          <div
            style={{
              display: "flex",
              alignItems: "flex-end",
              justifyContent: "space-between",
              marginBottom: 20,
            }}
          >
            <div>
              <div style={{ fontSize: 13, color: p.inkMuted, fontWeight: 500 }}>
                경매장
              </div>
              <div
                style={{
                  fontSize: 30,
                  fontWeight: 800,
                  color: p.ink,
                  letterSpacing: "-0.025em",
                  marginTop: 4,
                }}
              >
                진행 중인 경매{" "}
                <span className="mono" style={{ color: p.accent }}>
                  {open.length}
                </span>
                건 + 오픈 예정{" "}
                <span className="mono">{upcoming.length}</span>건
              </div>
            </div>
            <div style={{ display: "flex", gap: 8 }}>
              <YearSelect p={p} value={year} onChange={setYear} />
              <Btn p={p} variant="ghost" size="md">
                <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
                  <Icon.filter size={14} /> 필터
                </span>
              </Btn>
              <Btn p={p} variant="ghost" size="md">
                <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
                  <Icon.sort size={14} /> 마감 임박순
                </span>
              </Btn>
              <ListVariantSwitcher p={p} active="grid" />
            </div>
          </div>

          <div
            style={{
              display: "flex",
              gap: 4,
              marginBottom: 16,
              borderBottom: `1px solid ${p.line}`,
            }}
          >
            {(
              [
                { id: "open", l: "진행 중", n: open.length },
                { id: "upcoming", l: "오픈 예정", n: upcoming.length },
                { id: "closed", l: "마감", n: closed.length },
              ] as const
            ).map((t) => {
              const on = tab === t.id;
              return (
                <div
                  key={t.id}
                  onClick={() => setTab(t.id)}
                  style={{
                    padding: "12px 18px",
                    fontSize: 14,
                    fontWeight: 700,
                    color: on ? p.ink : p.inkMuted,
                    borderBottom: `2px solid ${on ? p.accent : "transparent"}`,
                    marginBottom: -1,
                    cursor: "pointer",
                  }}
                >
                  {t.l}{" "}
                  <span style={{ color: on ? p.accent : p.inkMuted, marginLeft: 4 }}>{t.n}</span>
                </div>
              );
            })}
          </div>

          {tab === "closed" && q.data && (
            <Card p={p} padding={14} style={{ marginBottom: 16 }}>
              <div style={{ display: "flex", alignItems: "baseline", gap: 16, flexWrap: "wrap" }}>
                <div style={{ fontSize: 11, color: p.inkMuted, fontWeight: 700 }}>이번 연도 마감 합계</div>
                <div style={{ display: "flex", alignItems: "baseline", gap: 6 }}>
                  <span style={{ fontSize: 12, color: p.inkSoft, fontWeight: 600 }}>에스크로우 적립</span>
                  <span className="mono" style={{ fontSize: 20, color: p.accent, fontWeight: 800, letterSpacing: "-0.02em" }}>
                    {fmt.point(awardedEscrow)}
                  </span>
                  <span style={{ fontSize: 12, color: p.inkMuted, fontWeight: 600 }}>콘</span>
                </div>
                <div style={{ fontSize: 12, color: p.inkSoft }}>
                  낙찰 <b style={{ color: p.ink }}>{awarded.length}</b>건 · 유찰 <b style={{ color: p.ink }}>{unsoldCount}</b>건
                </div>
                <div style={{ flex: 1 }} />
                <div style={{ fontSize: 11, color: p.inkMuted }}>
                  낙찰가가 곧 에스크로우(연말 배당 재원).
                </div>
              </div>
            </Card>
          )}

          {q.loading && (
            <div style={{ padding: 40, textAlign: "center", color: p.inkMuted }}>
              불러오는 중…
            </div>
          )}
          {q.error && (
            <Card p={p} padding={20} style={{ borderLeft: `3px solid ${p.danger}` }}>
              <div style={{ fontSize: 13, color: p.danger, fontWeight: 700 }}>
                백엔드 연결 실패
              </div>
              <div style={{ fontSize: 12, color: p.inkMuted, marginTop: 4 }}>
                {q.error.message}
              </div>
              <div style={{ fontSize: 11, color: p.inkMuted, marginTop: 8 }}>
                <code>cd backend && npm run start:dev</code> 실행을 확인하세요.
              </div>
            </Card>
          )}

          {q.data && (
            <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 16 }}>
              {shown.map((a) => (
                <AuctionCard
                  key={a.id}
                  p={p}
                  a={a}
                  onClick={() => navigate(`/auction/detail/${a.id}`)}
                />
              ))}
              {shown.length === 0 && (
                <div
                  style={{
                    gridColumn: "1 / -1",
                    padding: 40,
                    textAlign: "center",
                    color: p.inkMuted,
                  }}
                >
                  {tab === "open" ? "진행 중인" : tab === "upcoming" ? "오픈 예정인" : "마감된"} 경매가 없습니다.
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </ScreenFrame>
  );
}

function AuctionCard({
  p,
  a,
  onClick,
}: {
  p: Palette;
  a: AuctionListItem;
  onClick: () => void;
}) {
  const isOpen = a.status === "OPEN";
  const isUpcoming = a.status === "CREATED";
  const isAwarded = a.status === "AWARDED";
  const isUnsold = a.status === "UNSOLD";
  const isClosed = isAwarded || isUnsold;
  const highest = Number(a.highest);
  const startPrice = Number(a.startPrice);
  const isHot = isOpen && new Date(a.endsAt).getTime() - Date.now() < 30 * 60 * 1000;
  const fmtTime = (d: Date) =>
    d.toLocaleString("ko-KR", { month: "numeric", day: "numeric", hour: "2-digit", minute: "2-digit" });
  const endLabel = fmtTime(new Date(a.endsAt));
  const closedAtLabel = a.settledAt ? fmtTime(new Date(a.settledAt)) : endLabel;

  return (
    <Card p={p} padding={20} hover style={{ position: "relative" }} onClick={onClick}>
      {isHot && (
        <div style={{ position: "absolute", top: 16, right: 16 }}>
          <Pill p={p} tone="danger" size="sm">
            🔥 곧 마감
          </Pill>
        </div>
      )}
      {isUpcoming && (
        <div style={{ position: "absolute", top: 16, right: 16 }}>
          <Pill p={p} tone="neutral" size="sm">
            예정
          </Pill>
        </div>
      )}
      {isAwarded && (
        <div style={{ position: "absolute", top: 16, right: 16 }}>
          <Pill p={p} tone="success" size="sm">낙찰</Pill>
        </div>
      )}
      {isUnsold && (
        <div style={{ position: "absolute", top: 16, right: 16 }}>
          <Pill p={p} tone="warn" size="sm">유찰</Pill>
        </div>
      )}
      <div className="mono" style={{ fontSize: 11, color: p.inkMuted, fontWeight: 600 }}>
        {a.id}
      </div>
      <div
        style={{
          fontSize: 15,
          fontWeight: 700,
          color: p.ink,
          marginTop: 6,
          letterSpacing: "-0.01em",
        }}
      >
        연차 {a.leaveDays}일권
      </div>
      {isOpen ? (
        <>
          <div style={{ marginTop: 18 }}>
            <div style={{ fontSize: 11, color: p.inkMuted, fontWeight: 600, marginBottom: 4 }}>
              현재 최고가
            </div>
            <div
              className="mono"
              style={{
                fontSize: 32,
                fontWeight: 800,
                color: p.ink,
                letterSpacing: "-0.025em",
                lineHeight: 1,
              }}
            >
              {fmt.point(highest)}
              <span style={{ fontSize: 14, color: p.inkMuted, fontWeight: 600, marginLeft: 4 }}>콘</span>
            </div>
          </div>
          <div
            style={{
              marginTop: 14,
              height: 4,
              background: p.bg,
              borderRadius: 999,
              overflow: "hidden",
            }}
          >
            <div
              style={{
                width: `${Math.min(100, a.bidCount * 3)}%`,
                height: "100%",
                background: isHot ? p.danger : p.accent,
                borderRadius: 999,
              }}
            />
          </div>
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              marginTop: 10,
              fontSize: 11,
              color: p.inkMuted,
            }}
          >
            <span>입찰 {a.bidCount}회</span>
            <span style={{ color: isHot ? p.danger : p.inkSoft, fontWeight: 700 }}>
              {endLabel} 마감
            </span>
          </div>
        </>
      ) : isUpcoming ? (
        <>
          <div style={{ marginTop: 18 }}>
            <div style={{ fontSize: 11, color: p.inkMuted, fontWeight: 600, marginBottom: 4 }}>
              시작가
            </div>
            <div
              className="mono"
              style={{
                fontSize: 28,
                fontWeight: 700,
                color: p.inkMuted,
                letterSpacing: "-0.025em",
                lineHeight: 1,
              }}
            >
              {fmt.point(startPrice)}
              <span style={{ fontSize: 13, marginLeft: 4 }}>콘</span>
            </div>
          </div>
          <div style={{ marginTop: 24, fontSize: 12, color: p.inkSoft, fontWeight: 600 }}>
            {fmtTime(new Date(a.startedAt))} 오픈 예정
          </div>
        </>
      ) : (
        // AWARDED / UNSOLD — 좌측하단: 마감시간, 우측하단: 낙찰자(있으면) / 유찰 표시.
        <>
          <div style={{ marginTop: 18 }}>
            <div style={{ fontSize: 11, color: p.inkMuted, fontWeight: 600, marginBottom: 4 }}>
              {isAwarded ? "낙찰가" : "시작가"}
            </div>
            <div
              className="mono"
              style={{
                fontSize: 28,
                fontWeight: 700,
                color: isAwarded ? p.ink : p.inkMuted,
                letterSpacing: "-0.025em",
                lineHeight: 1,
              }}
            >
              {fmt.point(isAwarded ? highest : startPrice)}
              <span style={{ fontSize: 13, marginLeft: 4 }}>콘</span>
            </div>
          </div>
          <div
            style={{
              marginTop: 24,
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              fontSize: 12,
              color: p.inkSoft,
              fontWeight: 600,
            }}
          >
            <span>{closedAtLabel} 마감</span>
            <span style={{ color: isAwarded ? p.ink : p.inkMuted, fontWeight: 700 }}>
              {isAwarded ? (a.highestBidderName ?? "익명") : "낙찰자 없음"}
            </span>
          </div>
        </>
      )}
    </Card>
  );
}
