// Login / SSO entry screen — brand-forward split layout
function Login({ p }) {
  return (
    <div style={{ width: 1440, height: 900, display: 'flex', background: p.surface, fontFamily: FONT.sans, overflow: 'hidden' }}>
      {/* LEFT — brand zone */}
      <div style={{
        flex: 1, background: p.bg, padding: '56px 64px',
        display: 'flex', flexDirection: 'column', justifyContent: 'space-between',
        position: 'relative', overflow: 'hidden',
      }}>
        <Brand p={p} />
        <div aria-hidden style={{ position: 'absolute', right: -120, top: 100, opacity: 0.6 }}>
          <svg width={620} height={620} viewBox="0 0 620 620" fill="none">
            <circle cx="240" cy="240" r="220" fill={p.bgDeep}/>
            <circle cx="440" cy="380" r="140" fill={p.surface}/>
            <circle cx="300" cy="460" r="100" fill={p.accentSoft}/>
          </svg>
        </div>
        <div style={{ position: 'relative', zIndex: 1, maxWidth: 580 }}>
          <div style={{
            fontSize: 13, fontWeight: 700, color: p.accent, letterSpacing: 1.2,
            padding: '7px 14px', background: p.surface, borderRadius: 999,
            display: 'inline-block', marginBottom: 24,
          }}>B2E · ESCROW & DIVIDEND</div>
          <div style={{ fontSize: 56, lineHeight: 1.1, fontWeight: 800, color: p.ink, letterSpacing: '-0.03em' }}>
            남는 연차와<br/>
            <span style={{ color: p.accent }}>필요한 연차</span>를<br/>
            잇는 사내 경매.
          </div>
          <div style={{ marginTop: 28, fontSize: 17, lineHeight: 1.65, color: p.inkSoft, maxWidth: 480 }}>
            소멸될 뻔한 미사용 연차를 공용 풀에 기여하고,<br/>
            복지 포인트로 입찰한 연차를 자유롭게 쓰세요.<br/>
            연말엔 기여 지분만큼 복지카드로 배당받습니다.
          </div>
        </div>
        <div style={{ position: 'relative', zIndex: 1, display: 'flex', gap: 12 }}>
          {[
            { k: '재무 리스크', v: '0%', sub: '회사 예산 선투입 없음' },
            { k: '재무 정합성', v: '100%', sub: 'Insert-Only 원장' },
            { k: '동시성 제어', v: 'SQLite write 락', sub: 'lockAuction · NFR-1' },
          ].map((s, i) => (
            <div key={i} style={{ flex: 1, background: p.surface, borderRadius: 18, padding: 18 }}>
              <div style={{ fontSize: 12, color: p.inkMuted, fontWeight: 500 }}>{s.k}</div>
              <div className="mono" style={{ fontSize: 28, fontWeight: 800, color: p.ink, letterSpacing: '-0.025em', marginTop: 2 }}>{s.v}</div>
              <div style={{ fontSize: 11, color: p.inkMuted, marginTop: 4 }}>{s.sub}</div>
            </div>
          ))}
        </div>
      </div>

      {/* RIGHT — sign-in form */}
      <div style={{
        width: 520, padding: '80px 64px',
        display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: 28,
      }}>
        <div>
          <div style={{ fontSize: 13, color: p.inkMuted, fontWeight: 500 }}>사내 그룹웨어로 로그인</div>
          <div style={{ fontSize: 30, fontWeight: 800, color: p.ink, letterSpacing: '-0.025em', marginTop: 6 }}>
            연차 경매 시스템
          </div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <Btn p={p} variant="dark" size="xl" full>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 10 }}>
              {Icon.shield(20)} SSO로 로그인
            </span>
          </Btn>
          <Btn p={p} variant="ghost" size="lg" full>관리자 계정으로 로그인</Btn>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 12, color: p.inkMuted, fontSize: 12 }}>
          <div style={{ flex: 1, height: 1, background: p.line }} />
          또는 사번으로
          <div style={{ flex: 1, height: 1, background: p.line }} />
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div>
            <div style={{ fontSize: 12, color: p.inkMuted, marginBottom: 6, fontWeight: 600 }}>사번</div>
            <div style={{
              height: 52, padding: '0 16px', borderRadius: 12,
              border: `1.5px solid ${p.line}`, display: 'flex', alignItems: 'center',
              fontFamily: FONT.mono, fontSize: 16, color: p.ink, background: p.surface,
            }}>TS-2024-018</div>
          </div>
          <div>
            <div style={{ fontSize: 12, color: p.inkMuted, marginBottom: 6, fontWeight: 600 }}>비밀번호</div>
            <div style={{
              height: 52, padding: '0 16px', borderRadius: 12,
              border: `1.5px solid ${p.accent}`, display: 'flex', alignItems: 'center',
              fontSize: 16, color: p.ink, background: p.surface, letterSpacing: 4,
            }}>••••••••••</div>
          </div>
          <Btn p={p} variant="primary" size="lg" full>로그인</Btn>
        </div>

        <div style={{ fontSize: 12, color: p.inkMuted, textAlign: 'center', lineHeight: 1.7 }}>
          본 시스템은 근로기준법 제60·61조에 따른 사내 B2E 중개 모델입니다.<br/>
          모든 거래 내역은 영구 보존되며 감사 추적이 가능합니다.
        </div>
      </div>
    </div>
  );
}

