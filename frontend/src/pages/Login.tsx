import { useState, type FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import { PALETTES, FONT } from "@/lib/tokens";
import { Brand, BrandGlyph, Btn } from "@/components/atoms";
import { Icon } from "@/components/icons";
import { login } from "@/lib/queries";
import { ApiError } from "@/lib/api";
import { DEMO_USERS, useCurrentUser } from "@/lib/current-user";
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
          display: "flex",
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

function useLoginForm() {
  const [empId, setEmpId] = useState<string>(DEMO_USERS[0].empId);
  const [submitting, setSubmitting] = useState(false);
  const navigate = useNavigate();
  const { setUserId } = useCurrentUser();
  const toast = useToast();

  const submit = async (e?: FormEvent) => {
    e?.preventDefault();
    setSubmitting(true);
    try {
      const r = await login(empId);
      setUserId(Number(r.userId));
      toast.push("success", `${r.name}님으로 로그인했습니다`);
      navigate("/dashboard");
    } catch (err) {
      const msg = err instanceof ApiError ? err.message : (err as Error).message;
      toast.push("error", `로그인 실패: ${msg}`);
    } finally {
      setSubmitting(false);
    }
  };

  return { empId, setEmpId, submit, submitting };
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
            복지 포인트로 입찰한 연차를 자유롭게 쓰세요.
            <br />
            연말엔 기여 지분만큼 복지카드로 배당받습니다.
          </div>
        </div>
        <div style={{ position: "relative", zIndex: 1, display: "flex", gap: 12 }}>
          {[
            { k: "재무 리스크", v: "0%", sub: "회사 예산 선투입 없음" },
            { k: "재무 정합성", v: "100%", sub: "Insert-Only 원장" },
            { k: "동시성 제어", v: "PG", sub: "advisory_xact_lock" },
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

        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <Btn p={p} variant="dark" size="xl" full>
            <span style={{ display: "inline-flex", alignItems: "center", gap: 10 }}>
              <Icon.shield size={20} /> SSO로 로그인 (데모: 사번 사용)
            </span>
          </Btn>
        </div>

        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 12,
            color: p.inkMuted,
            fontSize: 12,
          }}
        >
          <div style={{ flex: 1, height: 1, background: p.line }} />
          또는 사번으로
          <div style={{ flex: 1, height: 1, background: p.line }} />
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          <div>
            <div style={{ fontSize: 12, color: p.inkMuted, marginBottom: 6, fontWeight: 600 }}>
              사번
            </div>
            <input
              value={form.empId}
              onChange={(e) => form.setEmpId(e.target.value)}
              placeholder="TS-2024-001"
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
          <DemoUserHint />
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
                사번 (Employee ID)
              </div>
              <input
                value={form.empId}
                onChange={(e) => form.setEmpId(e.target.value)}
                placeholder="TS-2024-001"
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

            <DemoUserHint />

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

          <div
            style={{
              marginTop: 28,
              padding: 14,
              background: p.bg,
              borderRadius: 10,
              fontSize: 11,
              color: p.inkSoft,
              lineHeight: 1.6,
            }}
          >
            <strong style={{ color: p.ink }}>📢 데모 안내</strong>
            <br />
            비밀번호 검증은 구현되지 않았습니다. 시드된 9명 사번 중 하나로 로그인하세요.
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

function DemoUserHint() {
  const p = PALETTES.cobalt;
  return (
    <div
      style={{
        padding: 10,
        background: p.bg,
        borderRadius: 8,
        fontSize: 11,
        color: p.inkMuted,
        lineHeight: 1.5,
      }}
    >
      <strong style={{ color: p.inkSoft }}>데모 사번</strong>
      <br />
      {DEMO_USERS.slice(0, 4).map((u) => u.empId).join(" · ")}
      <br />
      {DEMO_USERS.slice(4).map((u) => u.empId).join(" · ")}
    </div>
  );
}
