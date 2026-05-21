import { useState } from "react";
import { PALETTES, FONT, fmt } from "@/lib/tokens";
import { Btn, Card, Pill, TopNav } from "@/components/atoms";
import { Icon } from "@/components/icons";
import { ScreenFrame } from "@/components/ScreenFrame";
import { useQuery } from "@/lib/use-query";
import { apiPost } from "@/lib/api";
import { getAdminStats, listAuctions, type AuctionListItem } from "@/lib/queries";
import { useToast } from "@/lib/toast";

type SettleDueResponse = {
  attempted: number;
  settled: number;
  failed: number;
};

export default function AdminOpsPage() {
  const p = PALETTES.cobalt;
  const toast = useToast();
  const statsQ = useQuery(() => getAdminStats(), []);
  const upcomingQ = useQuery(() => listAuctions(["CREATED"]), []);
  const unsoldQ = useQuery(() => listAuctions(["UNSOLD"]), []);
  const [running, setRunning] = useState(false);

  const triggerSettle = async () => {
    setRunning(true);
    try {
      const r = await apiPost<SettleDueResponse>("/admin/auctions/settle-due", {});
      toast.push(
        "success",
        `정산 트리거 — 시도 ${r.attempted}건 / 성공 ${r.settled} / 실패 ${r.failed}`,
      );
      await Promise.all([statsQ.refetch(), upcomingQ.refetch(), unsoldQ.refetch()]);
    } catch (e) {
      toast.push("error", (e as Error).message);
    } finally {
      setRunning(false);
    }
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
              justifyContent: "space-between",
              alignItems: "flex-end",
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
                <Icon.shield size={14} /> 관리자 콘솔
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
                운영 대시보드
              </div>
            </div>
            <div style={{ display: "flex", gap: 8 }}>
              <Btn p={p} variant="ghost" size="md" onClick={() => statsQ.refetch()}>
                새로고침
              </Btn>
              <Btn p={p} variant="dark" size="md" disabled={running} onClick={triggerSettle}>
                <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
                  <Icon.bolt size={14} />
                  {running ? "처리 중…" : "마감된 경매 즉시 정산"}
                </span>
              </Btn>
            </div>
          </div>

          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(5, 1fr)",
              gap: 12,
              marginBottom: 16,
            }}
          >
            <KpiCard
              k="에스크로 잔액"
              v={
                statsQ.data
                  ? fmt.point(Number(statsQ.data.escrowBalance))
                  : statsQ.loading
                    ? "—"
                    : "오류"
              }
              sub="P · NFR-2 등식"
              mono
            />
            <KpiCard
              k="진행 중 경매"
              v={statsQ.data?.openAuctions ?? "—"}
              sub="OPEN 상태"
            />
            <KpiCard
              k="오픈 예정"
              v={statsQ.data?.upcomingAuctions ?? "—"}
              sub="CREATED 상태"
            />
            <KpiCard
              k="유찰 재고"
              v={statsQ.data?.unsoldAuctions ?? "—"}
              sub="UNSOLD"
            />
            <KpiCard
              k="오늘 낙찰"
              v={statsQ.data?.awardedToday ?? "—"}
              sub="AWARDED today"
              good
            />
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1.4fr 1fr", gap: 16 }}>
            <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
              <Card p={p} padding={0}>
                <div
                  style={{
                    padding: "18px 24px",
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    borderBottom: `1px solid ${p.line}`,
                  }}
                >
                  <div>
                    <div
                      style={{
                        fontSize: 16,
                        fontWeight: 800,
                        color: p.ink,
                        letterSpacing: "-0.01em",
                      }}
                    >
                      오픈 예정 경매
                    </div>
                    <div style={{ fontSize: 12, color: p.inkMuted, marginTop: 2 }}>
                      {upcomingQ.data?.length ?? "—"}건 대기
                    </div>
                  </div>
                </div>
                <div style={{ padding: 16 }}>
                  {upcomingQ.data?.length === 0 && (
                    <div
                      style={{
                        padding: 24,
                        textAlign: "center",
                        color: p.inkMuted,
                        fontSize: 13,
                      }}
                    >
                      예정된 경매가 없습니다.
                    </div>
                  )}
                  {upcomingQ.data?.map((a) => (
                    <UpcomingRow key={a.id} a={a} />
                  ))}
                </div>
              </Card>

              <Card p={p} padding={20}>
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    marginBottom: 14,
                  }}
                >
                  <div>
                    <div
                      style={{
                        fontSize: 16,
                        fontWeight: 800,
                        color: p.ink,
                        letterSpacing: "-0.01em",
                      }}
                    >
                      유찰 재고 (수동 처리 대기)
                    </div>
                    <div style={{ fontSize: 12, color: p.inkMuted, marginTop: 2 }}>
                      EVENT 속성으로 지급하거나 다시 경매에 등록 가능
                    </div>
                  </div>
                  <Pill p={p} tone="warn" size="sm">
                    {unsoldQ.data?.length ?? "—"}건
                  </Pill>
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 8 }}>
                  {unsoldQ.data?.length === 0 && (
                    <div
                      style={{
                        gridColumn: "1 / -1",
                        padding: 12,
                        color: p.inkMuted,
                        fontSize: 13,
                      }}
                    >
                      유찰 재고가 없습니다.
                    </div>
                  )}
                  {unsoldQ.data?.slice(0, 6).map((a) => (
                    <div
                      key={a.id}
                      style={{
                        padding: 12,
                        background: p.bg,
                        borderRadius: 10,
                        display: "flex",
                        flexDirection: "column",
                        gap: 6,
                      }}
                    >
                      <div className="mono" style={{ fontSize: 11, color: p.inkMuted, fontWeight: 600 }}>
                        {a.id}
                      </div>
                      <div style={{ fontSize: 12, color: p.ink, fontWeight: 600 }}>연차 1일권</div>
                      <div style={{ fontSize: 10, color: p.inkMuted }}>
                        마감 {formatTime(new Date(a.endsAt))}
                      </div>
                    </div>
                  ))}
                </div>
              </Card>
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
              <Card p={p} padding={20}>
                <div
                  style={{
                    fontSize: 14,
                    fontWeight: 800,
                    color: p.ink,
                    letterSpacing: "-0.01em",
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                  }}
                >
                  <span>시스템 상태</span>
                  <Pill p={p} tone="neutral" size="sm">probe 미구현</Pill>
                </div>
                <div style={{ fontSize: 11, color: p.inkMuted, marginTop: 4, marginBottom: 14 }}>
                  API/DB는 실시간 호출로 판단 · 나머지는 정적
                </div>
                {[
                  { k: "API 서버", v: statsQ.error ? "오류" : "정상", ok: !statsQ.error },
                  { k: "PostgreSQL", v: statsQ.error ? "확인 필요" : "정상", ok: !statsQ.error },
                  { k: "Advisory Lock", v: "활성", ok: true },
                  { k: "에스크로 정합성", v: "✓", ok: true },
                  {
                    k: "DLQ (Outbox)",
                    v: statsQ.data ? String(statsQ.data.dlqDepth) : "—",
                    ok: (statsQ.data?.dlqDepth ?? 0) === 0,
                  },
                ].map((h, i, arr) => (
                  <div
                    key={i}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 12,
                      padding: "10px 0",
                      borderBottom: i === arr.length - 1 ? "none" : `1px solid ${p.line}`,
                    }}
                  >
                    <div
                      style={{
                        width: 8,
                        height: 8,
                        borderRadius: "50%",
                        background: h.ok ? p.success : p.danger,
                        boxShadow: `0 0 0 3px ${h.ok ? p.success : p.danger}33`,
                      }}
                    />
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 13, color: p.ink, fontWeight: 600 }}>{h.k}</div>
                    </div>
                    <div
                      className="mono"
                      style={{
                        fontSize: 13,
                        color: h.ok ? p.success : p.danger,
                        fontWeight: 700,
                      }}
                    >
                      {h.v}
                    </div>
                  </div>
                ))}
              </Card>

              <Card p={p} padding={20}>
                <div
                  style={{
                    fontSize: 14,
                    fontWeight: 800,
                    color: p.ink,
                    marginBottom: 4,
                    letterSpacing: "-0.01em",
                  }}
                >
                  연말 배당 D-day
                </div>
                <div style={{ fontSize: 12, color: p.inkMuted }}>2026-12-31 23:59</div>
                <div
                  style={{
                    marginTop: 16,
                    padding: 16,
                    background: p.ink,
                    borderRadius: 14,
                    color: "#fff",
                  }}
                >
                  <div
                    className="mono"
                    style={{
                      fontSize: 32,
                      fontWeight: 800,
                      letterSpacing: "-0.02em",
                      textAlign: "center",
                    }}
                  >
                    {daysUntilYearEnd()}
                    <span style={{ fontSize: 14, color: "rgba(255,255,255,0.6)", marginLeft: 4 }}>
                      일
                    </span>
                  </div>
                </div>
              </Card>
            </div>
          </div>
        </div>
      </div>
    </ScreenFrame>
  );
}

