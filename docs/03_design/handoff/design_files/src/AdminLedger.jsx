// Admin LEDGER — Insert-Only audit view; emphasizes financial integrity
function AdminLedger({ p }) {
  return (
    <div style={{ width: 1440, height: 900, background: p.bg, fontFamily: FONT.sans, display: 'flex', flexDirection: 'column' }}>
      <TopNav p={p} active="admin" user="박부장" role="관리자" />
      <div style={{ flex: 1, padding: '24px 40px', overflow: 'hidden' }}>
        <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', marginBottom: 20 }}>
          <div>
            <div style={{ fontSize: 13, color: p.inkMuted, fontWeight: 500, display: 'flex', alignItems: 'center', gap: 6 }}>
              {Icon.ledger(14)} LEDGER_ENTRY · Insert-Only
            </div>
            <div style={{ fontSize: 28, fontWeight: 800, color: p.ink, letterSpacing: '-0.025em', marginTop: 4 }}>
              원장 (감사 추적)
            </div>
            <div style={{ fontSize: 12, color: p.inkMuted, marginTop: 6 }}>
              DB-RULE-1 · UPDATE / DELETE는 트리거로 영구 차단됩니다
            </div>
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <Btn p={p} variant="ghost" size="md">CSV 내보내기</Btn>
            <Btn p={p} variant="ghost" size="md">정합성 재검증</Btn>
          </div>
        </div>

        {/* Equation card — the system's truth */}
        <Card p={p} padding={20} style={{ marginBottom: 16, background: p.ink, color: '#fff' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.55)', fontWeight: 600, letterSpacing: 0.5 }}>NFR-2 · 재무 정합성 등식 (WELFARE_POINT)</div>
              <div className="mono" style={{ fontSize: 17, fontWeight: 600, marginTop: 8, letterSpacing: '-0.005em', color: 'rgba(255,255,255,0.85)' }}>
                Σ(BID + WIN) <span style={{ color: 'rgba(255,255,255,0.5)' }}>−</span> Σ(REFUND + DIVIDEND) <span style={{ color: 'rgba(255,255,255,0.5)' }}>=</span> ESCROW.balance
              </div>
              <div className="mono" style={{ fontSize: 14, fontWeight: 500, marginTop: 6, color: 'rgba(255,255,255,0.7)' }}>
                <span style={{ color: '#fff' }}>4,832,400</span>  <span style={{ color: 'rgba(255,255,255,0.4)' }}>−</span>  <span style={{ color: '#fff' }}>4,645,200</span>  <span style={{ color: 'rgba(255,255,255,0.4)' }}>=</span>  <span style={{ color: p.success }}>187,200 P  ✓</span>
              </div>
            </div>
            <div style={{ textAlign: 'right' }}>
              <Pill p={p} tone="success" size="sm" style={{ background: '#fff', color: p.success }}>
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>{Icon.check(12)} 정합성 통과</span>
              </Pill>
              <div className="mono" style={{ fontSize: 11, color: 'rgba(255,255,255,0.55)', marginTop: 8 }}>마지막 검증 14:30:00</div>
              <div className="mono" style={{ fontSize: 11, color: 'rgba(255,255,255,0.55)' }}>차이 0 P · 통화별 분리 검증</div>
            </div>
          </div>
        </Card>

        {/* Filters + Ledger table */}
        <div style={{ display: 'grid', gridTemplateColumns: '240px 1fr', gap: 16, height: 540 }}>
          {/* Filters */}
          <Card p={p} padding={20}>
            <div style={{ fontSize: 12, color: p.inkMuted, fontWeight: 700, marginBottom: 12 }}>필터</div>
            <div style={{ fontSize: 11, color: p.inkMuted, fontWeight: 600, marginBottom: 6 }}>action_type</div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 16 }}>
              {[
                { l: 'BID', on: true }, { l: 'REFUND', on: true }, { l: 'WIN', on: true },
                { l: 'DIVIDEND', on: false }, { l: 'CREDIT_ADMIN', on: true }, { l: 'EXPIRE', on: false },
              ].map((t, i) => (
                <Pill key={i} p={p} tone={t.on ? 'accent' : 'neutral'} size="sm" style={{ cursor: 'pointer' }}>{t.l}</Pill>
              ))}
            </div>
            <div style={{ fontSize: 11, color: p.inkMuted, fontWeight: 600, marginBottom: 6 }}>기간</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 16 }}>
              {['오늘', '지난 7일', '이번 달', '2026 전체'].map((d, i) => (
                <div key={d} style={{
                  padding: '8px 10px', fontSize: 12, fontWeight: 600,
                  background: i === 0 ? p.ink : p.bg,
                  color: i === 0 ? '#fff' : p.inkSoft,
                  borderRadius: 8, cursor: 'pointer',
                }}>{d}</div>
              ))}
            </div>
            <div style={{ fontSize: 11, color: p.inkMuted, fontWeight: 600, marginBottom: 6 }}>currency</div>
            <Pill p={p} tone="accent" size="sm" style={{ cursor: 'pointer' }}>WELFARE_POINT</Pill>

            <div style={{ marginTop: 18, padding: 12, background: '#FFF4E0', borderRadius: 10, fontSize: 11, color: p.warn, lineHeight: 1.5 }}>
              <strong>⚠ 읽기 전용</strong><br/>
              <span style={{ color: p.inkSoft, fontWeight: 500 }}>관리자도 원장 행을 수정·삭제할 수 없습니다. 정정은 REFUND 또는 CREDIT_ADMIN INSERT로만 가능합니다.</span>
            </div>
          </Card>

          {/* Table */}
          <Card p={p} padding={0} style={{ display: 'flex', flexDirection: 'column', minHeight: 0 }}>
            <div style={{
              display: 'grid', gridTemplateColumns: '50px 90px 90px 110px 130px 1fr 130px 130px',
              padding: '12px 20px', fontSize: 11, color: p.inkMuted, fontWeight: 700, letterSpacing: 0.4,
              borderBottom: `1px solid ${p.line}`, background: p.bg,
            }}>
              <div>id</div><div>시각</div><div>action</div><div>경매</div><div>user</div><div>reason / note</div>
              <div style={{ textAlign: 'right' }}>amount</div>
              <div style={{ textAlign: 'right' }}>escrow_snap</div>
            </div>
            <div style={{ overflow: 'auto', flex: 1 }}>
              {LEDGER.map((row, i) => {
                const actionColors = {
                  BID: { bg: '#EEF2F7', fg: p.inkSoft, dot: '#94A3B8' },
                  REFUND: { bg: '#E6F6F0', fg: p.success, dot: p.success },
                  WIN: { bg: p.accentSoft, fg: p.accent, dot: p.accent },
                  DIVIDEND: { bg: '#FFF4E0', fg: p.warn, dot: p.warn },
                  CREDIT_ADMIN: { bg: '#F3F0FF', fg: '#7C3AED', dot: '#7C3AED' },
                  EXPIRE: { bg: '#FDECEE', fg: p.danger, dot: p.danger },
                };
                const c = actionColors[row.type];
                const zebra = i % 2 === 1;
                return (
                  <div key={i} style={{
                    display: 'grid', gridTemplateColumns: '50px 90px 90px 110px 130px 1fr 130px 130px',
                    padding: '14px 20px', fontSize: 12, alignItems: 'center',
                    background: zebra ? p.bg : p.surface,
                    borderBottom: `1px solid ${p.line}`,
                    borderLeft: `3px solid ${c.dot}`,
                    transition: 'background .12s',
                  }}>
                    <div className="mono" style={{ color: p.inkMuted, fontWeight: 600 }}>{8472 - i}</div>
                    <div className="mono" style={{ color: p.inkSoft }}>{row.t}</div>
                    <div>
                      <Pill p={p} size="sm" style={{ background: c.bg, color: c.fg, fontSize: 10, fontWeight: 700 }}>{row.type}</Pill>
                    </div>
                    <div className="mono" style={{ color: p.inkSoft, fontSize: 11, fontWeight: 600 }}>{row.auction}</div>
                    <div style={{ color: p.ink, fontWeight: 600 }}>{row.user}</div>
                    <div style={{ color: p.inkMuted, fontSize: 11 }}>{row.note || '—'}</div>
                    <div className="mono" style={{ textAlign: 'right', fontWeight: 800, color: row.amount > 0 ? p.success : row.amount < 0 ? p.ink : p.inkMuted }}>
                      {row.amount > 0 ? '+' : ''}{row.amount === 0 ? '0' : fmt.point(row.amount)}
                    </div>
                    <div className="mono" style={{ textAlign: 'right', color: p.inkSoft, fontSize: 11, fontWeight: 600 }}>
                      {fmt.point(row.balance)}
                    </div>
                  </div>
                );
              })}
            </div>
            <div style={{ padding: '12px 20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderTop: `1px solid ${p.line}`, background: p.bg, fontSize: 11, color: p.inkMuted }}>
              <span>총 8,472건 · 현재 페이지 10건</span>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <Btn p={p} variant="ghost" size="sm">{Icon.chev(12, 'left')}</Btn>
                <span className="mono" style={{ color: p.ink, fontWeight: 700, padding: '0 8px' }}>1 / 848</span>
                <Btn p={p} variant="ghost" size="sm">{Icon.chev(12, 'right')}</Btn>
              </div>
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}

window.AdminLedger = AdminLedger;
