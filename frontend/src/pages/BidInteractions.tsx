import { PALETTES, FONT } from "@/lib/tokens";
import type { Palette } from "@/lib/tokens";
import { Btn, Card, Pill, TopNav } from "@/components/atoms";
import { Icon } from "@/components/icons";
import { ScreenFrame } from "@/components/ScreenFrame";
import type { CSSProperties } from "react";

const cardShell: CSSProperties = {
  minHeight: 480,
  display: "flex",
  flexDirection: "column",
};

export default function BidInteractionsPage() {
  const p = PALETTES.cobalt;
  return (
    <ScreenFrame>
      <div
        style={{
          width: "100%",
          background: p.bg,
          fontFamily: FONT.sans,
          display: "flex",
          flexDirection: "column",
        }}
      >
        <TopNav p={p} active="auction" />
        <div style={{ padding: 40, display: "flex", flexDirection: "column", gap: 24 }}>
          <div>
            <div style={{ fontSize: 13, color: p.inkMuted, fontWeight: 500 }}>
              입찰 인터랙션 — 변주 3종{" "}
              <span style={{ marginLeft: 6, color: p.inkMuted }}>
                (정적 비교 — 백엔드 호출 없음)
              </span>
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
              어떻게 입찰하실까요?
            </div>
            <div style={{ fontSize: 14, color: p.inkSoft, marginTop: 6 }}>
              한 번의 탭부터 신중한 슬라이더까지. 마감 직전 트래픽이 몰리는 상황에서 사용자의 후회를 최소화하는 방식을 비교합니다.
            </div>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 16 }}>
            <BidVarA p={p} />
            <BidVarB p={p} />
            <BidVarC p={p} />
          </div>

          <Card p={p} padding={0}>
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "180px repeat(3, 1fr)",
                borderBottom: `1px solid ${p.line}`,
              }}
            >
              <div style={{ padding: "14px 20px", fontSize: 12, color: p.inkMuted, fontWeight: 700 }}>
                비교
              </div>
              {["A · 즉시 입찰", "B · 확인 모달", "C · 슬라이더"].map((h, i) => (
                <div
                  key={i}
                  style={{
                    padding: "14px 20px",
                    fontSize: 13,
                    color: p.ink,
                    fontWeight: 700,
                    borderLeft: `1px solid ${p.line}`,
                  }}
                >
                  {h}
                </div>
              ))}
            </div>
            {[
              ["속도", "⚡⚡⚡ 0.2초", "⚡ 1.5초", "⚡⚡ 0.8초"],
              ["오입찰 위험", "⚠️ 높음", "✅ 낮음", "✅ 낮음"],
              ["마감 직전 적합", "✅ 가장 적합", "❌ 늦을 수 있음", "○ 보통"],
              ["숙련자", "✅", "○", "○"],
              ["추천 사용처", "경험 많은 직원", "첫 입찰자 / 큰 금액", "심사숙고형"],
            ].map((row, i) => (
              <div
                key={i}
                style={{
                  display: "grid",
                  gridTemplateColumns: "180px repeat(3, 1fr)",
                  borderTop: i === 0 ? "none" : `1px solid ${p.line}`,
                }}
              >
                <div
                  style={{
                    padding: "12px 20px",
                    fontSize: 12,
                    color: p.inkMuted,
                    fontWeight: 600,
                  }}
                >
                  {row[0]}
                </div>
                {row.slice(1).map((c, j) => (
                  <div
                    key={j}
                    style={{
                      padding: "12px 20px",
                      fontSize: 13,
                      color: p.ink,
                      borderLeft: `1px solid ${p.line}`,
                    }}
                  >
                    {c}
                  </div>
                ))}
              </div>
            ))}
          </Card>
        </div>
      </div>
    </ScreenFrame>
  );
}

