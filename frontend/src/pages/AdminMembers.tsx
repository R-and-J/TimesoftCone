import { useEffect, useState, type CSSProperties, type ReactNode } from "react";
import { useSearchParams } from "react-router-dom";
import { PALETTES, FONT, fmt, type Palette } from "@/lib/tokens";
import { Btn, Pill, TopNav } from "@/components/atoms";
import { Icon } from "@/components/icons";
import { ScreenFrame } from "@/components/ScreenFrame";
import { AdminTabs } from "@/components/AdminTabs";
import { DataGrid } from "@/components/DataGrid";
import { useQuery } from "@/lib/use-query";
import { useToast } from "@/lib/toast";
import {
  adminCreditWallet,
  approveChargeRequest,
  getAdminChargeRequest,
  listMembers,
  rejectChargeRequest,
  syncMembers,
  createMember,
  updateMember,
  checkLeaveSync,
  reconcileUserLeave,
  type ChargeRequestRow,
  type MemberRow,
  type LeaveSyncReport,
  type LeaveSyncRow,
} from "@/lib/queries";
import { roleLabel } from "@/lib/roles";

type FormState = {
  userId: string | null; // null = 신규
  email: string;
  name: string;
  team: string;
  jobRank: string;
  jobTitle: string;
  // 로컬 폼은 EXAM(독립)/ADMIN만 — EZPASS는 ezpass 동기화로만 관리.
  role: "EXAM" | "ADMIN";
  active: boolean;
  password: string;
};

const EMPTY_FORM: FormState = {
  userId: null,
  email: "",
  name: "",
  team: "",
  jobRank: "",
  jobTitle: "",
  role: "EXAM",
  active: true,
  password: "",
};

