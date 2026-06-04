import { PALETTES, FONT, fmt } from "@/lib/tokens";
import type { Palette } from "@/lib/tokens";
import { Card, Donut, Pill, Spark, TopNav } from "@/components/atoms";
import { Icon } from "@/components/icons";
import { ScreenFrame } from "@/components/ScreenFrame";
import { useCurrentUser } from "@/lib/current-user";
import { useQuery } from "@/lib/use-query";
import { getMyDividend, type MyDividendResponse } from "@/lib/queries";

export default function DividendPage() {
  const p = PALETTES.cobalt;
  const { user } = useCurrentUser();
  const q = useQuery(() => getMyDividend(user.id), [user.id]);

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
        <TopNav p={p} active="dividend" />

        <div style={{ flex: 1, padding: "24px 40px", overflow: "auto" }}>
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "flex-end",
              marginBottom: 20,
            }}
          >
            <div>
              <div style={{ fontSize: 13, color: p.inkMuted, fontWeight: 500 }}>2026년 연말 배당</div>
              <div
                style={{
                  fontSize: 30,
                  fontWeight: 800,
                  color: p.ink,
                  letterSpacing: "-0.025em",
                  marginTop: 4,
                }}
              >
                내 지분과 배당 시뮬레이션
              </div>
            </div>
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

          {q.data && <Body p={p} data={q.data} />}
        </div>
      </div>
    </ScreenFrame>
  );
}

