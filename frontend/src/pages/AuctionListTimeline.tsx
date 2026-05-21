import { useNavigate } from "react-router-dom";
import { PALETTES, FONT } from "@/lib/tokens";
import { Card, TopNav } from "@/components/atoms";
import { ScreenFrame } from "@/components/ScreenFrame";
import { ListVariantSwitcher } from "@/components/ListVariantSwitcher";
import { useQuery } from "@/lib/use-query";
import { listAuctions, type AuctionListItem } from "@/lib/queries";
import type { CSSProperties } from "react";

const HOURS = [9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19] as const;

export default function AuctionListTimelinePage() {
  const p = PALETTES.cobalt;
  const navigate = useNavigate();
  const q = useQuery(() => listAuctions(), []);

  const days = buildWeek();
  const colWidth = `repeat(${HOURS.length}, 1fr)`;

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
              <div style={{ fontSize: 13, color: p.inkMuted, fontWeight: 500 }}>경매장 · 주간 뷰</div>
              <div
                style={{
                  fontSize: 30,
                  fontWeight: 800,
                  color: p.ink,
                  letterSpacing: "-0.025em",
                  marginTop: 4,
                }}
              >
                주간 경매 일정
              </div>
            </div>
            <ListVariantSwitcher p={p} active="timeline" />
          </div>

          {q.loading && <div style={{ color: p.inkMuted, padding: 24 }}>불러오는 중…</div>}
          {q.error && (
            <Card p={p} padding={20} style={{ borderLeft: `3px solid ${p.danger}` }}>
              <div style={{ fontSize: 13, color: p.danger, fontWeight: 700 }}>
                백엔드 연결 실패
              </div>
              <div style={{ fontSize: 12, color: p.inkMuted, marginTop: 4 }}>{q.error.message}</div>
            </Card>
          )}

          {q.data && (
            <Card p={p} padding={0} style={{ overflow: "hidden" }}>
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: `120px ${colWidth}`,
                  borderBottom: `1px solid ${p.line}`,
                  background: p.bg,
                }}
              >
                <div style={{ padding: "12px 16px", fontSize: 11, color: p.inkMuted, fontWeight: 700 }}>
                  날짜 / 시간
                </div>
                {HOURS.map((h) => (
                  <div
                    key={h}
                    style={{
                      padding: "12px 0",
                      textAlign: "center",
                      fontSize: 11,
                      color: p.inkMuted,
                      fontWeight: 600,
                      borderLeft: `1px solid ${p.line}`,
                    }}
                  >
                    <span className="mono">{String(h).padStart(2, "0")}:00</span>
                  </div>
                ))}
              </div>

              {days.map((d, di) => {
                const dayBars = bucketize(q.data!, d.start, d.end);
                const isToday = sameDay(d.start, new Date());
                return (
                  <div
                    key={di}
                    style={{
                      display: "grid",
                      gridTemplateColumns: `120px ${colWidth}`,
                      position: "relative",
                      borderBottom: di === days.length - 1 ? "none" : `1px solid ${p.line}`,
                      minHeight: 110,
                    }}
                  >
                    <div
                      style={{
                        padding: "14px 16px",
                        display: "flex",
                        flexDirection: "column",
                        justifyContent: "center",
                        borderRight: `1px solid ${p.line}`,
                        background: isToday ? p.accentSoft : p.surface,
                      }}
                    >
                      <div style={{ fontSize: 11, color: p.inkMuted, fontWeight: 600 }}>
                        {dayOfWeek(d.start)}
                      </div>
                      <div style={{ fontSize: 16, fontWeight: 800, color: p.ink, marginTop: 2 }}>
                        {d.start.getMonth() + 1}/{d.start.getDate()}
                      </div>
                      {isToday && (
                        <div style={{ fontSize: 10, color: p.accent, fontWeight: 700, marginTop: 2 }}>
                          오늘
                        </div>
                      )}
                    </div>
                    <div
                      style={{
                        gridColumn: `2 / span ${HOURS.length}`,
                        position: "relative",
                        padding: "10px 0",
                      }}
                    >
                      {HOURS.map((_, i) => (
                        <div
                          key={i}
                          style={{
                            position: "absolute",
                            top: 0,
                            bottom: 0,
                            left: `${(i / HOURS.length) * 100}%`,
                            borderLeft: i === 0 ? "none" : `1px solid ${p.line}`,
                          }}
                        />
                      ))}
                      {isToday && <NowLine p={p} />}
                      {dayBars.map((bar, i) => (
                        <Bar
                          key={bar.auction.id}
                          bar={bar}
                          idx={i}
                          onClick={() => navigate(`/auction/detail/${bar.auction.id}`)}
                        />
                      ))}
                    </div>
                  </div>
                );
              })}
            </Card>
          )}
        </div>
      </div>
    </ScreenFrame>
  );
}

