import { useState } from "react";
import { PALETTES, FONT, fmt } from "@/lib/tokens";
import { Btn, Card, Pill, TopNav } from "@/components/atoms";
import { Icon } from "@/components/icons";
import { ScreenFrame } from "@/components/ScreenFrame";
import { AdminTabs } from "@/components/AdminTabs";
import { YearSelect } from "@/components/YearSelect";
import { useQuery } from "@/lib/use-query";
import { apiPost, downloadFile } from "@/lib/api";
import {
  collectLeavePool,
  getAdminStats,
  grantEventFromUnsold,
  listAuctions,
  listMembers,
  reopenUnsoldAuction,
  settleDividend,
  type AuctionListItem,
  type CollectLeavePoolResponse,
  type MemberRow,
  type SettleDividendResponse,
} from "@/lib/queries";
import { useToast } from "@/lib/toast";

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

/** datetime-local input용 로컬 시각 문자열(YYYY-MM-DDTHH:MM). */
function toLocalDatetimeInput(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
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
  // 유찰 매물 수동 처리(FR-4.2): 카드 클릭 → 모달 → 두 가지 모드.
  //   EVENT  : 직원에게 EVENT 휴가 지급 후 매물 소진 (기존)
  //   REOPEN : 같은 회사의 새 1일권 경매로 재오픈, 원본 소진 (2026-06-04 추가)
  const [unsoldPick, setUnsoldPick] = useState<AuctionListItem | null>(null);
  const [unsoldMode, setUnsoldMode] = useState<"EVENT" | "REOPEN">("EVENT");
  const [unsoldMemberQuery, setUnsoldMemberQuery] = useState("");
  const [unsoldChosen, setUnsoldChosen] = useState<MemberRow | null>(null);
  const [unsoldGranting, setUnsoldGranting] = useState(false);
  const [reopenStart, setReopenStart] = useState("");
  const [reopenEnd, setReopenEnd] = useState("");
  const unsoldMembersQ = useQuery(() => listMembers(), []);
  const openUnsold = (a: AuctionListItem) => {
    setUnsoldPick(a);
    setUnsoldMode("EVENT");
    setUnsoldMemberQuery("");
    setUnsoldChosen(null);
    // 재경매 기본값 — 지금 +1시간 시작, +8시간 마감(CreateAuctionModal과 동일).
    setReopenStart(toLocalDatetimeInput(new Date(Date.now() + 60 * 60_000)));
    setReopenEnd(toLocalDatetimeInput(new Date(Date.now() + 8 * 60 * 60_000)));
  };
  const closeUnsold = () => {
    if (unsoldGranting) return;
    setUnsoldPick(null);
    setUnsoldChosen(null);
    setUnsoldMemberQuery("");
  };
  const doGrantUnsold = async () => {
    if (!unsoldPick || !unsoldChosen) return;
    setUnsoldGranting(true);
    try {
      const r = await grantEventFromUnsold(unsoldPick.id, unsoldChosen.userId);
      toast.push(
        "success",
        `${unsoldChosen.name}에게 EVENT 휴가 ${r.days}일 지급 — 매물 ${unsoldPick.id} 소진`,
      );
      setUnsoldPick(null);
      setUnsoldChosen(null);
      setUnsoldMemberQuery("");
      await Promise.all([statsQ.refetch(), unsoldQ.refetch()]);
    } catch (e) {
      toast.push("error", (e as Error).message);
    } finally {
      setUnsoldGranting(false);
    }
  };
  const doReopenUnsold = async () => {
    if (!unsoldPick) return;
    const sa = new Date(reopenStart);
    const ea = new Date(reopenEnd);
    if (Number.isNaN(sa.getTime()) || Number.isNaN(ea.getTime())) {
      toast.push("error", "시작/마감 시각이 유효하지 않습니다");
      return;
    }
    if (!(ea > sa)) {
      toast.push("error", "마감 시각이 시작 시각보다 늦어야 합니다");
      return;
    }
    setUnsoldGranting(true);
    try {
      const r = await reopenUnsoldAuction(unsoldPick.id, sa.toISOString(), ea.toISOString());
      toast.push(
        "success",
        `${unsoldPick.id} → ${r.newId} 새 경매로 재오픈 (시작 ${new Date(r.startedAt).toLocaleString("ko-KR")})`,
      );
      setUnsoldPick(null);
      await Promise.all([statsQ.refetch(), unsoldQ.refetch()]);
    } catch (e) {
      toast.push("error", (e as Error).message);
    } finally {
      setUnsoldGranting(false);
    }
  };

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
        `배당 지급 완료 — ${r.lines.length}명에게 ${fmt.point(Number(r.totalDistributed))}콘 (에스크로 전액)`,
      );
      setDivOpen(false);
      await statsQ.refetch();
    } catch (e) {
      toast.push("error", (e as Error).message);
    } finally {
      setDivLoading(false);
    }
  };

  const doExport = async () => {
    const sel = EXPORT_SETS.filter((s) => exportSets[s.key]).map((s) => s.key);
    if (sel.length === 0) {
      toast.push("error", "내보낼 항목을 하나 이상 선택하세요");
      return;
    }
    try {
      await downloadFile(
        `/admin/export?sets=${sel.join(",")}&format=${exportFmt}`,
        `정산데이터.${exportFmt}`,
      );
      setExportOpen(false);
    } catch (e) {
      toast.push("error", e instanceof Error ? e.message : "내보내기에 실패했습니다");
    }
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
                      onClick={() => openUnsold(a)}
                      title="클릭해 수동 처리"
                      style={{
                        padding: 12,
                        background: p.bg,
                        borderRadius: 10,
                        display: "flex",
                        flexDirection: "column",
                        gap: 6,
                        cursor: "pointer",
                        border: `1px solid ${p.line}`,
                        transition: "border-color 0.15s, transform 0.05s",
                      }}
                      onMouseEnter={(e) => (e.currentTarget.style.borderColor = p.ink)}
                      onMouseLeave={(e) => (e.currentTarget.style.borderColor = p.line)}
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
                    gridTemplateColumns: "repeat(2, 1fr)",
                    gap: 10,
                    marginBottom: 16,
                  }}
                >
                  <MiniStat label="에스크로 잔액" value={`${fmt.point(Number(divPreview.escrowBalance))} 콘`} />
                  <MiniStat label="지급 대상" value={`${divPreview.lines.length}명`} />
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
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontSize: 13, color: p.ink, fontWeight: 600 }}>
                            {l.name}
                            {l.isTopStake && (
                              <Pill p={p} tone="success" size="sm" style={{ marginLeft: 8 }}>
                                stake 1위
                              </Pill>
                            )}
                          </div>
                          {(l.team || l.jobRank || l.jobTitle) && (
                            <div style={{ fontSize: 11, color: p.inkMuted, marginTop: 2 }}>
                              {[l.team, [l.jobRank, l.jobTitle].filter(Boolean).join(" / ")].filter(Boolean).join(" · ")}
                            </div>
                          )}
                        </div>
                        <div style={{ fontSize: 12, color: p.inkMuted, width: 90, textAlign: "right" }}>
                          {l.contributedDays}일 ({(l.stakeRatio * 100).toFixed(1)}%)
                        </div>
                        <div
                          className="mono"
                          style={{ fontSize: 13, color: p.ink, fontWeight: 700, width: 110, textAlign: "right" }}
                        >
                          {fmt.point(Number(l.amount))} 콘
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

      {/* 유찰 매물 수동 처리 모달 — 직원 선택 → EVENT 휴가로 변환 지급(소진) */}
      {unsoldPick && (
        <div
          onClick={closeUnsold}
          style={{
            position: "fixed", inset: 0, background: "rgba(11,25,41,0.45)",
            display: "flex", alignItems: "center", justifyContent: "center", zIndex: 200,
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              width: 520, maxWidth: "92vw", maxHeight: "86vh",
              background: p.surface, borderRadius: 16,
              boxShadow: "0 20px 60px rgba(11,25,41,0.25)",
              display: "flex", flexDirection: "column",
            }}
          >
            <div style={{ padding: "20px 22px 14px", borderBottom: `1px solid ${p.line}` }}>
              <div style={{ fontSize: 18, fontWeight: 800, color: p.ink }}>유찰 매물 수동 처리</div>
              <div style={{ fontSize: 12, color: p.inkMuted, marginTop: 4 }}>
                {unsoldMode === "EVENT"
                  ? "선택한 직원에게 EVENT 휴가로 변환 지급합니다. 변환 후 매물은 소진(삭제)됩니다."
                  : "원본 매물을 소진하고, 같은 회사의 새 1일권 경매(시작가 30,000 콘)로 다시 올립니다."}
              </div>
              <div
                style={{
                  marginTop: 12, padding: 12, background: p.bg, borderRadius: 10,
                  display: "grid", gridTemplateColumns: "auto 1fr", columnGap: 14, rowGap: 4,
                  fontSize: 12,
                }}
              >
                <span style={{ color: p.inkMuted }}>매물 ID</span>
                <span className="mono" style={{ color: p.ink, fontWeight: 700 }}>{unsoldPick.id}</span>
                <span style={{ color: p.inkMuted }}>연차</span>
                <span style={{ color: p.ink, fontWeight: 700 }}>{unsoldPick.leaveDays}일권</span>
                <span style={{ color: p.inkMuted }}>마감</span>
                <span style={{ color: p.inkSoft }}>{new Date(unsoldPick.endsAt).toLocaleString("ko-KR")}</span>
              </div>

              {/* 처리 방식 탭 — EVENT 지급 vs 새 경매 재오픈 */}
              <div style={{ display: "flex", gap: 6, marginTop: 12 }}>
                {([
                  { id: "EVENT" as const, label: "직원에게 EVENT 휴가" },
                  { id: "REOPEN" as const, label: "새 경매로 재오픈" },
                ]).map((t) => {
                  const on = t.id === unsoldMode;
                  return (
                    <div
                      key={t.id}
                      onClick={() => !on && !unsoldGranting && setUnsoldMode(t.id)}
                      style={{
                        padding: "8px 14px", borderRadius: 10, fontSize: 12, fontWeight: 700,
                        color: on ? p.surface : p.inkMuted, background: on ? p.ink : p.surface,
                        border: `1px solid ${on ? p.ink : p.line}`, cursor: on ? "default" : "pointer",
                      }}
                    >
                      {t.label}
                    </div>
                  );
                })}
              </div>
            </div>

            {unsoldMode === "EVENT" ? (
              <div style={{ padding: "14px 22px", display: "flex", flexDirection: "column", gap: 10, flex: 1, minHeight: 0 }}>
                <div style={{ fontSize: 12, fontWeight: 700, color: p.inkSoft }}>지급받을 직원</div>
                <input
                  value={unsoldMemberQuery}
                  onChange={(e) => setUnsoldMemberQuery(e.target.value)}
                  placeholder="이름·사번·이메일·부서로 검색"
                  style={{
                    width: "100%", padding: "9px 12px", borderRadius: 9,
                    border: `1px solid ${p.line}`, fontSize: 13, color: p.ink, background: p.bg,
                    boxSizing: "border-box",
                  }}
                />
                <div
                  style={{
                    border: `1px solid ${p.line}`, borderRadius: 10, overflow: "auto",
                    flex: 1, minHeight: 200, maxHeight: 280, background: p.bg,
                  }}
                >
                  {(() => {
                    const q = unsoldMemberQuery.trim().toLowerCase();
                    const all = (unsoldMembersQ.data?.members ?? []).filter((m) => m.active);
                    const filtered = q
                      ? all.filter((m) =>
                          m.name.toLowerCase().includes(q) ||
                          m.empId.toLowerCase().includes(q) ||
                          (m.email ?? "").toLowerCase().includes(q) ||
                          (m.team ?? "").toLowerCase().includes(q),
                        )
                      : all;
                    if (unsoldMembersQ.loading) {
                      return <div style={{ padding: 16, fontSize: 12, color: p.inkMuted }}>회원 목록 불러오는 중…</div>;
                    }
                    if (filtered.length === 0) {
                      return <div style={{ padding: 16, fontSize: 12, color: p.inkMuted }}>일치하는 직원이 없습니다.</div>;
                    }
                    return filtered.slice(0, 80).map((m, i, arr) => {
                      const on = unsoldChosen?.userId === m.userId;
                      return (
                        <div
                          key={m.userId}
                          onClick={() => setUnsoldChosen(m)}
                          style={{
                            padding: "10px 14px",
                            background: on ? p.accentSoft : "transparent",
                            borderBottom: i === arr.length - 1 ? "none" : `1px solid ${p.line}`,
                            cursor: "pointer",
                            display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12,
                          }}
                        >
                          <div style={{ minWidth: 0, flex: 1 }}>
                            <div style={{ fontSize: 13, color: p.ink, fontWeight: 700 }}>
                              {m.name}
                              <span className="mono" style={{ fontSize: 11, color: p.inkMuted, marginLeft: 8, fontWeight: 500 }}>
                                {m.empId}
                              </span>
                            </div>
                            <div style={{ fontSize: 11, color: p.inkMuted, marginTop: 2 }}>
                              {[m.team, m.jobRank, m.jobTitle].filter(Boolean).join(" · ") || "—"}
                            </div>
                          </div>
                          {on && (
                            <Pill p={p} tone="accent" size="sm" style={{ fontSize: 10 }}>선택</Pill>
                          )}
                        </div>
                      );
                    });
                  })()}
                </div>
              </div>
            ) : (
              <div style={{ padding: "14px 22px", display: "flex", flexDirection: "column", gap: 12, flex: 1 }}>
                <div style={{ fontSize: 12, color: p.inkMuted, lineHeight: 1.5 }}>
                  새 1일권 매물이 자동 채번되어 원본과 같은 회사에 생성됩니다.
                  시작가는 정책 고정 <b style={{ color: p.ink }}>30,000 콘</b>. CREATED 상태로 만들어져 오픈 시각이 되면 자동으로 열립니다.
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                  <label style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                    <span style={{ fontSize: 12, fontWeight: 700, color: p.inkSoft }}>오픈 시각</span>
                    <input
                      type="datetime-local"
                      value={reopenStart}
                      onChange={(e) => setReopenStart(e.target.value)}
                      style={{
                        padding: "9px 12px", borderRadius: 9, border: `1px solid ${p.line}`,
                        fontSize: 13, color: p.ink, background: p.bg, boxSizing: "border-box",
                      }}
                    />
                  </label>
                  <label style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                    <span style={{ fontSize: 12, fontWeight: 700, color: p.inkSoft }}>마감 시각</span>
                    <input
                      type="datetime-local"
                      value={reopenEnd}
                      onChange={(e) => setReopenEnd(e.target.value)}
                      style={{
                        padding: "9px 12px", borderRadius: 9, border: `1px solid ${p.line}`,
                        fontSize: 13, color: p.ink, background: p.bg, boxSizing: "border-box",
                      }}
                    />
                  </label>
                </div>
              </div>
            )}

            <div style={{ padding: "14px 22px 20px", borderTop: `1px solid ${p.line}`, display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8 }}>
              <div style={{ fontSize: 11, color: p.inkMuted }}>
                {unsoldMode === "EVENT"
                  ? unsoldChosen ? (
                      <>지급 대상: <b style={{ color: p.ink }}>{unsoldChosen.name}</b> · EVENT {unsoldPick.leaveDays}일</>
                    ) : (
                      "직원을 선택하세요"
                    )
                  : "원본은 소진 · 새 매물 1개 생성됨"}
              </div>
              <div style={{ display: "flex", gap: 8 }}>
                <Btn p={p} variant="ghost" size="md" disabled={unsoldGranting} onClick={closeUnsold}>취소</Btn>
                {unsoldMode === "EVENT" ? (
                  <Btn
                    p={p}
                    variant="primary"
                    size="md"
                    disabled={!unsoldChosen || unsoldGranting}
                    onClick={doGrantUnsold}
                  >
                    {unsoldGranting ? "지급 중…" : "EVENT 휴가 지급"}
                  </Btn>
                ) : (
                  <Btn
                    p={p}
                    variant="primary"
                    size="md"
                    disabled={unsoldGranting}
                    onClick={doReopenUnsold}
                  >
                    {unsoldGranting ? "재오픈 중…" : "새 경매로 재오픈"}
                  </Btn>
                )}
              </div>
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

