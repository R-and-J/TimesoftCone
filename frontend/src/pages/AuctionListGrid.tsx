import { PALETTES, FONT, fmt } from "@/lib/tokens";
import { Btn, Card, Pill, TopNav } from "@/components/atoms";
import { Icon } from "@/components/icons";
import { ScreenFrame } from "@/components/ScreenFrame";
import { ListVariantSwitcher } from "@/components/ListVariantSwitcher";
import type { Palette } from "@/lib/tokens";
import { useQuery } from "@/lib/use-query";
import { listAuctions, type AuctionListItem } from "@/lib/queries";
import { useNavigate } from "react-router-dom";

export default function AuctionListGridPage() {
  const p = PALETTES.cobalt;
  const navigate = useNavigate();
  const q = useQuery(() => listAuctions(), []);

  const all = q.data ?? [];
  const open = all.filter((a) => a.status === "OPEN");
  const upcoming = all.filter((a) => a.status === "CREATED");
  const closed = all.filter((a) => a.status === "AWARDED" || a.status === "UNSOLD");

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
            {[
              { l: "진행 중", n: open.length, on: true },
              { l: "오픈 예정", n: upcoming.length },
              { l: "마감", n: closed.length },
            ].map((t, i) => (
              <div
                key={i}
                style={{
                  padding: "12px 18px",
                  fontSize: 14,
                  fontWeight: 700,
                  color: t.on ? p.ink : p.inkMuted,
                  borderBottom: `2px solid ${t.on ? p.accent : "transparent"}`,
                  marginBottom: -1,
                  cursor: "pointer",
                }}
              >
                {t.l}{" "}
                <span style={{ color: t.on ? p.accent : p.inkMuted, marginLeft: 4 }}>{t.n}</span>
              </div>
            ))}
          </div>

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
              {open.map((a) => (
                <AuctionCard
                  key={a.id}
                  p={p}
                  a={a}
                  onClick={() => navigate(`/auction/detail/${a.id}`)}
                />
              ))}
              {upcoming.slice(0, 4).map((a) => (
                <AuctionCard
                  key={a.id}
                  p={p}
                  a={a}
                  onClick={() => navigate(`/auction/detail/${a.id}`)}
                />
              ))}
              {open.length + upcoming.length === 0 && (
                <div
                  style={{
                    gridColumn: "1 / -1",
                    padding: 40,
                    textAlign: "center",
                    color: p.inkMuted,
                  }}
                >
                  표시할 경매가 없습니다.
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
  const highest = Number(a.highest);
  const startPrice = Number(a.startPrice);
  const isHot = isOpen && new Date(a.endsAt).getTime() - Date.now() < 30 * 60 * 1000;
  const endLabel = new Date(a.endsAt).toLocaleString("ko-KR", {
    month: "numeric",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });

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
              <span style={{ fontSize: 14, color: p.inkMuted, fontWeight: 600, marginLeft: 4 }}>P</span>
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
      ) : (
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
              <span style={{ fontSize: 13, marginLeft: 4 }}>P</span>
            </div>
          </div>
          <div style={{ marginTop: 24, fontSize: 12, color: p.inkSoft, fontWeight: 600 }}>
            {new Date(a.startedAt).toLocaleString("ko-KR", {
              month: "numeric",
              day: "numeric",
              hour: "2-digit",
              minute: "2-digit",
            })}{" "}
            오픈 예정
          </div>
        </>
      )}
    </Card>
  );
}
