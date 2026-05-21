import { Link } from "react-router-dom";
import { PALETTES, FONT } from "@/lib/tokens";
import { Brand } from "@/components/atoms";

type Entry = {
  path: string;
  title: string;
  subtitle: string;
  star?: boolean;
};

const SECTIONS: { id: string; title: string; subtitle: string; entries: Entry[] }[] = [
  {
    id: "entry",
    title: "01 · 진입",
    subtitle: "브랜드를 처음 마주하는 화면",
    entries: [
      { path: "/login", title: "A · 로그인 (브랜드 임팩트 + 표준 통합)", subtitle: "1440 × 900" },
      { path: "/dashboard", title: "대시보드 · 토스 스타일 임팩트", subtitle: "1440 × 900" },
    ],
  },
  {
    id: "auction-list",
    title: "02 · 경매장 리스트 — 변주 3종",
    subtitle: "레이아웃별로 동일 데이터를 다르게 다룹니다",
    entries: [
      { path: "/auction", title: "A · 그리드 (토스풍 카드)", subtitle: "1440 × 900" },
      { path: "/auction/row", title: "B · 리스트 (데이터 밀도 ↑)", subtitle: "1440 × 900" },
      { path: "/auction/timeline", title: "C · 타임라인 (주간 스케줄)", subtitle: "1440 × 900" },
    ],
  },
  {
    id: "bidding",
    title: "03 · 실시간 입찰 ★",
    subtitle: "이 시스템의 가장 긴장감 있는 순간",
    entries: [
      {
        path: "/auction/detail",
        title: "입찰 상세 · 게임 아이템 상점 스타일",
        subtitle: "1440 × 900",
        star: true,
      },
      {
        path: "/auction/bid-variants",
        title: "입찰 인터랙션 — 변주 3종",
        subtitle: "1440 × 1180",
      },
    ],
  },
  {
    id: "me",
    title: "04 · 내 활동 + 연말 배당",
    subtitle: "개인 가치 회수의 마지막 화면",
    entries: [
      { path: "/activity", title: "내 활동 · 거래 내역 + 연차 포트폴리오", subtitle: "1440 × 900" },
      { path: "/dividend", title: "연말 배당 ★ · 지분과 배당금", subtitle: "1440 × 900", star: true },
    ],
  },
  {
    id: "admin",
    title: "05 · 관리자",
    subtitle: "운영자가 보는 화면",
    entries: [
      { path: "/admin/ops", title: "관리자 · 운영 대시보드", subtitle: "1440 × 900" },
      { path: "/admin/ledger", title: "관리자 · 원장 (감사 추적)", subtitle: "1440 × 900" },
    ],
  },
];

export default function IndexPage() {
  const p = PALETTES.cobalt;
  return (
    <div
      style={{
        minHeight: "100vh",
        width: "100%",
        fontFamily: FONT.sans,
        padding: "48px 32px",
      }}
    >
      <div style={{ maxWidth: 960, margin: "0 auto" }}>
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            marginBottom: 40,
          }}
        >
          <Brand p={p} />
          <Link
            to="/login"
            style={{
              fontSize: 13,
              color: p.accent,
              fontWeight: 600,
              textDecoration: "none",
              padding: "8px 14px",
              borderRadius: 10,
              background: p.surface,
              border: `1px solid ${p.line}`,
            }}
          >
            ← 실제 앱 흐름으로 (로그인)
          </Link>
        </div>
        <div style={{ marginBottom: 28 }}>
          <div style={{ fontSize: 13, color: p.inkMuted, fontWeight: 500 }}>
            🔧 개발자 화면 카탈로그 (정상 사용자 경로 아님)
          </div>
          <div
            style={{
              fontSize: 36,
              fontWeight: 800,
              color: p.ink,
              letterSpacing: "-0.025em",
              marginTop: 4,
            }}
          >
            연차 경매 시스템 · UI 프로토타입
          </div>
          <div style={{ fontSize: 15, color: p.inkSoft, marginTop: 8, lineHeight: 1.5 }}>
            모든 화면에 직접 접근하기 위한 개발자 도구입니다. 실제 사용자는 로그인 → 대시보드 →
            TopNav 메뉴 순으로 이동합니다.
          </div>
        </div>

        {SECTIONS.map((s) => (
          <div key={s.id} style={{ marginBottom: 32 }}>
            <div style={{ marginBottom: 14 }}>
              <div
                style={{
                  fontSize: 18,
                  fontWeight: 800,
                  color: p.ink,
                  letterSpacing: "-0.015em",
                }}
              >
                {s.title}
              </div>
              <div style={{ fontSize: 13, color: p.inkMuted, marginTop: 2 }}>{s.subtitle}</div>
            </div>
            <div style={{ display: "grid", gap: 10 }}>
              {s.entries.map((e) => (
                <Link
                  key={e.path}
                  to={e.path}
                  style={{
                    background: p.surface,
                    borderRadius: 14,
                    padding: "16px 20px",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    textDecoration: "none",
                    color: "inherit",
                    boxShadow: "0 1px 0 rgba(11,25,41,0.04), 0 4px 14px rgba(11,25,41,0.04)",
                  }}
                >
                  <div>
                    <div
                      style={{
                        fontSize: 15,
                        fontWeight: 700,
                        color: p.ink,
                        letterSpacing: "-0.01em",
                      }}
                    >
                      {e.star && <span style={{ color: p.accent, marginRight: 6 }}>★</span>}
                      {e.title}
                    </div>
                    <div className="mono" style={{ fontSize: 11, color: p.inkMuted, marginTop: 2 }}>
                      {e.path} · {e.subtitle}
                    </div>
                  </div>
                  <div style={{ color: p.accent, fontSize: 14, fontWeight: 700 }}>열기 →</div>
                </Link>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
