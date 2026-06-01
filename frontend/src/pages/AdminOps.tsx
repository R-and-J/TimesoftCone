import { useState } from "react";
import { PALETTES, FONT, fmt } from "@/lib/tokens";
import { Btn, Card, Pill, TopNav } from "@/components/atoms";
import { Icon } from "@/components/icons";
import { ScreenFrame } from "@/components/ScreenFrame";
import { AdminTabs } from "@/components/AdminTabs";
import { YearSelect } from "@/components/YearSelect";
import { useQuery } from "@/lib/use-query";
import { apiPost } from "@/lib/api";
import {
  collectLeavePool,
  getAdminStats,
  listAuctions,
  settleDividend,
  type CollectLeavePoolResponse,
  type SettleDividendResponse,
} from "@/lib/queries";
import { useToast } from "@/lib/toast";

// 정산 데이터 export 다운로드 링크 베이스 (ADR-021). VITE_API_BASE 없으면 vite 프록시(/api).
const API_BASE = import.meta.env.VITE_API_BASE ?? "/api";

// 내보내기 모달에서 고르는 항목/형식.
const EXPORT_SETS = [
  { key: "leave-grants", label: "낙찰 연차 부여 내역", desc: "누가 어떤 경매로 며칠" },
  { key: "dividends", label: "연말 배당 내역", desc: "기여 지분별 복지카드 배당" },
  { key: "spending", label: "지출 내역", desc: "누가 얼마나 썼나" },
] as const;
const EXPORT_FORMATS = [
  { key: "xlsx", label: "Excel (.xlsx · 항목별 시트)" },
  { key: "md", label: "Markdown (.md · 노션/문서)" },
  { key: "json", label: "JSON" },
] as const;

/** 첨부(Content-Disposition) 응답을 페이지 이동 없이 다운로드 트리거. */
function triggerDownload(url: string) {
  const a = document.createElement("a");
  a.href = url;
  document.body.appendChild(a);
  a.click();
  a.remove();
}

type SettleDueResponse = {
  attempted: number;
  settled: number;
  failed: number;
};

