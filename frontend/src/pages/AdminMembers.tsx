import { useState, type CSSProperties, type ReactNode } from "react";
import { PALETTES, FONT, fmt, type Palette } from "@/lib/tokens";
import { Btn, Card, Pill, TopNav } from "@/components/atoms";
import { Icon } from "@/components/icons";
import { ScreenFrame } from "@/components/ScreenFrame";
import { AdminTabs } from "@/components/AdminTabs";
import { useQuery } from "@/lib/use-query";
import { useToast } from "@/lib/toast";
import {
  adminCreditWallet,
  listMembers,
  syncMembers,
  createMember,
  updateMember,
  type MemberRow,
} from "@/lib/queries";

type FormState = {
  userId: string | null; // null = 신규
  email: string;
  name: string;
  team: string;
  jobRank: string;
  jobTitle: string;
  role: "EMPLOYEE" | "ADMIN";
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
  role: "EMPLOYEE",
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
  // 마지막에 "포인트" + "작업" 컬럼 추가. 위임형은 작업이 충전 한 개라 80px.
  const cols = isLocal
    ? "110px 1fr 200px 1fr 150px 80px 110px 220px"
    : "120px 1fr 220px 1.2fr 160px 90px 110px 80px";

  // 충전 모달 상태.
  const [creditFor, setCreditFor] = useState<MemberRow | null>(null);
  const [creditAmount, setCreditAmount] = useState("");
  const [creditReason, setCreditReason] = useState("");
  const [crediting, setCrediting] = useState(false);

  const openCredit = (m: MemberRow) => {
    setCreditFor(m);
    setCreditAmount("");
    setCreditReason("");
  };
  const doCredit = async () => {
    if (!creditFor) return;
    const n = Number(creditAmount);
    if (!Number.isFinite(n) || n <= 0) {
      toast.push("error", "금액은 양수여야 합니다");
      return;
    }
    if (!creditReason.trim()) {
      toast.push("error", "사유는 필수입니다 (감사 로그)");
      return;
    }
    setCrediting(true);
    try {
      const r = await adminCreditWallet(creditFor.userId, n, creditReason.trim());
      toast.push(
        "success",
        `${creditFor.name} 충전 — +${fmt.point(n)} P (잔액 ${fmt.point(Number(r.newBalance))} P)`,
      );
      setCreditFor(null);
      await membersQ.refetch();
    } catch (e) {
      toast.push("error", (e as Error).message);
    } finally {
      setCrediting(false);
    }
  };

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
      role: m.role,
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
              {isLocal ? (
                <Btn p={p} variant="dark" size="md" onClick={openCreate}>
                  <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
                    <Icon.bolt size={14} /> 회원 추가
                  </span>
                </Btn>
              ) : (
                <Btn p={p} variant="dark" size="md" disabled={syncing} onClick={doSync}>
                  <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
                    <Icon.bolt size={14} />
                    {syncing ? "동기화 중…" : "지금 동기화"}
                  </span>
                </Btn>
              )}
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

          <Card p={p} padding={0} style={{ display: "flex", flexDirection: "column", minHeight: 0 }}>
            <div
              style={{
                display: "grid",
                gridTemplateColumns: cols,
                padding: "12px 20px",
                fontSize: 11,
                color: p.inkMuted,
                fontWeight: 700,
                letterSpacing: 0.4,
                borderBottom: `1px solid ${p.line}`,
                background: p.bg,
              }}
            >
              <div>사번</div>
              <div>이름</div>
              <div>이메일</div>
              <div>부서</div>
              <div>직급 / 직책</div>
              <div style={{ textAlign: "left" }}>권한</div>
              <div style={{ textAlign: "right" }}>포인트</div>
              <div style={{ textAlign: "right" }}>작업</div>
            </div>
            <div style={{ overflow: "auto", maxHeight: 560 }}>
              {membersQ.error && (
                <div style={{ padding: 24, color: p.danger, fontSize: 13, fontWeight: 700 }}>
                  {membersQ.error.message}
                </div>
              )}
              {!membersQ.error && data?.members.length === 0 && !membersQ.loading && (
                <div style={{ padding: 24, color: p.inkMuted, fontSize: 13, textAlign: "center" }}>
                  {isLocal
                    ? "회원이 없습니다. 「회원 추가」로 등록하세요."
                    : "미러된 회원이 없습니다. 「지금 동기화」를 눌러 ezpass에서 가져오세요."}
                </div>
              )}
              {data?.members.map((m, i) => {
                const zebra = i % 2 === 1;
                const isAdmin = m.role === "ADMIN";
                const rankTitle = [m.jobRank, m.jobTitle].filter(Boolean).join(" / ") || "—";
                return (
                  <div
                    key={m.userId}
                    style={{
                      display: "grid",
                      gridTemplateColumns: cols,
                      padding: "13px 20px",
                      fontSize: 12,
                      alignItems: "center",
                      background: zebra ? p.bg : p.surface,
                      borderBottom: `1px solid ${p.line}`,
                      opacity: m.active ? 1 : 0.5,
                    }}
                  >
                    <div className="mono" style={{ color: p.inkMuted, fontWeight: 600 }}>
                      {m.empId}
                    </div>
                    <div style={{ color: p.ink, fontWeight: 700, display: "flex", alignItems: "center", gap: 6 }}>
                      {m.name}
                      {!m.active && (
                        <Pill p={p} size="sm" tone="neutral" style={{ fontSize: 9 }}>
                          비활성
                        </Pill>
                      )}
                    </div>
                    <div className="mono" style={{ color: p.inkSoft, fontSize: 11 }}>
                      {m.email ?? "—"}
                    </div>
                    <div style={{ color: p.inkSoft }}>{m.team ?? "—"}</div>
                    <div style={{ color: p.inkSoft }}>{rankTitle}</div>
                    <div style={{ textAlign: "left" }}>
                      <Pill
                        p={p}
                        size="sm"
                        tone={isAdmin ? "accent" : "neutral"}
                        style={{ fontSize: 10, fontWeight: 700 }}
                      >
                        {isAdmin ? "관리자" : "직원"}
                      </Pill>
                    </div>
                    <div
                      className="mono"
                      style={{ textAlign: "right", color: p.ink, fontWeight: 700, fontSize: 12 }}
                    >
                      {fmt.point(Number(m.balance))} P
                    </div>
                    <div style={{ display: "flex", gap: 6, justifyContent: "flex-end" }}>
                      <Btn p={p} variant="ghost" size="sm" onClick={() => openCredit(m)}>
                        충전
                      </Btn>
                      {isLocal && (
                        <>
                          <Btn p={p} variant="ghost" size="sm" onClick={() => openEdit(m)}>
                            수정
                          </Btn>
                          <Btn p={p} variant="ghost" size="sm" onClick={() => toggleActive(m)}>
                            {m.active ? "비활성" : "활성"}
                          </Btn>
                        </>
                      )}
                    </div>
                  </div>
                );
              })}
              {membersQ.loading && (
                <div style={{ padding: 16, textAlign: "center", color: p.inkMuted, fontSize: 12 }}>
                  불러오는 중…
                </div>
              )}
            </div>
            <div
              style={{
                padding: "12px 20px",
                borderTop: `1px solid ${p.line}`,
                background: p.bg,
                fontSize: 11,
                color: p.inkMuted,
              }}
            >
              총 {data?.total ?? 0}명 · 출처 {isLocal ? "자체 관리" : "ezpass 미러"}
            </div>
          </Card>
        </div>
      </div>

      {creditFor && (
        <div
          onClick={() => !crediting && setCreditFor(null)}
          style={{
            position: "fixed", inset: 0, background: "rgba(11,25,41,0.45)",
            display: "flex", alignItems: "center", justifyContent: "center", zIndex: 200,
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{ width: 440, background: p.surface, borderRadius: 16, padding: 24, boxShadow: "0 20px 60px rgba(11,25,41,0.25)" }}
          >
            <div style={{ fontSize: 18, fontWeight: 800, color: p.ink, marginBottom: 4 }}>포인트 충전</div>
            <div style={{ fontSize: 12, color: p.inkMuted, marginBottom: 4 }}>
              <b>{creditFor.name}</b> · 사번 {creditFor.empId}
            </div>
            <div className="mono" style={{ fontSize: 12, color: p.inkSoft, marginBottom: 16 }}>
              현재 잔액 {fmt.point(Number(creditFor.balance))} P
            </div>

            <Field label="충전 금액 (P)">
              <input
                style={inp(p)}
                type="number" min={1} step={100}
                value={creditAmount}
                onChange={(e) => setCreditAmount(e.target.value)}
                placeholder="예: 10000"
              />
            </Field>
            <Field label="사유 (감사 로그 — 필수)">
              <input
                style={inp(p)}
                value={creditReason}
                onChange={(e) => setCreditReason(e.target.value)}
                placeholder="예: 입사 환영 보너스 / 충전 요청 승인"
              />
            </Field>

            <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 14 }}>
              <Btn p={p} variant="ghost" size="md" disabled={crediting} onClick={() => setCreditFor(null)}>취소</Btn>
              <Btn p={p} variant="primary" size="md" disabled={crediting} onClick={doCredit}>
                {crediting ? "충전 중…" : "충전"}
              </Btn>
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
                  onChange={(e) => setForm({ ...form, role: e.target.value as "EMPLOYEE" | "ADMIN" })}
                >
                  <option value="EMPLOYEE">직원</option>
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