function BidVarA({ p }: { p: Palette }) {
  return (
    <Card p={p} padding={24} style={cardShell}>
      <Pill p={p} tone="dark" size="sm" style={{ alignSelf: "flex-start" }}>
        VARIANT A
      </Pill>
      <div
        style={{
          fontSize: 22,
          fontWeight: 800,
          color: p.ink,
          marginTop: 12,
          letterSpacing: "-0.02em",
        }}
      >
        즉시 입찰
      </div>
      <div style={{ fontSize: 13, color: p.inkMuted, marginTop: 4, lineHeight: 1.5 }}>
        탭 한 번으로 +최소증분 자동 입찰. 마감 직전 트래픽에 최적.
      </div>

      <div style={{ flex: 1 }} />

      <div style={{ marginTop: 24, padding: 20, background: p.bg, borderRadius: 16 }}>
        <div style={{ fontSize: 12, color: p.inkMuted, fontWeight: 600 }}>현재 최고가</div>
        <div
          className="mono"
          style={{
            fontSize: 36,
            fontWeight: 800,
            color: p.ink,
            marginTop: 4,
            letterSpacing: "-0.025em",
            lineHeight: 1,
          }}
        >
          9,100<span style={{ fontSize: 14, color: p.inkMuted, marginLeft: 4 }}>P</span>
        </div>
        <Btn
          p={p}
          variant="primary"
          size="xl"
          full
          style={{ marginTop: 18, height: 72, fontSize: 20 }}
        >
          <span style={{ display: "inline-flex", alignItems: "center", gap: 10 }}>
            <Icon.bolt size={20} /> 9,200P 즉시 입찰
          </span>
        </Btn>
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            marginTop: 10,
            fontSize: 11,
            color: p.inkMuted,
          }}
        >
          <span>+100P 증분</span>
          <span>확인 없이 바로 차감됩니다</span>
        </div>
      </div>
    </Card>
  );
}

function BidVarB({ p }: { p: Palette }) {
  return (
    <Card p={p} padding={24} style={{ ...cardShell, position: "relative" }}>
      <Pill p={p} tone="dark" size="sm" style={{ alignSelf: "flex-start" }}>
        VARIANT B
      </Pill>
      <div
        style={{
          fontSize: 22,
          fontWeight: 800,
          color: p.ink,
          marginTop: 12,
          letterSpacing: "-0.02em",
        }}
      >
        확인 모달
      </div>
      <div style={{ fontSize: 13, color: p.inkMuted, marginTop: 4, lineHeight: 1.5 }}>
        금액 확인 후 한 번 더 컨펌. 큰 금액일수록 안심.
      </div>

      <div style={{ flex: 1 }} />

      <div style={{ marginTop: 24, position: "relative" }}>
        <div style={{ padding: 16, background: p.bg, borderRadius: 12, opacity: 0.4 }}>
          <div className="mono" style={{ fontSize: 22, fontWeight: 700, color: p.inkMuted }}>
            9,100 P
          </div>
        </div>
        <div
          style={{
            marginTop: 12,
            padding: 24,
            background: p.surface,
            borderRadius: 20,
            boxShadow: "0 20px 50px rgba(11,25,41,0.18), 0 0 0 1px rgba(11,25,41,0.04)",
          }}
        >
          <div style={{ fontSize: 13, color: p.inkMuted, fontWeight: 600 }}>아래 금액으로 입찰합니다</div>
          <div
            className="mono"
            style={{
              fontSize: 38,
              fontWeight: 800,
              color: p.ink,
              marginTop: 6,
              letterSpacing: "-0.03em",
              lineHeight: 1,
            }}
          >
            9,200 <span style={{ fontSize: 16, color: p.inkMuted }}>P</span>
          </div>
          <div
            style={{
              marginTop: 14,
              padding: 12,
              background: p.bg,
              borderRadius: 10,
              display: "flex",
              flexDirection: "column",
              gap: 8,
            }}
          >
            <Row p={p} k="잔액에서 차감" v="-9,200 P" />
            <Row p={p} k="입찰 후 잔액" v="3,250 P" />
          </div>
          <div
            style={{
              fontSize: 11,
              color: p.warn,
              marginTop: 10,
              lineHeight: 1.5,
              display: "flex",
              gap: 6,
            }}
          >
            <span>⚠</span>
            <span>입찰 후 취소할 수 없어요. 상위 입찰이 들어오면 자동 환불됩니다.</span>
          </div>
          <div style={{ display: "flex", gap: 8, marginTop: 14 }}>
            <Btn p={p} variant="ghost" size="md" full>
              취소
            </Btn>
            <Btn p={p} variant="primary" size="md" full>
              입찰 확정
            </Btn>
          </div>
        </div>
      </div>
    </Card>
  );
}