export default function AdminOpsPage() {
  const p = PALETTES.cobalt;
  const toast = useToast();
  const statsQ = useQuery(() => getAdminStats(), []);
  // 유찰 재고는 운영자가 보는 본 연도가 기본. (오픈 예정 목록은 "경매관리" 탭으로 분리.)
  const [year, setYear] = useState<number | undefined>(new Date().getFullYear());
  const unsoldQ = useQuery(() => listAuctions(["UNSOLD"], year), [year]);
  const [running, setRunning] = useState(false);
  const [exportOpen, setExportOpen] = useState(false);
  const [exportSets, setExportSets] = useState<Record<string, boolean>>({
    "leave-grants": true,
    dividends: true,
    spending: true,
  });
  const [exportFmt, setExportFmt] = useState<string>("xlsx");
  // 배당 정산 모달: 먼저 미리보기(dryRun) → 확인 후 실지급.
  const [divOpen, setDivOpen] = useState(false);
  const [divLoading, setDivLoading] = useState(false);
  const [divPreview, setDivPreview] = useState<SettleDividendResponse | null>(null);

  // 모달을 열면서 동시에 미리보기를 불러온다(지급은 안 함).
  const openDividend = async () => {
    setDivOpen(true);
    setDivPreview(null);
    setDivLoading(true);
    try {
      setDivPreview(await settleDividend({ dryRun: true }));
    } catch (e) {
      toast.push("error", (e as Error).message);
      setDivOpen(false);
    } finally {
      setDivLoading(false);
    }
  };

  // 연말 풀 수집 모달: 미리보기(dryRun) → 확인 후 실제 수집.
  const [poolOpen, setPoolOpen] = useState(false);
  const [poolLoading, setPoolLoading] = useState(false);
  const [poolPreview, setPoolPreview] = useState<CollectLeavePoolResponse | null>(null);

  const openPool = async () => {
    setPoolOpen(true);
    setPoolPreview(null);
    setPoolLoading(true);
    try {
      setPoolPreview(await collectLeavePool({ dryRun: true }));
    } catch (e) {
      toast.push("error", (e as Error).message);
      setPoolOpen(false);
    } finally {
      setPoolLoading(false);
    }
  };

  const runPool = async () => {
    setPoolLoading(true);
    try {
      const r = await collectLeavePool({ dryRun: false });
      toast.push(
        "success",
        `풀 수집 완료 — ${r.targetYear}년 1일권 ${r.auctionsCreated}개 생성 (기여자 ${r.contributorCount}명)`,
      );
      setPoolOpen(false);
      await statsQ.refetch();
    } catch (e) {
      toast.push("error", (e as Error).message);
    } finally {
      setPoolLoading(false);
    }
  };

  // 실지급 — 멱등이라 이미 정산됐으면 백엔드가 409로 막는다.
  const runDividend = async () => {
    setDivLoading(true);
    try {
      const r = await settleDividend({ dryRun: false });
      toast.push(
        "success",
        `배당 지급 완료 — ${r.lines.length}명에게 ${fmt.point(Number(r.totalDistributed))}P (에스크로 전액)`,
      );
      setDivOpen(false);
      await statsQ.refetch();
    } catch (e) {
      toast.push("error", (e as Error).message);
    } finally {
      setDivLoading(false);
    }
  };

  const doExport = () => {
    const sel = EXPORT_SETS.filter((s) => exportSets[s.key]).map((s) => s.key);
    if (sel.length === 0) {
      toast.push("error", "내보낼 항목을 하나 이상 선택하세요");
      return;
    }
    triggerDownload(`${API_BASE}/admin/export?sets=${sel.join(",")}&format=${exportFmt}`);
    setExportOpen(false);
  };

  const triggerSettle = async () => {
    setRunning(true);
    try {
      const r = await apiPost<SettleDueResponse>("/admin/auctions/settle-due", {});
      toast.push(
        "success",
        `정산 트리거 — 시도 ${r.attempted}건 / 성공 ${r.settled} / 실패 ${r.failed}`,
      );
      await Promise.all([statsQ.refetch(), unsoldQ.refetch()]);
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
        <TopNav p={p} active="admin" />
        <div style={{ flex: 1, padding: "24px 40px", overflow: "auto" }}>
          <AdminTabs p={p} active="ops" />
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
            <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
              <YearSelect p={p} value={year} onChange={setYear} />
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
              sub="현재 적립 잔액"
              mono
            />
            <KpiCard
              k="진행 중 경매"
              v={statsQ.data?.openAuctions ?? "—"}
              sub="진행 중"
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

          <Card p={p} padding={0} style={{ marginBottom: 16 }}>
            <div style={{ padding: "18px 24px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div>
                <div style={{ fontSize: 16, fontWeight: 800, color: p.ink, letterSpacing: "-0.01em" }}>
                  정산 데이터 내보내기
                </div>
                <div style={{ fontSize: 12, color: p.inkMuted, marginTop: 2 }}>
                  급여·복지 반영용 정산 자료 · Excel(.xlsx)/Markdown/JSON
                </div>
              </div>
              <Btn p={p} variant="dark" size="md" onClick={() => setExportOpen(true)}>
                <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
                  <Icon.bolt size={14} /> 내보내기
                </span>
              </Btn>
            </div>
          </Card>

          <Card p={p} padding={0} style={{ marginBottom: 16 }}>
            <div style={{ padding: "18px 24px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div>
                <div style={{ fontSize: 16, fontWeight: 800, color: p.ink, letterSpacing: "-0.01em" }}>
                  연말 풀 수집
                </div>
                <div style={{ fontSize: 12, color: p.inkMuted, marginTop: 2 }}>
                  올해 일반 연차 미사용분을 취합해 익년도 1일권 경매 매물을 만들고 기여 지분을 기록합니다 · 연도당 1회
                </div>
              </div>
              <Btn p={p} variant="dark" size="md" onClick={openPool}>
                <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
                  <Icon.bolt size={14} /> 풀 수집
                </span>
              </Btn>
            </div>
          </Card>

          <div style={{ display: "grid", gridTemplateColumns: "1.4fr 1fr", gap: 16 }}>
            <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
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
                      이벤트 연차로 지급하거나 다시 경매에 등록 가능
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
                      <div style={{ fontSize: 12, color: p.ink, fontWeight: 600 }}>연차 {a.leaveDays}일권</div>
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
                <Btn
                  p={p}
                  variant="primary"
                  size="md"
                  style={{ width: "100%", marginTop: 14 }}
                  onClick={openDividend}
                >
                  <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
                    <Icon.bolt size={14} /> 연말 배당 정산
                  </span>
                </Btn>
                <div style={{ fontSize: 11, color: p.inkMuted, marginTop: 8, lineHeight: 1.5 }}>
                  에스크로 잔액을 기여 지분만큼 일괄 지급합니다. 미리보기 후 실행되며,
                  1회만 지급됩니다.
                </div>
              </Card>
            </div>
          </div>
        </div>
      </div>
      {exportOpen && (
        <div
          onClick={() => setExportOpen(false)}
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(11,25,41,0.45)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 200,
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              width: 440,
              background: p.surface,
              borderRadius: 16,
              padding: 24,
              boxShadow: "0 20px 60px rgba(11,25,41,0.25)",
            }}
          >
            <div style={{ fontSize: 18, fontWeight: 800, color: p.ink, marginBottom: 4 }}>
              정산 데이터 내보내기
            </div>
            <div style={{ fontSize: 12, color: p.inkMuted, marginBottom: 18 }}>
              내보낼 항목과 형식을 선택하세요. 선택분이 한 파일로 묶여 다운로드됩니다.
            </div>

            <div style={{ fontSize: 12, fontWeight: 700, color: p.inkSoft, marginBottom: 8 }}>항목</div>
            <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 18 }}>
              {EXPORT_SETS.map((s) => (
                <label key={s.key} style={{ display: "flex", alignItems: "center", gap: 10, cursor: "pointer" }}>
                  <input
                    type="checkbox"
                    checked={!!exportSets[s.key]}
                    onChange={(e) => setExportSets((prev) => ({ ...prev, [s.key]: e.target.checked }))}
                  />
                  <span style={{ fontSize: 13, color: p.ink, fontWeight: 600 }}>{s.label}</span>
                  <span style={{ fontSize: 11, color: p.inkMuted }}>{s.desc}</span>
                </label>
              ))}
            </div>

            <div style={{ fontSize: 12, fontWeight: 700, color: p.inkSoft, marginBottom: 8 }}>형식</div>
            <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 22 }}>
              {EXPORT_FORMATS.map((f) => (
                <label key={f.key} style={{ display: "flex", alignItems: "center", gap: 10, cursor: "pointer" }}>
                  <input
                    type="radio"
                    name="exportFmt"
                    checked={exportFmt === f.key}
                    onChange={() => setExportFmt(f.key)}
                  />
                  <span style={{ fontSize: 13, color: p.ink }}>{f.label}</span>
                </label>
              ))}
            </div>

            <div style={{ display: "flex", justifyContent: "flex-end", gap: 8 }}>
              <Btn p={p} variant="ghost" size="md" onClick={() => setExportOpen(false)}>
                취소
              </Btn>
              <Btn p={p} variant="primary" size="md" onClick={doExport}>
                다운로드
              </Btn>
            </div>
          </div>
        </div>
      )}
      {divOpen && (
        <div
          onClick={() => !divLoading && setDivOpen(false)}
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(11,25,41,0.45)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 200,
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              width: 520,
              maxHeight: "82vh",
              display: "flex",
              flexDirection: "column",
              background: p.surface,
              borderRadius: 16,
              padding: 24,
              boxShadow: "0 20px 60px rgba(11,25,41,0.25)",
            }}
          >
            <div style={{ fontSize: 18, fontWeight: 800, color: p.ink, marginBottom: 4 }}>
              연말 배당 정산 (미리보기)
            </div>
            <div style={{ fontSize: 12, color: p.inkMuted, marginBottom: 18 }}>
              에스크로 잔액을 기여 지분만큼 일괄 지급합니다. 나머지 단수는 기여 지분 1위에게 귀속되어
              <b> 총 배당액과 에스크로 잔액이 정확히 일치</b>합니다. 실행은 1회만 가능합니다.
            </div>

            {divLoading && !divPreview && (
              <div style={{ padding: 40, textAlign: "center", color: p.inkMuted, fontSize: 14 }}>
                미리보기 계산 중…
              </div>
            )}

            {divPreview && (
              <>
                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "repeat(3, 1fr)",
                    gap: 10,
                    marginBottom: 16,
                  }}
                >
                  <MiniStat label="에스크로 잔액" value={`${fmt.point(Number(divPreview.escrowBalance))} P`} />
                  <MiniStat label="지급 대상" value={`${divPreview.lines.length}명`} />
                  <MiniStat
                    label="1위 단수 귀속"
                    value={`${fmt.point(Number(divPreview.remainder))} P`}
                  />
                </div>

                {divPreview.alreadySettled && (
                  <div
                    style={{
                      padding: "10px 14px",
                      borderRadius: 10,
                      background: `${p.danger}14`,
                      color: p.danger,
                      fontSize: 13,
                      fontWeight: 600,
                      marginBottom: 14,
                    }}
                  >
                    이미 배당이 정산되었습니다 — 재실행은 차단됩니다 (멱등).
                  </div>
                )}

                {divPreview.lines.length === 0 ? (
                  <div
                    style={{
                      padding: 24,
                      textAlign: "center",
                      color: p.inkMuted,
                      fontSize: 13,
                    }}
                  >
                    지급 대상이 없습니다 (에스크로 0 또는 기여자 없음).
                  </div>
                ) : (
                  <div style={{ overflow: "auto", flex: 1, marginBottom: 18 }}>
                    {divPreview.lines.map((l) => (
                      <div
                        key={l.userId}
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: 12,
                          padding: "10px 0",
                          borderBottom: `1px solid ${p.line}`,
                        }}
                      >
                        <div style={{ flex: 1, fontSize: 13, color: p.ink, fontWeight: 600 }}>
                          {l.name}
                          {l.isTopStake && (
                            <Pill p={p} tone="success" size="sm" style={{ marginLeft: 8 }}>
                              stake 1위
                            </Pill>
                          )}
                        </div>
                        <div style={{ fontSize: 12, color: p.inkMuted, width: 90, textAlign: "right" }}>
                          {l.contributedDays}일 ({(l.stakeRatio * 100).toFixed(1)}%)
                        </div>
                        <div
                          className="mono"
                          style={{ fontSize: 13, color: p.ink, fontWeight: 700, width: 110, textAlign: "right" }}
                        >
                          {fmt.point(Number(l.amount))} P
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </>
            )}

            <div style={{ display: "flex", justifyContent: "flex-end", gap: 8 }}>
              <Btn p={p} variant="ghost" size="md" disabled={divLoading} onClick={() => setDivOpen(false)}>
                취소
              </Btn>
              <Btn
                p={p}
                variant="primary"
                size="md"
                disabled={
                  divLoading ||
                  !divPreview ||
                  divPreview.alreadySettled ||
                  divPreview.lines.length === 0
                }
                onClick={runDividend}
              >
                {divLoading ? "처리 중…" : "실지급 실행"}
              </Btn>
            </div>
          </div>
        </div>
      )}
      {poolOpen && (
        <div
          onClick={() => !poolLoading && setPoolOpen(false)}
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(11,25,41,0.45)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 200,
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              width: 520,
              maxHeight: "82vh",
              display: "flex",
              flexDirection: "column",
              background: p.surface,
              borderRadius: 16,
              padding: 24,
              boxShadow: "0 20px 60px rgba(11,25,41,0.25)",
            }}
          >
            <div style={{ fontSize: 18, fontWeight: 800, color: p.ink, marginBottom: 4 }}>
              연말 풀 수집 (미리보기)
            </div>
            <div style={{ fontSize: 12, color: p.inkMuted, marginBottom: 18 }}>
              올해 <b>일반 연차</b> 미사용분을 전량 취합(1:1)해 익년도 1일권 경매 매물을 만들고
              기여자별 지분을 기록합니다. 연도당 1회만 실행됩니다.
            </div>

            {poolLoading && !poolPreview && (
              <div style={{ padding: 40, textAlign: "center", color: p.inkMuted, fontSize: 14 }}>
                미리보기 계산 중…
              </div>
            )}

            {poolPreview && (
              <>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 10, marginBottom: 16 }}>
                  <MiniStat label="기여자" value={`${poolPreview.contributorCount}명`} />
                  <MiniStat label="수집 일수" value={`${poolPreview.daysCollected}일`} />
                  <MiniStat
                    label={`${poolPreview.targetYear} 매물`}
                    value={`${poolPreview.auctionsCreated}개`}
                  />
                </div>

                {poolPreview.alreadyCollected && (
                  <div
                    style={{
                      padding: "10px 14px",
                      borderRadius: 10,
                      background: `${p.danger}14`,
                      color: p.danger,
                      fontSize: 13,
                      fontWeight: 600,
                      marginBottom: 14,
                    }}
                  >
                    {poolPreview.targetYear}년 풀이 이미 수집되었습니다 — 재실행은 차단됩니다 (멱등).
                  </div>
                )}

                {poolPreview.auctionsCreated === 0 ? (
                  <div style={{ padding: 24, textAlign: "center", color: p.inkMuted, fontSize: 13 }}>
                    수집할 기여(일반 연차 미사용분)가 없습니다.
                  </div>
                ) : (
                  <div style={{ overflow: "auto", flex: 1, marginBottom: 18 }}>
                    <div style={{ fontSize: 12, fontWeight: 700, color: p.inkSoft, marginBottom: 8 }}>
                      상위 기여자
                    </div>
                    {poolPreview.topContributors.map((c) => (
                      <div
                        key={c.userId}
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: 12,
                          padding: "10px 0",
                          borderBottom: `1px solid ${p.line}`,
                        }}
                      >
                        <div style={{ flex: 1, fontSize: 13, color: p.ink, fontWeight: 600 }}>{c.name}</div>
                        <div className="mono" style={{ fontSize: 13, color: p.ink, fontWeight: 700 }}>
                          {c.days}일
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </>
            )}

            <div style={{ display: "flex", justifyContent: "flex-end", gap: 8 }}>
              <Btn p={p} variant="ghost" size="md" disabled={poolLoading} onClick={() => setPoolOpen(false)}>
                취소
              </Btn>
              <Btn
                p={p}
                variant="primary"
                size="md"
                disabled={
                  poolLoading ||
                  !poolPreview ||
                  poolPreview.alreadyCollected ||
                  poolPreview.auctionsCreated === 0
                }
                onClick={runPool}
              >
                {poolLoading ? "처리 중…" : "수집 실행"}
              </Btn>
            </div>
          </div>
        </div>
      )}

    </ScreenFrame>
  );
}