function Body({ p, data }: { p: Palette; data: MyDividendResponse }) {
  const escrow = Number(data.escrowBalance);
  const myDividend = Number(data.myDividend);
  const ratioPct = (data.stakeRatio * 100).toFixed(1);

  return (
    <>
      <div style={{ display: "grid", gridTemplateColumns: "1.2fr 1fr", gap: 16, marginBottom: 16 }}>
        <Card
          p={p}
          padding={0}
          style={{
            background: `linear-gradient(135deg, ${p.accent} 0%, ${p.accentDeep} 100%)`,
            color: "#fff",
            position: "relative",
            overflow: "hidden",
            minHeight: 360,
          }}
        >
          <div aria-hidden style={{ position: "absolute", inset: 0, opacity: 0.18 }}>
            <svg width="100%" height="100%" viewBox="0 0 600 400">
              {Array.from({ length: 50 }).map((_, i) => {
                const x = (i * 73) % 600;
                const y = (i * 41) % 400;
                return <circle key={i} cx={x} cy={y} r={2 + (i % 3)} fill="#fff" />;
              })}
            </svg>
          </div>
          <div style={{ position: "relative", zIndex: 1, padding: 36 }}>
            <Pill p={p} size="sm" style={{ background: "rgba(255,255,255,0.2)", color: "#fff" }}>
              <Icon.gift size={12} /> 실시간 산정 결과
            </Pill>
            <div
              style={{
                marginTop: 16,
                fontSize: 17,
                color: "rgba(255,255,255,0.85)",
                fontWeight: 500,
                lineHeight: 1.5,
              }}
            >
              <strong>{data.name}</strong>님, 올해 기여하신{" "}
              <strong>연차 {data.contributedDays}일</strong>의 결실입니다.
            </div>
            <div style={{ marginTop: 20 }}>
              <div
                style={{
                  fontSize: 12,
                  color: "rgba(255,255,255,0.6)",
                  fontWeight: 600,
                  letterSpacing: 0.5,
                }}
              >
                2026 예상 배당금
              </div>
              <div style={{ display: "flex", alignItems: "baseline", gap: 8, marginTop: 8 }}>
                <div
                  className="mono"
                  style={{ fontSize: 96, fontWeight: 800, letterSpacing: "-0.04em", lineHeight: 1 }}
                >
                  {fmt.point(myDividend)}
                </div>
                <div style={{ fontSize: 28, fontWeight: 700, color: "rgba(255,255,255,0.7)" }}>콘</div>
              </div>
              <div style={{ marginTop: 10, fontSize: 13, color: "rgba(255,255,255,0.75)" }}>
                현재 에스크로 잔액{" "}
                <span style={{ color: "#fff", fontWeight: 700 }}>{fmt.point(escrow)} 콘</span> × 지분{" "}
                <span style={{ color: "#fff", fontWeight: 700 }}>{ratioPct}%</span>
              </div>
            </div>

            <div style={{ display: "flex", gap: 8, marginTop: 28 }}>
              <div
                style={{
                  flex: 1,
                  background: "rgba(255,255,255,0.12)",
                  borderRadius: 14,
                  padding: 14,
                }}
              >
                <div style={{ fontSize: 11, color: "rgba(255,255,255,0.6)", fontWeight: 600 }}>
                  내 지분율
                </div>
                <div className="mono" style={{ fontSize: 26, fontWeight: 800, marginTop: 2 }}>
                  {ratioPct}%
                </div>
              </div>
              <div
                style={{
                  flex: 1,
                  background: "rgba(255,255,255,0.12)",
                  borderRadius: 14,
                  padding: 14,
                }}
              >
                <div style={{ fontSize: 11, color: "rgba(255,255,255,0.6)", fontWeight: 600 }}>
                  전체 순위
                </div>
                <div className="mono" style={{ fontSize: 26, fontWeight: 800, marginTop: 2 }}>
                  {data.rank ?? "—"}
                  <span style={{ fontSize: 14, fontWeight: 600, color: "rgba(255,255,255,0.6)" }}>
                    /{data.totalContributors}
                  </span>
                </div>
              </div>
              <div
                style={{
                  flex: 1,
                  background: "rgba(255,255,255,0.12)",
                  borderRadius: 14,
                  padding: 14,
                }}
              >
                <div style={{ fontSize: 11, color: "rgba(255,255,255,0.6)", fontWeight: 600 }}>
                  기여 일수
                </div>
                <div className="mono" style={{ fontSize: 26, fontWeight: 800, marginTop: 2 }}>
                  {data.contributedDays}
                  <span style={{ fontSize: 14, fontWeight: 600, color: "rgba(255,255,255,0.6)" }}>
                    일
                  </span>
                </div>
              </div>
            </div>
          </div>
        </Card>

        <Card p={p} padding={28}>
          <div style={{ fontSize: 13, color: p.inkMuted, fontWeight: 700 }}>전체 지분 분포</div>
          <div style={{ display: "flex", alignItems: "center", gap: 24, marginTop: 16 }}>
            <div style={{ position: "relative" }}>
              <Donut
                size={180}
                thickness={26}
                ringBg={p.bg}
                segments={data.topStakes.map((s, i) => ({
                  value: s.ratio,
                  color: s.isMe
                    ? p.accent
                    : ["#0E1240", "#3F4474", "#5e6385", "#8A8FB5", "#cfd2e6", "#dde0f3"][i % 6],
                }))}
              />
              <div
                style={{
                  position: "absolute",
                  inset: 0,
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <div style={{ fontSize: 11, color: p.inkMuted, fontWeight: 600 }}>내 지분</div>
                <div
                  className="mono"
                  style={{ fontSize: 28, fontWeight: 800, color: p.accent, letterSpacing: "-0.02em" }}
                >
                  {ratioPct}%
                </div>
              </div>
            </div>
            <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 6 }}>
              {data.topStakes.map((s, i) => (
                <div
                  key={s.userId + String(i)}
                  style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12 }}
                >
                  <span
                    style={{
                      width: 8,
                      height: 8,
                      borderRadius: 2,
                      background: s.isMe
                        ? p.accent
                        : ["#0E1240", "#3F4474", "#5e6385", "#8A8FB5", "#cfd2e6", "#dde0f3"][i % 6],
                    }}
                  />
                  <span
                    style={{
                      color: s.isMe ? p.accent : p.ink,
                      fontWeight: s.isMe ? 700 : 500,
                      flex: 1,
                    }}
                  >
                    {s.name}
                    {s.isMe && " (나)"}
                  </span>
                  <span className="mono" style={{ color: p.inkMuted, fontSize: 11 }}>
                    {s.days}일
                  </span>
                  <span
                    className="mono"
                    style={{
                      color: s.isMe ? p.accent : p.inkSoft,
                      fontWeight: 700,
                      width: 50,
                      textAlign: "right",
                    }}
                  >
                    {(s.ratio * 100).toFixed(1)}%
                  </span>
                </div>
              ))}
            </div>
          </div>
        </Card>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1.2fr 1fr 1fr", gap: 16 }}>
        <Card p={p} padding={20}>
          <div
            style={{
              fontSize: 13,
              color: p.inkMuted,
              fontWeight: 700,
              marginBottom: 12,
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
            }}
          >
            <span>에스크로 누적 추이</span>
            <Pill p={p} tone="neutral" size="sm">시계열 데모</Pill>
          </div>
          <div
            style={{
              display: "flex",
              alignItems: "flex-end",
              justifyContent: "space-between",
              marginBottom: 12,
            }}
          >
            <div>
              <div
                className="mono"
                style={{ fontSize: 32, fontWeight: 800, color: p.ink, letterSpacing: "-0.025em" }}
              >
                {fmt.point(escrow)}
                <span style={{ fontSize: 14, color: p.inkMuted, marginLeft: 4 }}>콘</span>
              </div>
              <div style={{ fontSize: 12, color: p.inkMuted }}>현재 잔액 (실시간)</div>
            </div>
            <Pill p={p} tone="success" size="sm">
              12/31 배당 재원
            </Pill>
          </div>
          <Spark
            data={[12, 18, 22, 38, 55, 72, 94, 118, 142, 165, 178, 187]}
            w={420}
            h={80}
            color={p.accent}
            fill={p.accentSoft}
          />
        </Card>

        <Card p={p} padding={20}>
          <div style={{ fontSize: 13, color: p.inkMuted, fontWeight: 700, marginBottom: 14 }}>
            내 배당 계산식
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            <FormulaRow p={p} k="에스크로 잔액" v={`${fmt.point(escrow)} 콘`} />
            <FormulaRow p={p} k="× 내 지분율" v={`× ${data.stakeRatio.toFixed(4)}`} />
            <div style={{ height: 1, background: p.line, margin: "4px 0" }} />
            <FormulaRow p={p} k="raw" v={`${(escrow * data.stakeRatio).toFixed(1)} 콘`} muted />
            <FormulaRow p={p} k="floor()" v={`${fmt.point(myDividend)} 콘`} muted />
            <div style={{ padding: 12, background: p.accentSoft, borderRadius: 10, marginTop: 4 }}>
              <div style={{ fontSize: 11, color: p.accent, fontWeight: 700, marginBottom: 4 }}>
                최종 배당금
              </div>
              <div
                className="mono"
                style={{ fontSize: 22, fontWeight: 800, color: p.accent, letterSpacing: "-0.02em" }}
              >
                {fmt.point(myDividend)} 콘
              </div>
            </div>
          </div>
        </Card>

        <Card p={p} padding={20}>
          <div style={{ fontSize: 13, color: p.inkMuted, fontWeight: 700, marginBottom: 12 }}>
            3-Way Win
          </div>
          {[
            { who: "회사", color: p.ink, bg: p.bg, value: "예산 0원 선투입", desc: "재무 리스크 0%" },
            {
              who: `판매자 (${data.name})`,
              color: p.accent,
              bg: p.accentSoft,
              value: `+${fmt.point(myDividend)}콘`,
              desc: "소멸 예정이던 연차 → 배당",
            },
            {
              who: "구매자",
              color: p.success,
              bg: "#E6F6F0",
              value: "연차 +1일",
              desc: "원할 때 사용",
            },
          ].map((w, i) => (
            <div
              key={i}
              style={{
                padding: 12,
                marginBottom: 8,
                borderRadius: 10,
                background: w.bg,
                display: "flex",
                alignItems: "center",
                gap: 12,
              }}
            >
              <div
                style={{
                  width: 32,
                  height: 32,
                  borderRadius: "50%",
                  background: w.color,
                  color: "#fff",
                  fontSize: 14,
                  fontWeight: 800,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                {i + 1}
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 11, color: w.color, fontWeight: 700 }}>{w.who}</div>
                <div style={{ fontSize: 13, color: p.ink, fontWeight: 700, marginTop: 1 }}>
                  {w.value}
                </div>
              </div>
              <div style={{ fontSize: 10, color: p.inkMuted, textAlign: "right", maxWidth: 90 }}>
                {w.desc}
              </div>
            </div>
          ))}
        </Card>
      </div>
    </>
  );
}

function FormulaRow({
  p,
  k,
  v,
  muted,
}: {
  p: Palette;
  k: string;
  v: string;
  muted?: boolean;
}) {
  return (
    <div
      style={{
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
        fontSize: 13,
      }}
    >
      <span style={{ color: muted ? p.inkMuted : p.inkSoft, fontWeight: muted ? 500 : 600 }}>
        {k}
      </span>
      <span className="mono" style={{ color: muted ? p.inkMuted : p.ink, fontWeight: 700 }}>
        {v}
      </span>
    </div>
  );
}