type Day = { start: Date; end: Date };
type Bar = { auction: AuctionListItem; startPct: number; endPct: number };

function buildWeek(): Day[] {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return Array.from({ length: 5 }).map((_, i) => {
    const start = new Date(today);
    start.setDate(today.getDate() + i);
    const end = new Date(start);
    end.setDate(end.getDate() + 1);
    return { start, end };
  });
}

function bucketize(all: AuctionListItem[], dayStart: Date, dayEnd: Date): Bar[] {
  const dayStartH = HOURS[0];
  const dayEndH = HOURS[HOURS.length - 1] + 1;
  const hoursSpan = dayEndH - dayStartH;
  return all
    .filter((a) => {
      const ends = new Date(a.endsAt);
      return ends >= dayStart && ends < dayEnd;
    })
    .map((a) => {
      const started = new Date(a.startedAt);
      const ends = new Date(a.endsAt);
      const startInDay = started < dayStart ? dayStart : started;
      const startHour = hourFraction(startInDay);
      const endHour = hourFraction(ends);
      return {
        auction: a,
        startPct: Math.max(0, ((startHour - dayStartH) / hoursSpan) * 100),
        endPct: Math.min(100, ((endHour - dayStartH) / hoursSpan) * 100),
      };
    });
}

function hourFraction(d: Date): number {
  return d.getHours() + d.getMinutes() / 60;
}

function dayOfWeek(d: Date): string {
  return ["일", "월", "화", "수", "목", "금", "토"][d.getDay()] + "요일";
}

function sameDay(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

function NowLine({ p }: { p: { danger: string; surface: string } }) {
  const now = new Date();
  const dayStartH = HOURS[0];
  const dayEndH = HOURS[HOURS.length - 1] + 1;
  const hoursSpan = dayEndH - dayStartH;
  const cur = hourFraction(now);
  if (cur < dayStartH || cur > dayEndH) return null;
  return (
    <div
      style={{
        position: "absolute",
        top: 0,
        bottom: 0,
        left: `${((cur - dayStartH) / hoursSpan) * 100}%`,
        width: 2,
        background: p.danger,
        zIndex: 3,
      }}
    >
      <div
        className="mono"
        style={{
          position: "absolute",
          top: -22,
          left: -24,
          fontSize: 10,
          color: p.danger,
          fontWeight: 700,
          background: p.surface,
          padding: "2px 6px",
          borderRadius: 4,
          border: `1px solid ${p.danger}`,
          whiteSpace: "nowrap",
        }}
      >
        NOW {String(now.getHours()).padStart(2, "0")}:
        {String(now.getMinutes()).padStart(2, "0")}
      </div>
    </div>
  );
}

function Bar({ bar, idx, onClick }: { bar: Bar; idx: number; onClick: () => void }) {
  const p = PALETTES.cobalt;
  const a = bar.auction;
  const colors: Record<AuctionListItem["status"], { bg: string; fg: string; border?: string }> = {
    OPEN: { bg: p.accent, fg: "#fff" },
    AWARDED: { bg: "#D0D5DD", fg: p.ink },
    UNSOLD: { bg: "#fff", fg: p.inkMuted, border: `1px dashed ${p.line}` },
    CREATED: { bg: p.bgDeep, fg: p.inkSoft, border: `1px solid ${p.line}` },
  };
  const c = colors[a.status];
  const isHot = a.status === "OPEN" && new Date(a.endsAt).getTime() - Date.now() < 30 * 60 * 1000;
  const style: CSSProperties = {
    position: "absolute",
    left: `${bar.startPct}%`,
    width: `${Math.max(2, bar.endPct - bar.startPct)}%`,
    top: 12 + idx * 28,
    height: 24,
    background: c.bg,
    color: c.fg,
    border: c.border,
    borderRadius: 8,
    padding: "0 10px",
    display: "flex",
    alignItems: "center",
    gap: 6,
    fontSize: 11,
    fontWeight: 700,
    overflow: "hidden",
    whiteSpace: "nowrap",
    textOverflow: "ellipsis",
    boxShadow: isHot
      ? `0 0 0 2px ${p.danger}, 0 4px 10px rgba(220,63,74,0.3)`
      : "none",
    cursor: "pointer",
    zIndex: isHot ? 2 : 1,
  };
  return (
    <div style={style} onClick={onClick}>
      <span className="mono" style={{ fontSize: 10, opacity: 0.85 }}>
        {a.id}
      </span>
      <span>·</span>
      <span>
        {a.status === "OPEN"
          ? isHot
            ? "⚡ 곧 마감 "
            : "진행 중 "
          : a.status === "AWARDED"
            ? "낙찰 "
            : a.status === "UNSOLD"
              ? "유찰"
              : "예정 "}
        {a.status !== "UNSOLD" && Number(a.highest).toLocaleString("ko-KR") + "P"}
      </span>
    </div>
  );
}
