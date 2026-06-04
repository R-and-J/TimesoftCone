import { useState, type FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import { PALETTES, FONT } from "@/lib/tokens";
import { Brand, BrandGlyph, Btn } from "@/components/atoms";
import { Icon } from "@/components/icons";
import { login } from "@/lib/queries";
import { ApiError, setAuthToken } from "@/lib/api";
import { useAuth } from "@/lib/current-user";
import { useToast } from "@/lib/toast";

export default function LoginPage() {
  const [variant, setVariant] = useState<"impact" | "standard">("impact");
  const p = PALETTES.cobalt;
  return (
    <div style={{ minHeight: "100vh", position: "relative" }}>
      {/* Floating variant toggle — design-canvas only. Real production would
          ship one of the two variants. Positioned absolute so the page below
          can still be full-bleed. */}
      <div
        style={{
          position: "absolute",
          top: 20,
          left: "50%",
          transform: "translateX(-50%)",
          zIndex: 20,
          display: "none",
          gap: 8,
          background: p.surface,
          padding: 4,
          borderRadius: 12,
          border: `1px solid ${p.line}`,
          boxShadow: "0 4px 12px rgba(11,25,41,0.06)",
        }}
      >
        {[
          { id: "impact" as const, label: "A · 브랜드 임팩트" },
          { id: "standard" as const, label: "B · 사내 표준" },
        ].map((t) => (
          <div
            key={t.id}
            onClick={() => setVariant(t.id)}
            style={{
              padding: "6px 12px",
              fontSize: 12,
              fontWeight: 600,
              background: variant === t.id ? p.ink : "transparent",
              color: variant === t.id ? "#fff" : p.inkMuted,
              borderRadius: 8,
              cursor: "pointer",
            }}
          >
            {t.label}
          </div>
        ))}
      </div>
      {variant === "impact" ? <LoginImpact /> : <LoginStandard />}
    </div>
  );
}

// 데모 빠른 로그인용 계정 목록(역할별 대표 1개). 데모 전용 평문 — 운영 배포 시 제거.
const DEMO_ACCOUNTS: { role: string; label: string; email: string; password: string }[] = [
  { role: "ADMIN", label: "최고관리자", email: "super@admin.local", password: "!12345qwertY" },
  { role: "EZPASS_ADMIN", label: "ezpass 관리자", email: "admin@timesoftcon.co.kr", password: "!12345qwertY" },
  { role: "EXAM_ADMIN", label: "exam 관리자", email: "examadmin@exam.com", password: "1234" },
  { role: "EZPASS", label: "ezpass 직원", email: "user001@timesoftcone.com", password: "1234" },
  { role: "EXAM", label: "exam 직원", email: "exam001@exam.com", password: "1234" },
];

function useLoginForm() {
  // 중앙 인증 위임(ADR-019): 이메일+비밀번호 → 사내 ezpass 검증.
  const [email, setEmail] = useState<string>("super@admin.local");
  // 데모 편의: 최고관리자 계정 프리필 → 바로 로그인 가능 (로컬 인증, ADR-022 합성).
  const [password, setPassword] = useState<string>("!12345qwertY");
  const [submitting, setSubmitting] = useState(false);
  const navigate = useNavigate();
  const { setUser } = useAuth();
  const toast = useToast();

  const doLogin = async (em: string, pw: string) => {
    setSubmitting(true);
    try {
      const r = await login(em, pw);
      // RBAC: 이후 요청 인증용 토큰을 먼저 저장(프로필 setUser 전에).
      setAuthToken(r.token);
      setUser({
        id: Number(r.userId),
        name: r.name,
        empId: r.empId,
        role: r.role,
        team: r.team,
        jobRank: r.jobRank,
        jobTitle: r.jobTitle,
        email: r.email,
        companyId: r.companyId,
        companyCode: r.companyCode,
      });
      toast.push("success", `${r.name}님으로 로그인했습니다`);
      navigate("/dashboard");
    } catch (err) {
      const msg = err instanceof ApiError ? err.message : (err as Error).message;
      toast.push("error", `로그인 실패: ${msg}`);
    } finally {
      setSubmitting(false);
    }
  };

  const submit = async (e?: FormEvent) => {
    e?.preventDefault();
    await doLogin(email, password);
  };

  // 데모 원클릭 로그인 — 해당 계정으로 즉시 인증.
  const quickLogin = (em: string, pw: string) => doLogin(em, pw);

  return { email, setEmail, password, setPassword, submit, submitting, quickLogin };
}

function LoginImpact() {
  const p = PALETTES.cobalt;
  const form = useLoginForm();
  return (
    <div
      style={{
        width: "100%",
        minHeight: "100vh",
        display: "flex",
        background: p.surface,
        fontFamily: FONT.sans,
        overflow: "hidden",
      }}
    >
      <div
        style={{
          flex: 1,
          background: p.bg,
          padding: "56px 64px",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          position: "relative",
          overflow: "hidden",
        }}
      >
        <Brand p={p} />
        <div aria-hidden style={{ position: "absolute", right: -120, top: 100, opacity: 0.6 }}>
          <svg width={620} height={620} viewBox="0 0 620 620" fill="none">
            <circle cx="240" cy="240" r="220" fill={p.bgDeep} />
            <circle cx="440" cy="380" r="140" fill={p.surface} />
            <circle cx="300" cy="460" r="100" fill={p.accentSoft} />
          </svg>
        </div>
        <div style={{ position: "relative", zIndex: 1, maxWidth: 580 }}>
          <div
            style={{
              fontSize: 13,
              fontWeight: 700,
              color: p.accent,
              letterSpacing: 1.2,
              padding: "7px 14px",
              background: p.surface,
              borderRadius: 999,
              display: "inline-block",
              marginBottom: 24,
            }}
          >
            B2E · ESCROW & DIVIDEND
          </div>
          <div
            style={{
              fontSize: 56,
              lineHeight: 1.1,
              fontWeight: 800,
              color: p.ink,
              letterSpacing: "-0.03em",
            }}
          >
            남는 연차와
            <br />
            <span style={{ color: p.accent }}>필요한 연차</span>를
            <br />
            잇는 사내 경매.
          </div>
          <div
            style={{
              marginTop: 28,
              fontSize: 17,
              lineHeight: 1.65,
              color: p.inkSoft,
              maxWidth: 480,
            }}
          >
            소멸될 뻔한 미사용 연차를 공용 풀에 기여하고,
            <br />
            복지 콘으로 입찰한 연차를 자유롭게 쓰세요.
            <br />
            연말엔 기여 지분만큼 복지카드로 배당받습니다.
          </div>
        </div>
        <div style={{ position: "relative", zIndex: 1, display: "flex", gap: 12 }}>
          {[
            { k: "재무 리스크", v: "0%", sub: "회사 예산 선투입 없음" },
            { k: "재무 정합성", v: "100%", sub: "Insert-Only 원장" },
            { k: "동시성 제어", v: "SQLite", sub: "write 락 (직렬화)" },
          ].map((s) => (
            <div
              key={s.k}
              style={{ flex: 1, background: p.surface, borderRadius: 18, padding: 18 }}
            >
              <div style={{ fontSize: 12, color: p.inkMuted, fontWeight: 500 }}>{s.k}</div>
              <div
                className="mono"
                style={{
                  fontSize: 28,
                  fontWeight: 800,
                  color: p.ink,
                  letterSpacing: "-0.025em",
                  marginTop: 2,
                }}
              >
                {s.v}
              </div>
              <div style={{ fontSize: 11, color: p.inkMuted, marginTop: 4 }}>{s.sub}</div>
            </div>
          ))}
        </div>
      </div>

      <form
        onSubmit={form.submit}
        style={{
          width: 520,
          padding: "80px 64px",
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          gap: 28,
        }}
      >
        <div>
          <div style={{ fontSize: 13, color: p.inkMuted, fontWeight: 500 }}>
            사내 그룹웨어로 로그인
          </div>
          <div
            style={{
              fontSize: 30,
              fontWeight: 800,
              color: p.ink,
              letterSpacing: "-0.025em",
              marginTop: 6,
            }}
          >
            연차 경매 시스템
          </div>
        </div>

        {/*
          [미래 SSO 진입점 — 현재 비활성(주석 보존)]
          의도: 지금 인증은 진짜 SSO 리다이렉트가 아니라, 우리 폼에서 이메일+비번을 받아
          사내 ezpass에 검증을 위임하는 '중앙 인증 위임' 방식이다(ADR-019, "SSO 아님").
          그래서 로그인은 아래 이메일+비번 폼 하나로 충분하고, 이 'SSO 진입' 버튼은
          동작도 없고 오해만 주므로 비활성화한다. 추후 실제 사내 SSO(OIDC 등)가 도입되면
          아래 블록('사내 통합 계정' 버튼 + '또는 사번으로' 구분선)을 되살려 리다이렉트
          진입점으로 사용한다.

          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            <Btn p={p} variant="dark" size="xl" full>
              <span style={{ display: "inline-flex", alignItems: "center", gap: 10 }}>
                <Icon.shield size={20} /> 사내 통합 계정으로 로그인
              </span>
            </Btn>
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: 12, color: p.inkMuted, fontSize: 12 }}>
            <div style={{ flex: 1, height: 1, background: p.line }} />
            또는 사번으로
            <div style={{ flex: 1, height: 1, background: p.line }} />
          </div>
        */}

        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          <div>
            <div style={{ fontSize: 12, color: p.inkMuted, marginBottom: 6, fontWeight: 600 }}>
              이메일
            </div>
            <input
              type="email"
              value={form.email}
              onChange={(e) => form.setEmail(e.target.value)}
              placeholder="you@timesoftcon.co.kr"
              autoComplete="username"
              style={{
                height: 52,
                padding: "0 16px",
                borderRadius: 12,
                border: `1.5px solid ${p.line}`,
                width: "100%",
                fontFamily: FONT.mono,
                fontSize: 16,
                color: p.ink,
                background: p.surface,
                outline: "none",
              }}
            />
          </div>
          <div>
            <div style={{ fontSize: 12, color: p.inkMuted, marginBottom: 6, fontWeight: 600 }}>
              비밀번호
            </div>
            <input
              type="password"
              value={form.password}
              onChange={(e) => form.setPassword(e.target.value)}
              placeholder="비밀번호"
              autoComplete="current-password"
              onKeyDown={(e) => e.key === "Enter" && form.submit()}
              style={{
                height: 52,
                padding: "0 16px",
                borderRadius: 12,
                border: `1.5px solid ${p.line}`,
                width: "100%",
                fontSize: 16,
                color: p.ink,
                background: p.surface,
                outline: "none",
              }}
            />
          </div>
          <DemoUserHint form={form} />
          <Btn
            p={p}
            variant="primary"
            size="lg"
            full
            disabled={form.submitting}
            onClick={() => form.submit()}
          >
            {form.submitting ? "로그인 중…" : "로그인"}
          </Btn>
        </div>

        <div style={{ fontSize: 12, color: p.inkMuted, textAlign: "center", lineHeight: 1.7 }}>
          본 시스템은 근로기준법 제60·61조에 따른 사내 B2E 중개 모델입니다.
          <br />
          모든 거래 내역은 영구 보존되며 감사 추적이 가능합니다.
        </div>
      </form>
    </div>
  );
}

function LoginStandard() {
  const p = PALETTES.cobalt;
  const form = useLoginForm();
  return (
    <div
      style={{
        width: "100%",
        minHeight: "100vh",
        background: p.bg,
        fontFamily: FONT.sans,
        position: "relative",
        overflow: "hidden",
        display: "flex",
        flexDirection: "column",
      }}
    >
      <div
        style={{
          height: 44,
          background: p.surface,
          borderBottom: `1px solid ${p.line}`,
          display: "flex",
          alignItems: "center",
          padding: "0 28px",
          fontSize: 12,
          color: p.inkMuted,
          gap: 16,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <Icon.shield size={13} /> 보안 접속 (https · TLS 1.3)
        </div>
        <div style={{ flex: 1 }} />
        <div style={{ display: "flex", gap: 16 }}>
          <span style={{ cursor: "pointer" }}>한국어</span>
          <span>·</span>
          <span style={{ cursor: "pointer" }}>도움말</span>
        </div>
      </div>

      <div aria-hidden style={{ position: "absolute", inset: 0, opacity: 0.5 }}>
        <svg width="100%" height="100%">
          <defs>
            <pattern id="grid" width="40" height="40" patternUnits="userSpaceOnUse">
              <path d="M 40 0 L 0 0 0 40" fill="none" stroke={p.bgDeep} strokeWidth="1" />
            </pattern>
          </defs>
          <rect width="100%" height="100%" fill="url(#grid)" />
        </svg>
      </div>

      <div
        style={{
          flex: 1,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          position: "relative",
          zIndex: 1,
        }}
      >
        <form
          onSubmit={form.submit}
          style={{
            width: 440,
            background: p.surface,
            borderRadius: 20,
            padding: 40,
            boxShadow: "0 1px 0 rgba(11,25,41,0.04), 0 20px 60px rgba(11,25,41,0.08)",
          }}
        >
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              gap: 14,
              marginBottom: 32,
            }}
          >
            <BrandGlyph color={p.accent} size={48} />
            <div style={{ textAlign: "center" }}>
              <div style={{ fontSize: 13, color: p.inkMuted, fontWeight: 500 }}>
                타임소프트(주) 사내 시스템
              </div>
              <div
                style={{
                  fontSize: 22,
                  fontWeight: 800,
                  color: p.ink,
                  letterSpacing: "-0.02em",
                  marginTop: 4,
                }}
              >
                연차 경매 시스템
              </div>
            </div>
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            <div>
              <div style={{ fontSize: 12, color: p.inkSoft, marginBottom: 6, fontWeight: 600 }}>
                이메일 (Email)
              </div>
              <input
                type="email"
                value={form.email}
                onChange={(e) => form.setEmail(e.target.value)}
                placeholder="you@timesoftcon.co.kr"
                autoComplete="username"
                style={{
                  height: 48,
                  padding: "0 14px",
                  borderRadius: 10,
                  border: `1.5px solid ${p.accent}`,
                  width: "100%",
                  fontFamily: FONT.mono,
                  fontSize: 15,
                  color: p.ink,
                  background: p.surface,
                  outline: "none",
                }}
              />
            </div>

            <div>
              <div style={{ fontSize: 12, color: p.inkSoft, marginBottom: 6, fontWeight: 600 }}>
                비밀번호 (Password)
              </div>
              <input
                type="password"
                value={form.password}
                onChange={(e) => form.setPassword(e.target.value)}
                placeholder="비밀번호"
                autoComplete="current-password"
                onKeyDown={(e) => e.key === "Enter" && form.submit()}
                style={{
                  height: 48,
                  padding: "0 14px",
                  borderRadius: 10,
                  border: `1.5px solid ${p.line}`,
                  width: "100%",
                  fontSize: 15,
                  color: p.ink,
                  background: p.surface,
                  outline: "none",
                }}
              />
            </div>

            <DemoUserHint form={form} />

            <Btn
              p={p}
              variant="primary"
              size="lg"
              full
              disabled={form.submitting}
              onClick={() => form.submit()}
              style={{ marginTop: 8 }}
            >
              {form.submitting ? "로그인 중…" : "로그인"}
            </Btn>
          </div>

        </form>
      </div>

      <div
        style={{
          padding: "16px 28px",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          fontSize: 11,
          color: p.inkMuted,
          position: "relative",
          zIndex: 1,
        }}
      >
        <div>
          © 2026 타임소프트(주) · 본 시스템은 근로기준법 제60·61조에 따른 사내 B2E 중개 모델입니다.
        </div>
        <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
          <a
            href="#/_screens"
            style={{ color: p.inkMuted, textDecoration: "none", fontSize: 10 }}
          >
            데모 화면 목록 →
          </a>
          <span>v1.3.0 · build 8472</span>
        </div>
      </div>
    </div>
  );
}

// 데모 빠른 로그인 패널 — 역할별 계정 원클릭 입장. 운영 배포 시 제거.
function DemoUserHint({
  form,
}: {
  form: { quickLogin: (email: string, password: string) => void; submitting: boolean };
}) {
  const p = PALETTES.cobalt;
  return (
    <div>
      <div
        style={{
          fontSize: 12,
          fontWeight: 700,
          color: p.inkSoft,
          marginBottom: 8,
          display: "flex",
          alignItems: "center",
          gap: 6,
        }}
      >
        ⚡ 데모 빠른 로그인
        <span style={{ fontWeight: 500, color: p.inkMuted }}>· 클릭하면 바로 입장</span>
      </div>
      <div style={{ border: `1px solid ${p.line}`, borderRadius: 12, overflow: "hidden" }}>
        {DEMO_ACCOUNTS.map((a, i) => (
          <div
            key={a.email}
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              gap: 10,
              padding: "10px 12px",
              background: i % 2 ? p.bg : p.surface,
              borderTop: i ? `1px solid ${p.line}` : "none",
            }}
          >
            <div style={{ minWidth: 0 }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: p.ink }}>{a.label}</div>
              <div
                className="mono"
                style={{
                  fontSize: 10.5,
                  color: p.inkMuted,
                  whiteSpace: "nowrap",
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                }}
              >
                {a.email}
              </div>
            </div>
            <button
              type="button"
              disabled={form.submitting}
              onClick={() => form.quickLogin(a.email, a.password)}
              style={{
                flexShrink: 0,
                padding: "7px 14px",
                borderRadius: 8,
                fontSize: 12,
                fontWeight: 700,
                color: "#fff",
                background: p.accent,
                border: "none",
                cursor: form.submitting ? "default" : "pointer",
                opacity: form.submitting ? 0.6 : 1,
              }}
            >
              로그인 →
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