// ─── Variant B · 표준 사내 로그인 (센터 카드, 그룹웨어 톤) ───
function LoginStandard({ p }) {
  return (
    <div style={{
      width: 1440, height: 900, background: p.bg, fontFamily: FONT.sans,
      position: 'relative', overflow: 'hidden',
      display: 'flex', flexDirection: 'column',
    }}>
      {/* Top utility bar (그룹웨어 느낌) */}
      <div style={{
        height: 44, background: p.surface, borderBottom: `1px solid ${p.line}`,
        display: 'flex', alignItems: 'center', padding: '0 28px',
        fontSize: 12, color: p.inkMuted, gap: 16,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          {Icon.shield(13)} 보안 접속 (https · TLS 1.3)
        </div>
        <div style={{ flex: 1 }} />
        <div style={{ display: 'flex', gap: 16 }}>
          <span style={{ cursor: 'pointer' }}>한국어</span>
          <span>·</span>
          <span style={{ cursor: 'pointer' }}>도움말</span>
          <span>·</span>
          <span style={{ cursor: 'pointer' }}>시스템 공지</span>
        </div>
      </div>

      {/* Background pattern */}
      <div aria-hidden style={{ position: 'absolute', inset: 0, opacity: 0.5 }}>
        <svg width="100%" height="100%">
          <defs>
            <pattern id="grid" width="40" height="40" patternUnits="userSpaceOnUse">
              <path d="M 40 0 L 0 0 0 40" fill="none" stroke={p.bgDeep} strokeWidth="1"/>
            </pattern>
          </defs>
          <rect width="100%" height="100%" fill="url(#grid)" />
        </svg>
      </div>

      {/* Center card */}
      <div style={{
        flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center',
        position: 'relative', zIndex: 1,
      }}>
        <div style={{
          width: 440, background: p.surface, borderRadius: 20, padding: 40,
          boxShadow: '0 1px 0 rgba(11,25,41,0.04), 0 20px 60px rgba(11,25,41,0.08)',
        }}>
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 14, marginBottom: 32 }}>
            <BrandGlyph color={p.accent} size={48} />
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: 13, color: p.inkMuted, fontWeight: 500 }}>타임소프트(주) 사내 시스템</div>
              <div style={{ fontSize: 22, fontWeight: 800, color: p.ink, letterSpacing: '-0.02em', marginTop: 4 }}>
                연차 경매 시스템
              </div>
            </div>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div>
              <div style={{ fontSize: 12, color: p.inkSoft, marginBottom: 6, fontWeight: 600 }}>사번 (Employee ID)</div>
              <div style={{
                height: 48, padding: '0 14px', borderRadius: 10,
                border: `1.5px solid ${p.line}`, display: 'flex', alignItems: 'center', gap: 10,
                fontFamily: FONT.mono, fontSize: 15, color: p.ink, background: p.surface,
              }}>
                <span style={{ color: p.inkMuted, display: 'inline-flex' }}>{Icon.user(16)}</span>
                TS-2024-018
              </div>
            </div>
            <div>
              <div style={{ fontSize: 12, color: p.inkSoft, marginBottom: 6, fontWeight: 600 }}>비밀번호</div>
              <div style={{
                height: 48, padding: '0 14px', borderRadius: 10,
                border: `1.5px solid ${p.accent}`, display: 'flex', alignItems: 'center', gap: 10,
                fontSize: 15, color: p.ink, background: p.surface, letterSpacing: 3,
              }}>
                <span style={{ color: p.accent, display: 'inline-flex' }}>{Icon.shield(16)}</span>
                ••••••••••
              </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 4, fontSize: 12 }}>
              <label style={{ display: 'inline-flex', alignItems: 'center', gap: 6, color: p.inkSoft, cursor: 'pointer' }}>
                <span style={{
                  width: 16, height: 16, borderRadius: 4, background: p.accent,
                  display: 'inline-flex', alignItems: 'center', justifyContent: 'center', color: '#fff',
                }}>{Icon.check(12)}</span>
                로그인 상태 유지
              </label>
              <span style={{ color: p.accent, fontWeight: 600, cursor: 'pointer' }}>비밀번호 재설정</span>
            </div>

            <Btn p={p} variant="primary" size="lg" full style={{ marginTop: 8 }}>로그인</Btn>

            <div style={{ display: 'flex', alignItems: 'center', gap: 10, color: p.inkMuted, fontSize: 11, margin: '8px 0' }}>
              <div style={{ flex: 1, height: 1, background: p.line }} />
              간편 로그인
              <div style={{ flex: 1, height: 1, background: p.line }} />
            </div>

            <div style={{ display: 'flex', gap: 8 }}>
              <Btn p={p} variant="ghost" size="md" full>
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>{Icon.shield(14)} SSO</span>
              </Btn>
              <Btn p={p} variant="ghost" size="md" full>
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>{Icon.user(14)} 그룹웨어 계정</span>
              </Btn>
            </div>
          </div>

          <div style={{ marginTop: 28, padding: 14, background: p.bg, borderRadius: 10, fontSize: 11, color: p.inkSoft, lineHeight: 1.6 }}>
            <strong style={{ color: p.ink }}>📢 시스템 공지</strong> · 2026-04-02<br/>
            14주차 경매 5건이 어제 09:00에 오픈되었습니다. 마이페이지에서 잔여 포인트를 확인하세요.
          </div>
        </div>
      </div>

      <div style={{
        padding: '16px 28px', display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        fontSize: 11, color: p.inkMuted, position: 'relative', zIndex: 1,
      }}>
        <div>© 2026 타임소프트(주) · 본 시스템은 근로기준법 제60·61조에 따른 사내 B2E 중개 모델입니다.</div>
        <div>v1.3.0 · build 8472</div>
      </div>
    </div>
  );
}

window.Login = Login;
window.LoginStandard = LoginStandard;