function KpiCard({
  k,
  v,
  sub,
  mono,
  good,
}: {
  k: string;
  v: string | number;
  sub: string;
  mono?: boolean;
  good?: boolean;
}) {
  const p = PALETTES.cobalt;
  return (
    <Card p={p} padding={16}>
      <div style={{ fontSize: 11, color: p.inkMuted, fontWeight: 600 }}>{k}</div>
      <div
        className={mono ? "mono" : ""}
        style={{
          fontSize: 26,
          fontWeight: 800,
          color: good ? p.success : p.ink,
          marginTop: 4,
          letterSpacing: "-0.02em",
        }}
      >
        {v}
      </div>
      <div style={{ fontSize: 11, color: p.inkMuted, marginTop: 2 }}>{sub}</div>
    </Card>
  );
}

function UpcomingRow({ a }: { a: AuctionListItem }) {
  const p = PALETTES.cobalt;
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 16,
        padding: "12px 0",
        borderBottom: `1px solid ${p.line}`,
      }}
    >
      <div className="mono" style={{ width: 110, fontSize: 12, color: p.inkSoft, fontWeight: 600 }}>
        {a.id}
      </div>
      <div style={{ flex: 1, fontSize: 13, color: p.ink, fontWeight: 600 }}>연차 1일권</div>
      <div style={{ fontSize: 12, color: p.inkMuted }}>
        오픈 {formatTime(new Date(a.startedAt))}
      </div>
      <div style={{ fontSize: 12, color: p.inkSoft }}>
        마감 {formatTime(new Date(a.endsAt))}
      </div>
      <Pill p={p} tone="neutral" size="sm">예정</Pill>
    </div>
  );
}

function formatTime(d: Date): string {
  return d.toLocaleString("ko-KR", {
    month: "numeric",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function daysUntilYearEnd(): number {
  const now = new Date();
  const eoy = new Date(now.getFullYear(), 11, 31, 23, 59, 59);
  return Math.max(0, Math.ceil((eoy.getTime() - now.getTime()) / (24 * 60 * 60 * 1000)));
}
