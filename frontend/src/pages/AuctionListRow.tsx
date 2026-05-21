import { useNavigate } from "react-router-dom";
import { PALETTES, FONT, fmt } from "@/lib/tokens";
import { Avatar, Btn, Card, Pill, TopNav } from "@/components/atoms";
import { ScreenFrame } from "@/components/ScreenFrame";
import { ListVariantSwitcher } from "@/components/ListVariantSwitcher";
import { useQuery } from "@/lib/use-query";
import { listAuctions, type AuctionListItem } from "@/lib/queries";

export default function AuctionListRowPage() {
  const p = PALETTES.cobalt;
  const navigate = useNavigate();
  const q = useQuery(() => listAuctions(), []);

  const all = q.data ?? [];
  const open = all.filter((a) => a.status === "OPEN");
  const upcoming = all.filter((a) => a.status === "CREATED").slice(0, 2);
  const items = [...open, ...upcoming];

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
              <div style={{ fontSize: 13, color: p.inkMuted, fontWeight: 500 }}>경매장</div>
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
                  {items.length}
                </span>
                건
              </div>
            </div>
            <ListVariantSwitcher p={p} active="row" />
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
              <div style={{ fontSize: 12, color: p.inkMuted, marginTop: 4 }}>{q.error.message}</div>
            </Card>
          )}

          {q.data && (
            <Card p={p} padding={0}>
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "60px 110px 100px 1.2fr 1fr 0.8fr 1.2fr 120px",
                  gap: 16,
                  padding: "14px 24px",
                  fontSize: 12,
                  color: p.inkMuted,
                  fontWeight: 600,
                  borderBottom: `1px solid ${p.line}`,
                  alignItems: "center",
                }}
              >
                <div>상태</div>
                <div>경매 ID</div>
                <div>매물</div>
                <div style={{ textAlign: "right" }}>현재 최고가</div>
                <div>최근 입찰자</div>
                <div>입찰</div>
                <div>마감</div>
                <div></div>
              </div>
              {items.map((a, i) => (
                <Row
                  key={a.id}
                  a={a}
                  isLast={i === items.length - 1}
                  onClick={() => navigate(`/auction/detail/${a.id}`)}
                />
              ))}
              {items.length === 0 && (
                <div style={{ padding: 40, textAlign: "center", color: p.inkMuted }}>
                  표시할 경매가 없습니다.
                </div>
              )}
            </Card>
          )}

          {q.data && (
            <div style={{ display: "flex", gap: 16, marginTop: 16 }}>
              {[
                { k: "진행 중", v: open.length },
                { k: "오픈 예정", v: all.filter((a) => a.status === "CREATED").length },
                { k: "낙찰됨", v: all.filter((a) => a.status === "AWARDED").length },
                { k: "유찰됨", v: all.filter((a) => a.status === "UNSOLD").length },
              ].map((s, i) => (
                <Card key={i} p={p} padding={16} style={{ flex: 1 }}>
                  <div style={{ fontSize: 12, color: p.inkMuted, fontWeight: 600 }}>{s.k}</div>
                  <div
                    className="mono"
                    style={{
                      fontSize: 24,
                      fontWeight: 800,
                      color: p.ink,
                      marginTop: 4,
                      letterSpacing: "-0.02em",
                    }}
                  >
                    {s.v}
                    <span style={{ fontSize: 12, color: p.inkMuted, marginLeft: 4, fontWeight: 500 }}>
                      건
                    </span>
                  </div>
                </Card>
              ))}
            </div>
          )}
        </div>
      </div>
    </ScreenFrame>
  );
}

function Row({
  a,
  isLast,
  onClick,
}: {
  a: AuctionListItem;
  isLast: boolean;
  onClick: () => void;
}) {
  const p = PALETTES.cobalt;
  const highest = Number(a.highest);
  const isHot = a.status === "OPEN" && new Date(a.endsAt).getTime() - Date.now() < 30 * 60 * 1000;
  const endLabel = new Date(a.endsAt).toLocaleString("ko-KR", {
    month: "numeric",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
  const leaderName = a.highestBidder ? `User #${a.highestBidder}` : "—";

  return (
    <div
      onClick={onClick}
      style={{
        display: "grid",
        gridTemplateColumns: "60px 110px 100px 1.2fr 1fr 0.8fr 1.2fr 120px",
        gap: 16,
        padding: "18px 24px",
        alignItems: "center",
        borderBottom: isLast ? "none" : `1px solid ${p.line}`,
        background: isHot ? `linear-gradient(90deg, ${p.surface} 0%, #FFF6F7 100%)` : p.surface,
        cursor: "pointer",
      }}
    >
      <div>
        {a.status === "OPEN" ? (
          <Pill p={p} tone={isHot ? "live" : "success"} size="sm">
            {isHot ? "🔥" : "LIVE"}
          </Pill>
        ) : (
          <Pill p={p} tone="neutral" size="sm">
            예정
          </Pill>
        )}
      </div>
      <div className="mono" style={{ fontSize: 12, color: p.inkSoft, fontWeight: 600 }}>
        {a.id}
      </div>
      <div style={{ fontSize: 13, color: p.ink, fontWeight: 600 }}>연차 1일권</div>
      <div
        className="mono"
        style={{
          textAlign: "right",
          fontSize: 22,
          fontWeight: 800,
          color: p.ink,
          letterSpacing: "-0.02em",
        }}
      >
        {fmt.point(highest)}
        <span style={{ fontSize: 12, color: p.inkMuted, marginLeft: 3, fontWeight: 600 }}>P</span>
      </div>
      <div>
        {a.status === "OPEN" && a.highestBidder ? (
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <Avatar p={p} name={leaderName} size={26} />
            <div style={{ fontSize: 12, color: p.ink, fontWeight: 600 }}>{leaderName}</div>
          </div>
        ) : (
          <span style={{ color: p.inkMuted, fontSize: 12 }}>—</span>
        )}
      </div>
      <div style={{ fontSize: 13, color: p.inkSoft }}>
        <span className="mono" style={{ fontWeight: 700, color: p.ink }}>
          {a.bidCount}
        </span>
        회
      </div>
      <div
        style={{
          fontSize: 12,
          color: isHot ? p.danger : p.inkSoft,
          fontWeight: isHot ? 700 : 500,
        }}
      >
        {endLabel}
      </div>
      <div style={{ display: "flex", gap: 6, justifyContent: "flex-end" }}>
        <Btn p={p} variant={isHot ? "primary" : "soft"} size="sm">
          {a.status === "OPEN" ? "입찰" : "상세"}
        </Btn>
      </div>
    </div>
  );
}