export default function AdminMembersPage() {
  const p = PALETTES.cobalt;
  const toast = useToast();
  const membersQ = useQuery(() => listMembers(), []);
  const [syncing, setSyncing] = useState(false);
  const [lastSync, setLastSync] = useState<string | null>(null);
  const [form, setForm] = useState<FormState | null>(null);
  const [saving, setSaving] = useState(false);

  const data = membersQ.data;
  const isLocal = data?.mode === "local";
  // 컬럼 폭(사번/이름/이메일/부서/직급·직책/권한/포인트/작업). 위임형은 작업이 충전 한 개라 좁다.
  const w = isLocal
    ? ["110px", "1fr", "200px", "1fr", "150px", "80px", "110px", "220px"]
    : ["120px", "1fr", "220px", "1.2fr", "160px", "90px", "110px", "80px"];

  // 충전 모달 상태.
  // free: 관리자 자유 충전. request: 알림에서 들어온 충전 요청(승인/반려).
  const [creditFor, setCreditFor] = useState<MemberRow | null>(null);
  const [creditAmount, setCreditAmount] = useState("");
  const [creditReason, setCreditReason] = useState("");
  const [crediting, setCrediting] = useState(false);
  const [chargeReq, setChargeReq] = useState<ChargeRequestRow | null>(null);

  // ezpass 연차 정합 점검 — 평소 자동 sync(낙찰→Outbox→streYryc)면 항상 일치.
  // drift 발생 시(데이터 이슈 등)에만 [점검] 트리거 → 행별 [동기] 비상조치.
  const [syncReport, setSyncReport] = useState<LeaveSyncReport | null>(null);
  const [syncChecking, setSyncChecking] = useState(false);
  const [reconciling, setReconciling] = useState<string | null>(null);

  const runLeaveSyncCheck = async () => {
    setSyncChecking(true);
    try {
      const r = await checkLeaveSync();
      setSyncReport(r);
      if (r.driftCount === 0) toast.push("success", "ezpass 연차 정합 OK");
      else toast.push("info", `drift ${r.driftCount}명 발견`);
    } catch (e) {
      toast.push("error", (e as Error).message);
    } finally {
      setSyncChecking(false);
    }
  };

  const doReconcile = async (userId: string) => {
    setReconciling(userId);
    try {
      const r = await reconcileUserLeave(userId);
      toast.push("success", `동기됨 — ezpass ${r.ezpassPrevious} → ${r.ezpassApplied}`);
      await runLeaveSyncCheck();
    } catch (e) {
      toast.push("error", (e as Error).message);
    } finally {
      setReconciling(null);
    }
  };

  const openCredit = (m: MemberRow) => {
    setCreditFor(m);
    setCreditAmount("");
    setCreditReason("");
    setChargeReq(null);
  };
  const openCreditFromRequest = (m: MemberRow, req: ChargeRequestRow) => {
    setCreditFor(m);
    setCreditAmount(req.amount);
    setCreditReason(req.note ?? "");
    setChargeReq(req);
  };
  const doCredit = async () => {
    if (!creditFor) return;
    const n = Number(creditAmount);
    if (!Number.isFinite(n) || !Number.isInteger(n) || n === 0) {
      toast.push("error", "금액은 0이 아닌 정수여야 합니다 (음수=차감)");
      return;
    }
    if (!creditReason.trim()) {
      toast.push("error", "사유는 필수입니다 (감사 로그)");
      return;
    }
    setCrediting(true);
    try {
      const r = await adminCreditWallet(creditFor.userId, n, creditReason.trim());
      const verb = n > 0 ? "충전" : "차감";
      const sign = n > 0 ? "+" : "−";
      toast.push(
        "success",
        `${creditFor.name} ${verb} — ${sign}${fmt.point(Math.abs(n))} P (잔액 ${fmt.point(Number(r.newBalance))} P)`,
      );
      setCreditFor(null);
      await membersQ.refetch();
    } catch (e) {
      toast.push("error", (e as Error).message);
    } finally {
      setCrediting(false);
    }
  };
  const doApproveRequest = async () => {
    if (!creditFor || !chargeReq) return;
    setCrediting(true);
    try {
      const r = await approveChargeRequest(chargeReq.id);
      toast.push(
        "success",
        `${creditFor.name} 승인 — +${fmt.point(Number(r.amount))} P (잔액 ${fmt.point(Number(r.newBalance))} P)`,
      );
      setCreditFor(null);
      setChargeReq(null);
      clearParam();
      await membersQ.refetch();
    } catch (e) {
      toast.push("error", (e as Error).message);
    } finally {
      setCrediting(false);
    }
  };
  const doRejectRequest = async () => {
    if (!creditFor || !chargeReq) return;
    const note = prompt("반려 사유(선택)") ?? undefined;
    setCrediting(true);
    try {
      await rejectChargeRequest(chargeReq.id, note);
      toast.push("success", `${creditFor.name} 충전 요청 반려`);
      setCreditFor(null);
      setChargeReq(null);
      clearParam();
    } catch (e) {
      toast.push("error", (e as Error).message);
    } finally {
      setCrediting(false);
    }
  };

  // 알림 deep-link: /admin/members?chargeRequest=N → 자동으로 요청 모달 오픈.
  const [searchParams, setSearchParams] = useSearchParams();
  const clearParam = () => {
    const next = new URLSearchParams(searchParams);
    next.delete("chargeRequest");
    setSearchParams(next, { replace: true });
  };
  useEffect(() => {
    const idStr = searchParams.get("chargeRequest");
    if (!idStr || !data) return;
    const id = Number(idStr);
    if (!Number.isFinite(id)) return;
    (async () => {
      try {
        const req = await getAdminChargeRequest(id);
        const member = data.members.find((m) => m.userId === req.userId);
        if (!member) {
          toast.push("error", `요청자(#${req.userId})를 회원 목록에서 찾을 수 없습니다`);
          clearParam();
          return;
        }
        if (req.status !== "PENDING") {
          toast.push(
            "error",
            `이 요청은 이미 ${req.status === "APPROVED" ? "승인" : "반려"}되었습니다`,
          );
          clearParam();
          return;
        }
        openCreditFromRequest(member, req);
      } catch (e) {
        toast.push("error", (e as Error).message);
        clearParam();
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams, data]);

  const doSync = async () => {
    setSyncing(true);
    try {
      const r = await syncMembers();
      setLastSync(new Date(r.at).toLocaleString("ko-KR"));
      toast.push(
        "success",
        `동기화 완료 — 총 ${r.total}명 (신규 ${r.created} · 갱신 ${r.updated})` +
          (r.errors.length ? ` · 오류 ${r.errors.length}` : ""),
      );
      await membersQ.refetch();
    } catch (e) {
      toast.push("error", (e as Error).message);
    } finally {
      setSyncing(false);
    }
  };

  const openCreate = () => setForm({ ...EMPTY_FORM });
  const openEdit = (m: MemberRow) =>
    setForm({
      userId: m.userId,
      email: m.email ?? "",
      name: m.name,
      team: m.team ?? "",
      jobRank: m.jobRank ?? "",
      jobTitle: m.jobTitle ?? "",
      // EZPASS 행은 수정 진입이 막혀 있으므로 여기엔 EXAM/ADMIN만 들어온다.
      role: m.role === "ADMIN" ? "ADMIN" : "EXAM",
      active: m.active,
      password: "",
    });

  const doSave = async () => {
    if (!form) return;
    const isNew = form.userId === null;
    if (isNew && (!form.email || !form.name || !form.password)) {
      toast.push("error", "이메일·이름·비밀번호는 필수입니다");
      return;
    }
    setSaving(true);
    try {
      if (isNew) {
        await createMember({
          email: form.email,
          name: form.name,
          password: form.password,
          role: form.role,
          team: form.team || null,
          jobRank: form.jobRank || null,
          jobTitle: form.jobTitle || null,
        });
        toast.push("success", `회원 추가 — ${form.name}`);
      } else {
        await updateMember(form.userId!, {
          name: form.name,
          role: form.role,
          team: form.team || null,
          jobRank: form.jobRank || null,
          jobTitle: form.jobTitle || null,
          active: form.active,
          password: form.password || undefined,
        });
        toast.push("success", `회원 수정 — ${form.name}`);
      }
      setForm(null);
      await membersQ.refetch();
    } catch (e) {
      toast.push("error", (e as Error).message);
    } finally {
      setSaving(false);
    }
  };

  const toggleActive = async (m: MemberRow) => {
    try {
      await updateMember(m.userId, { active: !m.active });
      toast.push("success", `${m.name} ${m.active ? "비활성화" : "활성화"}`);
      await membersQ.refetch();
    } catch (e) {
      toast.push("error", (e as Error).message);
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
          <AdminTabs p={p} active="members" />

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
                <Icon.shield size={14} /> 회원관리 · {isLocal ? "자립형 (자체 관리)" : "위임형 (ezpass 미러)"}
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
                회원 ({data?.total ?? "—"})
              </div>
              <div style={{ fontSize: 12, color: p.inkMuted, marginTop: 6 }}>
                {isLocal ? "신원 정본은 이 시스템" : "신원 정본은 ezpass"} · 관리자{" "}
                {data?.admins ?? "—"}명
                {lastSync ? ` · 마지막 동기화 ${lastSync}` : ""}
              </div>
            </div>
            <div style={{ display: "flex", gap: 8 }}>
              <Btn p={p} variant="ghost" size="md" onClick={() => membersQ.refetch()}>
                새로고침
              </Btn>
              {!isLocal && (
                <Btn p={p} variant="ghost" size="md" disabled={syncing} onClick={doSync}>
                  <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
                    <Icon.bolt size={14} />
                    {syncing ? "동기화 중…" : "지금 동기화"}
                  </span>
                </Btn>
              )}
              {/* EXAM(비연동) 계정은 어느 배포에서나 직접 추가 가능. EZPASS는 동기화로만. */}
              <Btn p={p} variant="dark" size="md" onClick={openCreate}>
                <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
                  <Icon.bolt size={14} /> 회원 추가 (exam)
                </span>
              </Btn>
            </div>
          </div>

          <div
            style={{
              padding: 12,
              background: isLocal ? "#EEF2F7" : "#FFF4E0",
              borderRadius: 10,
              fontSize: 12,
              color: isLocal ? p.inkSoft : p.warn,
              lineHeight: 1.5,
              marginBottom: 16,
            }}
          >
            {isLocal ? (
              <>
                <strong>자립형 모드</strong>{" "}
                <span style={{ color: p.inkSoft, fontWeight: 500 }}>
                  외부 그룹웨어 없이 이 시스템이 회원·인증을 직접 관리합니다. 회원 추가 시
                  비밀번호로 로그인됩니다. 연차·경매금도 우리 시스템 소유입니다.
                </span>
              </>
            ) : (
              <>
                <strong>⚠ 읽기 전용 (위임형)</strong>{" "}
                <span style={{ color: p.inkSoft, fontWeight: 500 }}>
                  회원 추가·수정은 ezpass(그룹웨어)에서 합니다. 여기서는 미러된 명단을 보고
                  「지금 동기화」로 최신 상태를 당겨옵니다. 연차·경매금은 우리 시스템이 소유합니다.
                </span>
              </>
            )}
          </div>

          {/* ezpass 연차 정합 점검 — drift 있을 때만 페이지 상단에 노란 배너로 노출(평소엔 작은 점검 버튼) */}
          <div style={{ marginBottom: 16 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: syncReport ? 8 : 0 }}>
              <div style={{ fontSize: 11, color: p.inkMuted }}>
                평소엔 낙찰 자동 sync. 이슈로 어긋날 때만 점검·동기.
              </div>
              <Btn p={p} variant="ghost" size="sm" disabled={syncChecking} onClick={runLeaveSyncCheck}>
                {syncChecking ? "점검 중…" : "ezpass 연차 동기 점검"}
              </Btn>
            </div>
            {syncReport && syncReport.driftCount > 0 && (
              <div style={{ padding: 12, background: "#FFF4E0", border: `1px solid #F3CD7F`, borderRadius: 10, fontSize: 12 }}>
                <div style={{ fontWeight: 700, color: p.warn, marginBottom: 8 }}>
                  ⚠ ezpass와 어긋난 사용자 {syncReport.driftCount}명 ({syncReport.year}년 기준)
                </div>
                {syncReport.rows.filter((r) => !r.inSync).map((r: LeaveSyncRow) => (
                  <div key={r.userId} style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1.2fr 120px", gap: 8, alignItems: "center", padding: "6px 0", borderTop: `1px solid #F3CD7F` }}>
                    <div style={{ color: p.ink, fontWeight: 600 }}>{r.name} <span style={{ color: p.inkMuted, fontWeight: 400 }}>· {r.email}</span></div>
                    <div className="mono" style={{ color: p.inkSoft }}>우리 {r.ourAuctionDays}일 ↔ ezpass {r.ezpassMdat ?? "?"}일</div>
                    <div style={{ color: p.inkMuted, fontSize: 11 }}>{r.error ?? "—"}</div>
                    <div style={{ textAlign: "right" }}>
                      <Btn
                        p={p}
                        variant="primary"
                        size="sm"
                        disabled={reconciling === r.userId || !!r.error}
                        onClick={() => doReconcile(r.userId)}
                      >
                        {reconciling === r.userId ? "동기 중…" : "ezpass에 동기"}
                      </Btn>
                    </div>
                  </div>
                ))}
              </div>
            )}
            {syncReport && syncReport.driftCount === 0 && (
              <div style={{ padding: 8, fontSize: 11, color: p.success, marginTop: 8 }}>
                ✓ 정합 OK · {new Date(syncReport.checkedAt).toLocaleString("ko-KR", { hour: "2-digit", minute: "2-digit", second: "2-digit" })}
              </div>
            )}
          </div>

          <DataGrid<MemberRow>
            p={p}
            rows={data?.members ?? []}
            rowKey={(m) => m.userId}
            loading={membersQ.loading}
            error={membersQ.error}
            emptyText={
              isLocal
                ? "회원이 없습니다. 「회원 추가」로 등록하세요."
                : "미러된 회원이 없습니다. 「지금 동기화」를 눌러 ezpass에서 가져오세요."
            }
            rowStyle={(m) => ({ opacity: m.active ? 1 : 0.5 })}
            maxHeight={560}
            columns={[
              {
                key: "empId",
                header: "사번",
                width: w[0],
                render: (m) => (
                  <span className="mono" style={{ color: p.inkMuted, fontWeight: 600 }}>
                    {m.empId}
                  </span>
                ),
              },
              {
                key: "name",
                header: "이름",
                width: w[1],
                render: (m) => (
                  <span style={{ color: p.ink, fontWeight: 700, display: "inline-flex", alignItems: "center", gap: 6 }}>
                    {m.name}
                    {!m.active && (
                      <Pill p={p} size="sm" tone="neutral" style={{ fontSize: 9 }}>
                        비활성
                      </Pill>
                    )}
                  </span>
                ),
              },
              {
                key: "email",
                header: "이메일",
                width: w[2],
                render: (m) => (
                  <span className="mono" style={{ color: p.inkSoft, fontSize: 11 }}>
                    {m.email ?? "—"}
                  </span>
                ),
              },
              {
                key: "team",
                header: "부서",
                width: w[3],
                render: (m) => <span style={{ color: p.inkSoft }}>{m.team ?? "—"}</span>,
              },
              {
                key: "rank",
                header: "직급 / 직책",
                width: w[4],
                render: (m) => (
                  <span style={{ color: p.inkSoft }}>
                    {[m.jobRank, m.jobTitle].filter(Boolean).join(" / ") || "—"}
                  </span>
                ),
              },
              {
                key: "role",
                header: "권한",
                width: w[5],
                render: (m) => (
                  <Pill
                    p={p}
                    size="sm"
                    tone={m.role === "ADMIN" ? "accent" : m.role === "EXAM" ? "warn" : "neutral"}
                    style={{ fontSize: 10, fontWeight: 700 }}
                  >
                    {roleLabel(m.role)}
                  </Pill>
                ),
              },
              {
                key: "balance",
                header: "포인트",
                width: w[6],
                align: "right",
                render: (m) => (
                  <span className="mono" style={{ color: p.ink, fontWeight: 700, fontSize: 12 }}>
                    {fmt.point(Number(m.balance))} P
                  </span>
                ),
              },
              {
                key: "actions",
                header: "작업",
                width: w[7],
                align: "right",
                render: (m) => (
                  <span style={{ display: "inline-flex", gap: 6, justifyContent: "flex-end" }}>
                    <Btn p={p} variant="ghost" size="sm" onClick={() => openCredit(m)}>
                      관리
                    </Btn>
                    {/* EXAM/ADMIN(로컬)만 수정·비활성. EZPASS는 ezpass 동기화 전용(읽기). */}
                    {m.role !== "EZPASS" && (
                      <>
                        <Btn p={p} variant="ghost" size="sm" onClick={() => openEdit(m)}>
                          수정
                        </Btn>
                        <Btn p={p} variant="ghost" size="sm" onClick={() => toggleActive(m)}>
                          {m.active ? "비활성" : "활성"}
                        </Btn>
                      </>
                    )}
                  </span>
                ),
              },
            ]}
            footer={
              <span>
                총 {data?.total ?? 0}명 · 출처 {isLocal ? "자체 관리" : "ezpass 미러"}
              </span>
            }
          />
        </div>
      </div>

      {creditFor && (
        <div
          onClick={() => {
            if (crediting) return;
            setCreditFor(null);
            setChargeReq(null);
            if (chargeReq) clearParam();
          }}
          style={{
            position: "fixed", inset: 0, background: "rgba(11,25,41,0.45)",
            display: "flex", alignItems: "center", justifyContent: "center", zIndex: 200,
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{ width: 440, background: p.surface, borderRadius: 16, padding: 24, boxShadow: "0 20px 60px rgba(11,25,41,0.25)" }}
          >
            <div style={{ fontSize: 18, fontWeight: 800, color: p.ink, marginBottom: 4 }}>
              {chargeReq ? `충전 요청 #${chargeReq.id} 처리` : "포인트 관리"}
            </div>
            <div style={{ fontSize: 12, color: p.inkMuted, marginBottom: 4 }}>
              <b>{creditFor.name}</b> · 사번 {creditFor.empId}
              {chargeReq && (
                <span style={{ marginLeft: 8, color: p.inkSoft }}>
                  · 요청일 {new Date(chargeReq.createdAt).toLocaleString("ko-KR")}
                </span>
              )}
            </div>
            <div className="mono" style={{ fontSize: 12, color: p.inkSoft, marginBottom: 16 }}>
              현재 잔액 {fmt.point(Number(creditFor.balance))} P
            </div>

            <Field label={chargeReq ? "요청 금액 (P)" : "금액 (P · 음수=차감)"}>
              <input
                style={{ ...inp(p), background: chargeReq ? p.bgDeep : p.bg }}
                type="number" step={100}
                value={creditAmount}
                onChange={(e) => setCreditAmount(e.target.value)}
                placeholder="예: 10000 또는 -5000"
                readOnly={!!chargeReq}
              />
            </Field>
            <Field label={chargeReq ? "사용자 사유" : "사유 (감사 로그 — 필수)"}>
              <input
                style={{ ...inp(p), background: chargeReq ? p.bgDeep : p.bg }}
                value={creditReason}
                onChange={(e) => setCreditReason(e.target.value)}
                placeholder={chargeReq ? "(사유 없음)" : "예: 입사 환영 보너스"}
                readOnly={!!chargeReq}
              />
            </Field>

            <div style={{ display: "flex", justifyContent: chargeReq ? "space-between" : "flex-end", gap: 8, marginTop: 14 }}>
              {chargeReq ? (
                <>
                  <Btn p={p} variant="danger" size="md" disabled={crediting} onClick={doRejectRequest}>
                    {crediting ? "처리 중…" : "반려"}
                  </Btn>
                  <div style={{ display: "flex", gap: 8 }}>
                    <Btn p={p} variant="ghost" size="md" disabled={crediting} onClick={() => { setCreditFor(null); setChargeReq(null); clearParam(); }}>닫기</Btn>
                    <Btn p={p} variant="primary" size="md" disabled={crediting} onClick={doApproveRequest}>
                      {crediting ? "처리 중…" : "승인 (충전)"}
                    </Btn>
                  </div>
                </>
              ) : (
                <>
                  <Btn p={p} variant="ghost" size="md" disabled={crediting} onClick={() => setCreditFor(null)}>취소</Btn>
                  <Btn p={p} variant="primary" size="md" disabled={crediting} onClick={doCredit}>
                    {crediting ? "처리 중…" : Number(creditAmount) < 0 ? "차감" : "충전"}
                  </Btn>
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {form && (
        <div
          onClick={() => !saving && setForm(null)}
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
              width: 460,
              background: p.surface,
              borderRadius: 16,
              padding: 24,
              boxShadow: "0 20px 60px rgba(11,25,41,0.25)",
              maxHeight: "86vh",
              overflow: "auto",
            }}
          >
            <div style={{ fontSize: 18, fontWeight: 800, color: p.ink, marginBottom: 18 }}>
              {form.userId === null ? "회원 추가" : "회원 수정"}
            </div>

            <Field label="이메일 (로그인 ID)">
              <input
                style={inp(p)}
                type="email"
                value={form.email}
                disabled={form.userId !== null}
                placeholder="user@company.com"
                onChange={(e) => setForm({ ...form, email: e.target.value })}
              />
            </Field>
            <Field label="이름">
              <input style={inp(p)} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
            </Field>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
              <Field label="부서">
                <input style={inp(p)} value={form.team} onChange={(e) => setForm({ ...form, team: e.target.value })} />
              </Field>
              <Field label="권한">
                <select
                  style={inp(p)}
                  value={form.role}
                  onChange={(e) => setForm({ ...form, role: e.target.value as "EXAM" | "ADMIN" })}
                >
                  <option value="EXAM">exam (비연동)</option>
                  <option value="ADMIN">관리자</option>
                </select>
              </Field>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
              <Field label="직급">
                <input style={inp(p)} value={form.jobRank} onChange={(e) => setForm({ ...form, jobRank: e.target.value })} />
              </Field>
              <Field label="직책">
                <input style={inp(p)} value={form.jobTitle} onChange={(e) => setForm({ ...form, jobTitle: e.target.value })} />
              </Field>
            </div>
            <Field label={form.userId === null ? "비밀번호" : "새 비밀번호 (변경 시에만)"}>
              <input
                style={inp(p)}
                type="password"
                value={form.password}
                placeholder={form.userId === null ? "" : "비워두면 유지"}
                onChange={(e) => setForm({ ...form, password: e.target.value })}
              />
            </Field>
            {form.userId !== null && (
              <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, color: p.ink, margin: "4px 0 8px" }}>
                <input
                  type="checkbox"
                  checked={form.active}
                  onChange={(e) => setForm({ ...form, active: e.target.checked })}
                />
                활성 (체크 해제 시 로그인 차단)
              </label>
            )}

            <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 14 }}>
              <Btn p={p} variant="ghost" size="md" disabled={saving} onClick={() => setForm(null)}>
                취소
              </Btn>
              <Btn p={p} variant="primary" size="md" disabled={saving} onClick={doSave}>
                {saving ? "저장 중…" : "저장"}
              </Btn>
            </div>
          </div>
        </div>
      )}
    </ScreenFrame>
  );
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  const p = PALETTES.cobalt;
  return (
    <div style={{ marginBottom: 12 }}>
      <div style={{ fontSize: 12, fontWeight: 700, color: p.inkSoft, marginBottom: 6 }}>{label}</div>
      {children}
    </div>
  );
}

function inp(p: Palette): CSSProperties {
  return {
    width: "100%",
    padding: "9px 12px",
    borderRadius: 9,
    border: `1px solid ${p.line}`,
    fontSize: 13,
    color: p.ink,
    background: p.bg,
    boxSizing: "border-box",
  };
}
