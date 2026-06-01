// 관리자 — 경매관리 탭.
// 1일권 매물은 동질재 — 개별 매물 식별이 의미 없으므로 행/체크박스/개별 모달 없음.
// 보이는 것: 카운터 5개, 현 정책 한 줄, 일괄 액션(정책 설정 / 수동 추가 / 보류·예정 일괄 취소).

import { useState } from "react";
import { PALETTES, FONT } from "@/lib/tokens";
import { Btn, Card, Pill, TopNav } from "@/components/atoms";
import { Icon } from "@/components/icons";
import { ScreenFrame } from "@/components/ScreenFrame";
import { AdminTabs } from "@/components/AdminTabs";
import { useQuery } from "@/lib/use-query";
import { useToast } from "@/lib/toast";
import {
  cancelAuctions,
  createAuction,
  getAuctionsSummary,
  getReleasePolicy,
  listAuctions,
  updateReleasePolicy,
  type ReleasePolicy,
} from "@/lib/queries";

const DAY_LABELS = ["일", "월", "화", "수", "목", "금", "토"];

export default function AdminAuctionsPage() {
  const p = PALETTES.cobalt;
  const toast = useToast();
  const policyQ = useQuery(() => getReleasePolicy(), []);
  const summaryQ = useQuery(() => getAuctionsSummary(), []);

  const [policyOpen, setPolicyOpen] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);
  const [busy, setBusy] = useState(false);

  const refreshAll = async () => {
    await Promise.all([summaryQ.refetch(), policyQ.refetch()]);
  };

  const cancelByStatus = async (status: "DRAFT" | "CREATED", label: string) => {
    if (!confirm(`${label} 매물을 전부 취소합니다.`)) return;
    setBusy(true);
    try {
      const items = await listAuctions([status]);
      if (items.length === 0) {
        toast.push("error", `${label} 매물이 없습니다`);
        return;
      }
      const r = await cancelAuctions(items.map((i) => i.id));
      const parts = [`삭제 ${r.deletedIds.length}건`];
      if (r.protectedIds.length > 0) parts.push(`풀 매물 보호 ${r.protectedIds.length}건`);
      if (r.skippedIds.length > 0) parts.push(`무시 ${r.skippedIds.length}건`);
      const hasIssue = r.protectedIds.length > 0 || r.skippedIds.length > 0;
      toast.push(hasIssue ? "error" : "success", `${label} 취소 — ${parts.join(" / ")}`);
      await summaryQ.refetch();
    } catch (e) {
      toast.push("error", (e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <ScreenFrame>
      <div style={{ width: "100%", minHeight: 900, background: p.bg, fontFamily: FONT.sans, display: "flex", flexDirection: "column" }}>
        <TopNav p={p} active="admin" />
        <div style={{ flex: 1, padding: "24px 40px", overflow: "auto" }}>
          <AdminTabs p={p} active="auctions" />

          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", marginBottom: 20 }}>
            <div>
              <div style={{ fontSize: 13, color: p.inkMuted, fontWeight: 500, display: "flex", alignItems: "center", gap: 6 }}>
                <Icon.shield size={14} /> 관리자 콘솔
              </div>
              <div style={{ fontSize: 28, fontWeight: 800, color: p.ink, letterSpacing: "-0.025em", marginTop: 4 }}>
                경매관리
              </div>
            </div>
            <div style={{ display: "flex", gap: 8 }}>
              <Btn p={p} variant="ghost" size="md" onClick={refreshAll}>새로고침</Btn>
              <Btn p={p} variant="ghost" size="md" onClick={() => setPolicyOpen(true)}>
                <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
                  <Icon.bolt size={14} /> 분산 정책 설정
                </span>
              </Btn>
              <Btn p={p} variant="dark" size="md" onClick={() => setCreateOpen(true)}>
                <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>+ 수동 추가</span>
              </Btn>
            </div>
          </div>

          {/* 카운터 — 1일권 동질재라 갯수만 본다 */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: 12, marginBottom: 16 }}>
            <KpiCard k="총 매물" v={summaryQ.data?.total ?? "—"} sub="모든 상태" />
            <KpiCard k="보류" v={summaryQ.data?.draft ?? "—"} sub="DRAFT · 오픈 미정" />
            <KpiCard k="오픈 예정" v={summaryQ.data?.upcoming ?? "—"} sub="CREATED · 자동 OPEN" />
            <KpiCard k="진행 중" v={summaryQ.data?.open ?? "—"} sub="OPEN" />
            <KpiCard
              k="종료"
              v={summaryQ.data?.ended ?? "—"}
              sub={`AWARDED ${summaryQ.data?.byStatus.AWARDED ?? 0} · UNSOLD ${summaryQ.data?.byStatus.UNSOLD ?? 0}`}
              good
            />
          </div>

          {/* 현 정책 한 줄 요약 */}
          <Card p={p} padding={14} style={{ marginBottom: 16, display: "flex", alignItems: "center", gap: 12 }}>
            <Pill p={p} tone="neutral" size="sm">현 정책</Pill>
            <div style={{ fontSize: 13, color: p.ink, fontWeight: 600 }}>
              {policyQ.data ? formatPolicy(policyQ.data) : policyQ.loading ? "로딩…" : "—"}
            </div>
            <div style={{ flex: 1 }} />
            <div style={{ fontSize: 11, color: p.inkMuted }}>
              풀 수집 시 새 매물의 시작 시각 분산. 이미 만들어진 매물엔 영향 없음.
            </div>
          </Card>

          {/* 일괄 액션 — 동질재라 "전부 취소"만 */}
          <Card p={p} padding={20}>
            <div style={{ fontSize: 14, fontWeight: 800, color: p.ink, marginBottom: 4 }}>일괄 액션</div>
            <div style={{ fontSize: 12, color: p.inkMuted, marginBottom: 14 }}>
              1일권은 모두 같은 매물이라 개별 관리하지 않고 갯수 단위로 처리합니다. 풀 수집(LeavePoolRun) 매물은 자동 보호됨.
            </div>
            <div style={{ display: "flex", gap: 10 }}>
              <Btn
                p={p}
                variant="ghost"
                size="md"
                disabled={busy || (summaryQ.data?.draft ?? 0) === 0}
                onClick={() => cancelByStatus("DRAFT", `보류 ${summaryQ.data?.draft ?? 0}개`)}
              >
                보류 {summaryQ.data?.draft ?? 0}개 전부 취소
              </Btn>
              <Btn
                p={p}
                variant="ghost"
                size="md"
                disabled={busy || (summaryQ.data?.upcoming ?? 0) === 0}
                onClick={() => cancelByStatus("CREATED", `오픈 예정 ${summaryQ.data?.upcoming ?? 0}개`)}
              >
                오픈 예정 {summaryQ.data?.upcoming ?? 0}개 전부 취소
              </Btn>
            </div>
          </Card>
        </div>
      </div>

      {policyOpen && (
        <PolicyModal
          initial={policyQ.data ?? { cadence: "none" }}
          onClose={() => setPolicyOpen(false)}
          onSaved={async () => {
            setPolicyOpen(false);
            await policyQ.refetch();
            toast.push("success", "분산 정책 저장됨");
          }}
          onError={(m) => toast.push("error", m)}
        />
      )}

      {createOpen && (
        <CreateAuctionModal
          onClose={() => setCreateOpen(false)}
          onCreated={async (n, mode) => {
            setCreateOpen(false);
            await summaryQ.refetch();
            toast.push("success", `1일권 ${n}개 ${mode === "draft" ? "보류" : "예약"} 추가 완료`);
          }}
          onError={(m) => toast.push("error", m)}
        />
      )}
    </ScreenFrame>
  );
}

// ─────────────────────────────────────────────────────────────
function PolicyModal({
  initial, onClose, onSaved, onError,
}: {
  initial: ReleasePolicy;
  onClose: () => void;
  onSaved: () => void;
  onError: (m: string) => void;
}) {
  const p = PALETTES.cobalt;
  const [cadence, setCadence] = useState<ReleasePolicy["cadence"]>(initial.cadence);
  const [dayOfWeek, setDayOfWeek] = useState(initial.cadence === "weekly" ? initial.dayOfWeek : 1);
  const [dayOfMonth, setDayOfMonth] = useState(initial.cadence === "monthly" ? initial.dayOfMonth : 3);
  const [timeOfDay, setTimeOfDay] = useState(initial.cadence !== "none" ? initial.timeOfDay : "09:00");
  const [quantity, setQuantity] = useState(initial.cadence !== "none" ? initial.quantity : 5);
  const [saving, setSaving] = useState(false);

  const save = async () => {
    let body: ReleasePolicy;
    if (cadence === "none") body = { cadence };
    else if (cadence === "daily") body = { cadence, timeOfDay, quantity };
    else if (cadence === "weekly") body = { cadence, dayOfWeek, timeOfDay, quantity };
    else body = { cadence, dayOfMonth, timeOfDay, quantity };
    setSaving(true);
    try {
      await updateReleasePolicy(body);
      onSaved();
    } catch (e) {
      onError((e as Error).message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div
      onClick={() => !saving && onClose()}
      style={{ position: "fixed", inset: 0, background: "rgba(11,25,41,0.45)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 200 }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{ width: 480, background: p.surface, borderRadius: 16, padding: 24, boxShadow: "0 20px 60px rgba(11,25,41,0.25)" }}
      >
        <div style={{ fontSize: 18, fontWeight: 800, color: p.ink, marginBottom: 4 }}>분산 오픈 정책</div>
        <div style={{ fontSize: 12, color: p.inkMuted, marginBottom: 18, lineHeight: 1.5 }}>
          풀 수집 시 새 매물의 시작 시각 분산 방식. <b>배치 미사용</b>이면 모두 보류로 만들고 수동 운영.
        </div>

        <FieldBlock p={p} label="주기">
          <select value={cadence} onChange={(e) => setCadence(e.target.value as ReleasePolicy["cadence"])} style={inputStyle(p)}>
            <option value="none">배치 미사용 (수동)</option>
            <option value="daily">매일</option>
            <option value="weekly">매주</option>
            <option value="monthly">매월</option>
          </select>
        </FieldBlock>

        {cadence !== "none" && (
          <div style={{ display: "grid", gridTemplateColumns: cadence === "daily" ? "1fr 1fr" : "1fr 1fr 1fr", gap: 10 }}>
            {cadence === "weekly" && (
              <FieldBlock p={p} label="요일">
                <select value={dayOfWeek} onChange={(e) => setDayOfWeek(Number(e.target.value))} style={inputStyle(p)}>
                  {DAY_LABELS.map((d, i) => (
                    <option key={i} value={i}>{d}요일</option>
                  ))}
                </select>
              </FieldBlock>
            )}
            {cadence === "monthly" && (
              <FieldBlock p={p} label="일자 (1~31)">
                <input type="number" min={1} max={31} value={dayOfMonth} onChange={(e) => setDayOfMonth(Number(e.target.value))} style={inputStyle(p)} />
              </FieldBlock>
            )}
            <FieldBlock p={p} label="시각 (HH:MM)">
              <input type="time" value={timeOfDay} onChange={(e) => setTimeOfDay(e.target.value)} style={inputStyle(p)} />
            </FieldBlock>
            <FieldBlock p={p} label="1회 수량">
              <input type="number" min={1} step={1} value={quantity} onChange={(e) => setQuantity(Number(e.target.value))} style={inputStyle(p)} />
            </FieldBlock>
          </div>
        )}

        <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 14 }}>
          <Btn p={p} variant="ghost" size="md" disabled={saving} onClick={onClose}>취소</Btn>
          <Btn p={p} variant="primary" size="md" disabled={saving} onClick={save}>
            {saving ? "저장 중…" : "저장"}
          </Btn>
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
function CreateAuctionModal({
  onClose, onCreated, onError,
}: {
  onClose: () => void;
  onCreated: (created: number, mode: "draft" | "scheduled") => void;
  onError: (m: string) => void;
}) {
  const p = PALETTES.cobalt;
  const [mode, setMode] = useState<"draft" | "scheduled">("draft");
  const [startedAt, setStartedAt] = useState(toLocalDatetimeInput(roundToHour(new Date(Date.now() + 3600_000))));
  const [endsAt, setEndsAt] = useState(toLocalDatetimeInput(roundToHour(new Date(Date.now() + 8 * 3600_000))));
  const [startPrice, setStartPrice] = useState("5000");
  const [quantity, setQuantity] = useState("1");
  const [creating, setCreating] = useState(false);

  const create = async () => {
    const n = Number(quantity);
    if (!Number.isInteger(n) || n < 1 || n > 1000) {
      onError("발행 수량은 1~1000 사이 정수여야 합니다");
      return;
    }
    if (mode === "scheduled") {
      const sa = new Date(startedAt);
      const ea = new Date(endsAt);
      if (!(ea > sa)) {
        onError("마감 시각이 시작 시각보다 늦어야 합니다");
        return;
      }
    }
    setCreating(true);
    try {
      const body =
        mode === "draft"
          ? { quantity: n, startPrice, asDraft: true }
          : {
              quantity: n,
              startPrice,
              startedAt: new Date(startedAt).toISOString(),
              endsAt: new Date(endsAt).toISOString(),
            };
      const r = await createAuction(body);
      onCreated(r.created, mode);
    } catch (e) {
      onError((e as Error).message);
    } finally {
      setCreating(false);
    }
  };

  return (
    <div
      onClick={() => !creating && onClose()}
      style={{ position: "fixed", inset: 0, background: "rgba(11,25,41,0.45)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 200 }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{ width: 480, background: p.surface, borderRadius: 16, padding: 24, boxShadow: "0 20px 60px rgba(11,25,41,0.25)" }}
      >
        <div style={{ fontSize: 18, fontWeight: 800, color: p.ink, marginBottom: 4 }}>매물 수동 추가</div>
        <div style={{ fontSize: 12, color: p.inkMuted, marginBottom: 18, lineHeight: 1.5 }}>
          <b>1일권</b>을 N개 만듭니다 (ADR-007). ID는 자동 채번.
        </div>

        <div style={{ display: "flex", gap: 8, marginBottom: 14 }}>
          <ModeChip p={p} active={mode === "draft"} onClick={() => setMode("draft")}
            title="보류로 만들기" sub="시간 미정 · 나중에 결정" />
          <ModeChip p={p} active={mode === "scheduled"} onClick={() => setMode("scheduled")}
            title="예약하기" sub="시간 정해서 자동 OPEN" />
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
          <FieldBlock p={p} label="발행 수량 (1일권 × N)">
            <input type="number" min={1} max={1000} step={1} value={quantity} onChange={(e) => setQuantity(e.target.value)} style={inputStyle(p)} />
          </FieldBlock>
          <FieldBlock p={p} label="시작가 (P)">
            <input type="number" min={0} step={100} value={startPrice} onChange={(e) => setStartPrice(e.target.value)} style={inputStyle(p)} />
          </FieldBlock>
        </div>

        {mode === "scheduled" && (
          <>
            <FieldBlock p={p} label="오픈 시각">
              <input type="datetime-local" value={startedAt} onChange={(e) => setStartedAt(e.target.value)} style={inputStyle(p)} />
            </FieldBlock>
            <FieldBlock p={p} label="마감 시각">
              <input type="datetime-local" value={endsAt} onChange={(e) => setEndsAt(e.target.value)} style={inputStyle(p)} />
            </FieldBlock>
          </>
        )}

        <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 14 }}>
          <Btn p={p} variant="ghost" size="md" disabled={creating} onClick={onClose}>취소</Btn>
          <Btn p={p} variant="primary" size="md" disabled={creating} onClick={create}>
            {creating ? "추가 중…" : `${quantity}개 ${mode === "draft" ? "보류 추가" : "예약 추가"}`}
          </Btn>
        </div>
      </div>
    </div>
  );
}

function ModeChip({
  p, active, onClick, title, sub,
}: {
  p: typeof PALETTES.cobalt;
  active: boolean;
  onClick: () => void;
  title: string;
  sub: string;
}) {
  return (
    <div
      onClick={onClick}
      style={{
        flex: 1, padding: "10px 12px", borderRadius: 10, cursor: "pointer",
        background: active ? p.ink : p.bg,
        color: active ? p.surface : p.ink,
        border: `1px solid ${active ? p.ink : p.line}`,
      }}
    >
      <div style={{ fontSize: 13, fontWeight: 700 }}>{title}</div>
      <div style={{ fontSize: 11, marginTop: 2, color: active ? "rgba(255,255,255,0.7)" : p.inkMuted }}>{sub}</div>
    </div>
  );
}

function KpiCard({ k, v, sub, good }: { k: string; v: string | number; sub: string; good?: boolean }) {
  const p = PALETTES.cobalt;
  return (
    <Card p={p} padding={16}>
      <div style={{ fontSize: 11, color: p.inkMuted, fontWeight: 600 }}>{k}</div>
      <div style={{ fontSize: 26, fontWeight: 800, color: good ? p.success : p.ink, marginTop: 4, letterSpacing: "-0.02em" }}>{v}</div>
      <div style={{ fontSize: 11, color: p.inkMuted, marginTop: 2 }}>{sub}</div>
    </Card>
  );
}

function FieldBlock({ p, label, children }: { p: typeof PALETTES.cobalt; label: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: 10 }}>
      <div style={{ fontSize: 12, fontWeight: 700, color: p.inkSoft, marginBottom: 6 }}>{label}</div>
      {children}
    </div>
  );
}

function inputStyle(p: typeof PALETTES.cobalt): React.CSSProperties {
  return {
    width: "100%", padding: "9px 12px", borderRadius: 9,
    border: `1px solid ${p.line}`, fontSize: 13, color: p.ink, background: p.bg,
    boxSizing: "border-box", fontFamily: "inherit",
  };
}

function toLocalDatetimeInput(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function roundToHour(d: Date): Date {
  const r = new Date(d);
  r.setMinutes(0, 0, 0);
  return r;
}

function formatPolicy(p: ReleasePolicy): string {
  if (p.cadence === "none") return "배치 미사용 (수동 운영)";
  if (p.cadence === "daily") return `매일 ${p.timeOfDay} · ${p.quantity}개`;
  if (p.cadence === "weekly") return `매주 ${DAY_LABELS[p.dayOfWeek]}요일 ${p.timeOfDay} · ${p.quantity}개`;
  return `매월 ${p.dayOfMonth}일 ${p.timeOfDay} · ${p.quantity}개`;
}