function KpiCard({
  k,
  v,
  sub,
  mono,
  good,
  alert,
  onClick,
}: {
  k: string;
  v: string | number;
  sub: string;
  mono?: boolean;
  good?: boolean;
  /** 0이 아니면 처리 대기를 강조(주황색 숫자). */
  alert?: boolean;
  onClick?: () => void;
}) {
  const p = PALETTES.cobalt;
  const color = alert ? p.warn : good ? p.success : p.ink;
  return (
    <Card p={p} padding={16} style={onClick ? { cursor: "pointer" } : undefined} onClick={onClick}>
      <div style={{ fontSize: 11, color: p.inkMuted, fontWeight: 600 }}>{k}</div>
      <div
        className={mono ? "mono" : ""}
        style={{
          fontSize: 26,
          fontWeight: 800,
          color,
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

function MiniStat({ label, value }: { label: string; value: string }) {
  const p = PALETTES.cobalt;
  return (
    <div style={{ background: p.bg, borderRadius: 10, padding: "10px 12px" }}>
      <div style={{ fontSize: 11, color: p.inkMuted, fontWeight: 600 }}>{label}</div>
      <div className="mono" style={{ fontSize: 16, color: p.ink, fontWeight: 800, marginTop: 2 }}>
        {value}
      </div>
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