function BidVarC({ p }: { p: Palette }) {
  return (
    <Card p={p} padding={24} style={cardShell}>
      <Pill p={p} tone="dark" size="sm" style={{ alignSelf: "flex-start" }}>
        VARIANT C
      </Pill>
      <div
        style={{
          fontSize: 22,
          fontWeight: 800,
          color: p.ink,
          marginTop: 12,
          letterSpacing: "-0.02em",
        }}
      >
        슬라이더로 결정
      </div>
      <div style={{ fontSize: 13, color: p.inkMuted, marginTop: 4, lineHeight: 1.5 }}>
        잔액 한계를 시각화. 최고가부터 최대치까지 한눈에.
      </div>

      <div style={{ flex: 1 }} />

      <div style={{ marginTop: 24, padding: 20, background: p.bg, borderRadius: 16 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end" }}>
          <div>
            <div style={{ fontSize: 12, color: p.inkMuted, fontWeight: 600 }}>내 입찰가</div>
            <div
              className="mono"
              style={{
                fontSize: 36,
                fontWeight: 800,
                color: p.accent,
                marginTop: 4,
                letterSpacing: "-0.025em",
                lineHeight: 1,
              }}
            >
              10,200<span style={{ fontSize: 14, color: p.inkMuted, marginLeft: 4 }}>P</span>
            </div>
          </div>
          <Pill p={p} tone="success" size="sm">
            +1,100P
          </Pill>
        </div>

        <div
          style={{
            marginTop: 24,
            position: "relative",
            height: 32,
            display: "flex",
            alignItems: "center",
          }}
        >
          <div
            style={{
              width: "100%",
              height: 6,
              borderRadius: 999,
              background: p.line,
              position: "relative",
            }}
          >
            <div
              style={{
                position: "absolute",
                left: 0,
                height: "100%",
                width: "42%",
                background: p.accent,
                borderRadius: 999,
              }}
            />
            <div
              style={{
                position: "absolute",
                left: "0%",
                top: -3,
                width: 3,
                height: 12,
                background: p.inkMuted,
                borderRadius: 2,
              }}
            />
            <div
              style={{
                position: "absolute",
                left: "36%",
                top: -8,
                width: 2,
                height: 22,
                background: p.ink,
              }}
            >
              <div
                style={{
                  position: "absolute",
                  top: -18,
                  left: -22,
                  fontSize: 9,
                  color: p.ink,
                  fontWeight: 700,
                  whiteSpace: "nowrap",
                }}
              >
                최고가
              </div>
            </div>
            <div
              style={{
                position: "absolute",
                left: "42%",
                top: -10,
                width: 26,
                height: 26,
                background: p.surface,
                border: `4px solid ${p.accent}`,
                borderRadius: "50%",
                transform: "translateX(-50%)",
                boxShadow: "0 4px 10px rgba(0,0,0,0.12)",
              }}
            />
            <div
              style={{
                position: "absolute",
                left: "99%",
                top: -3,
                width: 3,
                height: 12,
                background: p.danger,
                borderRadius: 2,
              }}
            />
          </div>
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
          <span className="mono">9,200 (최소)</span>
          <span className="mono" style={{ color: p.danger, fontWeight: 700 }}>
            12,450 (잔액)
          </span>
        </div>

        <div style={{ display: "flex", gap: 8, marginTop: 18 }}>
          <Btn p={p} variant="ghost" size="md" full>
            취소
          </Btn>
          <Btn p={p} variant="primary" size="md" full>
            <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
              <Icon.hammer size={14} /> 10,200P 입찰
            </span>
          </Btn>
        </div>
      </div>
    </Card>
  );
}

function Row({ p, k, v }: { p: Palette; k: string; v: string }) {
  return (
    <div
      style={{ display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: 13 }}
    >
      <span style={{ color: p.inkMuted }}>{k}</span>
      <span className="mono" style={{ color: p.ink, fontWeight: 700 }}>
        {v}
      </span>
    </div>
  );
}
