import { useEffect, useState, type CSSProperties, type ReactNode } from "react";
import { useSearchParams } from "react-router-dom";
import { PALETTES, FONT, fmt, type Palette } from "@/lib/tokens";
import { Btn, Pill, TopNav } from "@/components/atoms";
import { Icon } from "@/components/icons";
import { ScreenFrame } from "@/components/ScreenFrame";
import { AdminTabs } from "@/components/AdminTabs";
import { DataGrid, type GridColumn } from "@/components/DataGrid";
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
  type ChargeRequestRow,
  type MemberRow,
} from "@/lib/queries";
import { roleLabel, canManageEzpass, canManageExam } from "@/lib/roles";
import { useCurrentUser } from "@/lib/current-user";

// ezpass 회원관리 화면(새 탭 유도). 실제 URL은 env로 덮어쓸 수 있음.
const EZPASS_ADMIN_URL =
  (import.meta.env.VITE_EZPASS_ADMIN_URL as string | undefined) ??
  "https://dev.performax.timesoft.internal/adm/umn/admumn0010m";

type FormState = {
  userId: string | null; // null = 신규
  email: string;
  name: string;
  team: string;
  jobRank: string;
  jobTitle: string;
  // 로컬 폼은 exam 영역 계정만(EXAM/EXAM_ADMIN) — EZPASS는 ezpass 동기화로만 관리.
  role: "EXAM" | "EXAM_ADMIN";
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

  // 관리자 영역 분리: 로그인한 관리자의 권한으로 EZPASS/EXAM 탭 노출·기본값 결정.
  const { user } = useCurrentUser();
  const mayEzpass = canManageEzpass(user.role);
  const mayExam = canManageExam(user.role);
  const [tab, setTab] = useState<"EZPASS" | "EXAM">(mayEzpass ? "EZPASS" : "EXAM");
  const onEzpassTab = tab === "EZPASS";
  // 선택 탭으로 회원 필터(ADMIN 최고관리자는 EXAM 탭에 함께 표시).
  const shownMembers = (data?.members ?? []).filter((m) =>
    onEzpassTab
      ? m.role === "EZPASS" || m.role === "EZPASS_ADMIN"
      : m.role === "EXAM" || m.role === "EXAM_ADMIN" || m.role === "ADMIN",
  );

  // 컬럼 폭(사번/이름/이메일/부서/직급·직책/권한/포인트(+관리)/휴가/작업).
  // 포인트 컬럼이 "잔액 + 관리 버튼"을 같이 담아 넓어졌고, 작업은 수정/비활성만 남아 좁아졌다.
  // EZPASS 탭에선 작업 컬럼 자체를 제외하므로 w[8]은 EXAM 탭에서만 의미가 있다.
  const w = isLocal
    ? ["110px", "1fr", "200px", "1fr", "150px", "80px", "200px", "120px", "150px"]
    : ["120px", "1fr", "220px", "1.2fr", "160px", "90px", "200px", "120px", "150px"];

  // 충전 모달 상태.
  // free: 관리자 자유 충전. request: 알림에서 들어온 충전 요청(승인/반려).
  const [creditFor, setCreditFor] = useState<MemberRow | null>(null);
  const [creditAmount, setCreditAmount] = useState("");
  const [creditReason, setCreditReason] = useState("");
  const [crediting, setCrediting] = useState(false);
  const [chargeReq, setChargeReq] = useState<ChargeRequestRow | null>(null);

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
      // 수정은 exam 영역(EXAM/EXAM_ADMIN)만 진입한다.
      role: m.role === "EXAM_ADMIN" ? "EXAM_ADMIN" : "EXAM",
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
                <Icon.shield size={14} /> 회원관리
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
              {lastSync && (
                <div style={{ fontSize: 12, color: p.inkMuted, marginTop: 6 }}>
                  마지막 동기화 {lastSync}
                </div>
              )}
            </div>
            <div style={{ display: "flex", gap: 8 }}>
              <Btn p={p} variant="ghost" size="md" onClick={() => membersQ.refetch()}>
                새로고침
              </Btn>
              {/* EZPASS 탭: 동기화 + ezpass 화면으로 유도(읽기전용 영역). */}
              {onEzpassTab && (
                <>
                  {!isLocal && (
                    <Btn p={p} variant="ghost" size="md" disabled={syncing} onClick={doSync}>
                      <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
                        <Icon.bolt size={14} />
                        {syncing ? "동기화 중…" : "지금 동기화"}
                      </span>
                    </Btn>
                  )}
                  <Btn
                    p={p}
                    variant="dark"
                    size="md"
                    onClick={() => window.open(EZPASS_ADMIN_URL, "_blank", "noopener")}
                  >
                    <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
                      ezpass에서 관리 ↗
                    </span>
                  </Btn>
                </>
              )}
              {/* EXAM 탭: 비연동 계정은 로컬에서 직접 추가. */}
              {!onEzpassTab && mayExam && (
                <Btn p={p} variant="dark" size="md" onClick={openCreate}>
                  <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
                    <Icon.bolt size={14} /> 회원 추가 (exam)
                  </span>
                </Btn>
              )}
            </div>
          </div>

          {/* 두 영역을 모두 관리하는 최고관리자만 탭 전환 노출. */}
          {mayEzpass && mayExam && (
            <div style={{ display: "flex", gap: 6, marginBottom: 12 }}>
              {([
                { id: "EZPASS" as const, label: "ezpass 회원 (연동)" },
                { id: "EXAM" as const, label: "exam 회원 (독립)" },
              ]).map((t) => {
                const on = t.id === tab;
                return (
                  <div
                    key={t.id}
                    onClick={() => !on && setTab(t.id)}
                    style={{
                      padding: "8px 14px", borderRadius: 10, fontSize: 13, fontWeight: 700,
                      color: on ? p.surface : p.inkMuted, background: on ? p.ink : p.surface,
                      border: `1px solid ${on ? p.ink : p.line}`, cursor: on ? "default" : "pointer",
                    }}
                  >
                    {t.label}
                  </div>
                );
              })}
            </div>
          )}

          <DataGrid<MemberRow>
            p={p}
            rows={shownMembers}
            rowKey={(m) => m.userId}
            loading={membersQ.loading}
            error={membersQ.error}
            emptyText={
              onEzpassTab
                ? "ezpass 연동 회원이 없습니다. 「지금 동기화」 또는 「ezpass에서 관리」를 이용하세요."
                : "exam(독립) 회원이 없습니다. 「회원 추가」로 등록하세요."
            }
            rowStyle={(m) => ({ opacity: m.active ? 1 : 0.5 })}
            maxHeight={560}
            columns={memberColumns({
              w,
              p,
              onEzpassTab,
              openCredit,
              openEdit,
              toggleActive,
            })}
            footer={
              <span>
                {onEzpassTab ? "ezpass 연동" : "exam 독립"} {shownMembers.length}명 · 전체 {data?.total ?? 0}명
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
                  onChange={(e) => setForm({ ...form, role: e.target.value as "EXAM" | "EXAM_ADMIN" })}
                >
                  <option value="EXAM">exam (일반)</option>
                  <option value="EXAM_ADMIN">exam 관리자</option>
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

// 연차 시각화 — 파(REGULAR) + 노(AUCTION+EVENT) + 회(used). title에 상세.
function LeaveBar({ lv, p }: { lv: MemberRow["leave"]; p: Palette }) {
  const grand = lv.regular + lv.auction + lv.event + lv.used;
  if (grand === 0) return <span style={{ color: p.inkMuted, fontSize: 11 }}>—</span>;
  const pct = (n: number) => (n / grand) * 100;
  const noAucEvt = lv.auction + lv.event;
  return (
    <div title={`일반 ${lv.regular}일 · 경매/이벤트 ${noAucEvt}일 · 사용 ${lv.used}일 · 잔여 ${lv.total}일`}>
      <div
        style={{
          display: "flex",
          width: "100%",
          maxWidth: 100,
          height: 7,
          borderRadius: 4,
          overflow: "hidden",
          background: p.bg,
        }}
      >
        {lv.regular > 0 && <div style={{ width: `${pct(lv.regular)}%`, background: "#3b82f6" }} />}
        {noAucEvt > 0 && <div style={{ width: `${pct(noAucEvt)}%`, background: "#f59e0b" }} />}
        {lv.used > 0 && <div style={{ width: `${pct(lv.used)}%`, background: p.inkMuted }} />}
      </div>
      <div style={{ fontSize: 10, color: p.inkMuted, marginTop: 2, fontWeight: 600 }}>
        잔여 <span style={{ color: p.ink, fontWeight: 800 }}>{lv.total}</span>일
      </div>
    </div>
  );
}

// 회원 표 컬럼 정의 — 모든 컬럼을 좌측 정렬로 통일하고, Pill/Btn 같은 inline 박스의
// 자체 padding(Pill sm 0/8, Btn sm 0/14)을 negative margin으로 상쇄해
// "박스 내부 텍스트"가 헤더 텍스트와 같은 x좌표에서 시작하게 한다.
// EZPASS 탭에선 작업 컬럼(수정/비활성)을 통째로 제외 — EZPASS·ADMIN은 어차피 작업 권한이 없어 빈 칸만 남기 때문.
function memberColumns({
  w,
  p,
  onEzpassTab,
  openCredit,
  openEdit,
  toggleActive,
}: {
  w: string[];
  p: Palette;
  onEzpassTab: boolean;
  openCredit: (m: MemberRow) => void;
  openEdit: (m: MemberRow) => void;
  toggleActive: (m: MemberRow) => void;
}): GridColumn<MemberRow>[] {
  const cols: GridColumn<MemberRow>[] = [
    {
      key: "empId",
      header: "사번",
      width: w[0],
      align: "left",
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
      align: "left",
      render: (m) => (
        <span style={{ color: p.ink, fontWeight: 700, display: "inline-flex", alignItems: "center", gap: 6 }}>
          {m.name}
          {!m.active && (
            // 비활성 Pill은 좌측 마진 -8로 자체 padding 상쇄(인접 텍스트 기준 정렬).
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
      align: "left",
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
      align: "left",
      render: (m) => <span style={{ color: p.inkSoft }}>{m.team ?? "—"}</span>,
    },
    {
      key: "rank",
      header: "직급 / 직책",
      width: w[4],
      align: "left",
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
      align: "left",
      render: (m) => (
        // marginLeft -8: Pill 자체 padding(0 8) 상쇄 → 박스 안 텍스트가 컬럼 좌측 0에서 시작.
        <Pill
          p={p}
          size="sm"
          tone={m.role === "ADMIN" ? "accent" : m.role === "EXAM" ? "warn" : "neutral"}
          style={{ fontSize: 10, fontWeight: 700, marginLeft: -8 }}
        >
          {roleLabel(m.role)}
        </Pill>
      ),
    },
    {
      key: "balance",
      header: "포인트",
      width: w[6],
      align: "left",
      render: (m) => (
        <span style={{ display: "inline-flex", alignItems: "center", gap: 10 }}>
          <span className="mono" style={{ color: p.ink, fontWeight: 700, fontSize: 12 }}>
            {fmt.point(Number(m.balance))} P
          </span>
          <Btn p={p} variant="ghost" size="sm" onClick={() => openCredit(m)}>
            관리
          </Btn>
        </span>
      ),
    },
    {
      key: "leave",
      header: "휴가",
      width: w[7],
      align: "left",
      render: (m) => <LeaveBar lv={m.leave} p={p} />,
    },
  ];

  if (!onEzpassTab) {
    cols.push({
      key: "actions",
      header: "작업",
      width: w[8],
      align: "left",
      render: (m) => {
        // EXAM 영역(EXAM/EXAM_ADMIN)만 수정·비활성. 그 외(ADMIN 등)는 작업 권한 없음 → 빈 셀.
        if (m.role !== "EXAM" && m.role !== "EXAM_ADMIN") {
          return <span style={{ color: p.inkMuted, fontSize: 11 }}>—</span>;
        }
        return (
          // 첫 Btn의 marginLeft -14로 자체 padding 상쇄 → 버튼 라벨이 컬럼 좌측 0에서 시작.
          <span style={{ display: "inline-flex", gap: 6, marginLeft: -14 }}>
            <Btn p={p} variant="ghost" size="sm" onClick={() => openEdit(m)}>
              수정
            </Btn>
            <Btn p={p} variant="ghost" size="sm" onClick={() => toggleActive(m)}>
              {m.active ? "비활성" : "활성"}
            </Btn>
          </span>
        );
      },
    });
  }

  return cols;
}
