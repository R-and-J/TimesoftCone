// My Activity — Bid history + leave portfolio
function MyActivity({ p }) {
  const history = [
    { t: '오늘 14:32', type: 'BID', auction: 'A-2026-106', amount: -8700, balance: 12450, status: 'refunded', desc: '입찰 → 환불됨' },
    { t: '오늘 14:18', type: 'BID', auction: 'A-2026-106', amount: -8000, balance: 13150, status: 'refunded', desc: '입찰 → 환불됨' },
    { t: '오늘 14:02', type: 'BID', auction: 'A-2026-105', amount: -6200, balance: 13150, status: 'active', desc: '입찰 중 (현 최고가)' },
    { t: '어제 18:00', type: 'WIN', auction: 'A-2026-103', amount: 0, balance: 19350, status: 'won', desc: '✨ 낙찰 — 연차 +1일' },
    { t: '어제 17:45', type: 'BID', auction: 'A-2026-103', amount: -7800, balance: 19350, status: 'win-final', desc: '낙찰 입찰' },
    { t: '4/1 09:14', type: 'REFUND', auction: 'A-2026-102', amount: +5400, balance: 27150, status: 'refunded', desc: '상위 입찰 발생 — 자동 환불' },
    { t: '4/1 09:02', type: 'BID', auction: 'A-2026-102', amount: -5400, balance: 21750, status: 'refunded', desc: '입찰' },
    { t: '3/30 11:00', type: 'CREDIT_ADMIN', auction: '—', amount: +20000, balance: 27150, status: 'credit', desc: '관리자 적립 — 1Q 인센티브' },
  ];

  const typeColors = {
    BID: { bg: p.bg, fg: p.inkSoft, label: '입찰' },
    REFUND: { bg: '#E6F6F0', fg: p.success, label: '환불' },
    WIN: { bg: p.accentSoft, fg: p.accent, label: '낙찰' },
    DIVIDEND: { bg: '#FFF4E0', fg: p.warn, label: '배당' },
    CREDIT_ADMIN: { bg: '#F3F0FF', fg: '#7C3AED', label: '관리자 적립' },
  };

  return (
    <div style={{ width: 1440, height: 900, background: p.bg, fontFamily: FONT.sans, display: 'flex', flexDirection: 'column' }}>
      <TopNav p={p} active="activity" />
      <div style={{ flex: 1, padding: '28px 40px', overflow: 'hidden', display: 'grid', gridTemplateColumns: '1.6fr 1fr', gap: 16 }}>
        {/* LEFT — ledger feed */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16, minHeight: 0 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end' }}>
            <div>
              <div style={{ fontSize: 13, color: p.inkMuted, fontWeight: 500 }}>내 활동</div>
              <div style={{ fontSize: 28, fontWeight: 800, color: p.ink, letterSpacing: '-0.025em', marginTop: 4 }}>거래 내역</div>
            </div>
            <div style={{ display: 'flex', gap: 6 }}>
              {['전체', '입찰', '낙찰', '환불', '배당'].map((f, i) => (
                <div key={f} style={{
                  padding: '8px 14px', fontSize: 13, fontWeight: 600,
                  background: i === 0 ? p.ink : p.surface,
                  color: i === 0 ? '#fff' : p.inkMuted,
                  borderRadius: 999, cursor: 'pointer',
                  border: `1px solid ${i === 0 ? p.ink : p.line}`,
                }}>{f}</div>
              ))}
            </div>
          </div>

          {/* Summary chips */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12 }}>
            {[
              { k: '총 입찰 횟수', v: '23', sub: '이번 분기' },
              { k: '낙찰 횟수', v: '1', sub: '획득 연차 1일' },
              { k: '환불 받음', v: '11', sub: '평균 1.2초 내' },
              { k: '활동 중', v: '1', sub: 'A-2026-105' },
            ].map((s, i) => (
              <Card key={i} p={p} padding={16}>
                <div style={{ fontSize: 11, color: p.inkMuted, fontWeight: 600 }}>{s.k}</div>
                <div className="mono" style={{ fontSize: 26, fontWeight: 800, color: p.ink, marginTop: 4, letterSpacing: '-0.02em' }}>{s.v}</div>
                <div style={{ fontSize: 11, color: p.inkMuted, marginTop: 2 }}>{s.sub}</div>
              </Card>
            ))}
          </div>

          <Card p={p} padding={0} style={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column', minHeight: 0 }}>
            <div style={{
              display: 'grid', gridTemplateColumns: '120px 100px 120px 1fr 130px 130px',
              padding: '14px 24px', fontSize: 11, color: p.inkMuted, fontWeight: 700,
              borderBottom: `1px solid ${p.line}`, letterSpacing: 0.4,
            }}>
              <div>시각</div><div>구분</div><div>경매</div><div>설명</div>
              <div style={{ textAlign: 'right' }}>금액</div>
              <div style={{ textAlign: 'right' }}>잔액</div>
            </div>
            <div style={{ overflow: 'auto', flex: 1 }}>
              {history.map((h, i) => {
                const c = typeColors[h.type];
                return (
                  <div key={i} style={{
                    display: 'grid', gridTemplateColumns: '120px 100px 120px 1fr 130px 130px',
                    padding: '16px 24px', alignItems: 'center', fontSize: 13,
                    borderBottom: `1px solid ${p.line}`,
                    background: h.type === 'WIN' ? p.accentSoft : p.surface,
                  }}>
                    <div style={{ color: p.inkMuted, fontSize: 12 }}>{h.t}</div>
                    <div>
                      <Pill p={p} size="sm" style={{ background: c.bg, color: c.fg }}>{c.label}</Pill>
                    </div>
                    <div className="mono" style={{ color: p.inkSoft, fontSize: 12, fontWeight: 600 }}>{h.auction}</div>
                    <div style={{ color: p.ink, fontWeight: h.type === 'WIN' ? 700 : 500 }}>{h.desc}</div>
                    <div className="mono" style={{ textAlign: 'right', fontWeight: 800, color: h.amount > 0 ? p.success : h.amount < 0 ? p.ink : p.inkMuted }}>
                      {h.amount > 0 ? '+' : ''}{h.amount === 0 ? '—' : fmt.point(h.amount)}{h.amount !== 0 && <span style={{ color: p.inkMuted, marginLeft: 3, fontWeight: 500 }}>P</span>}
                    </div>
                    <div className="mono" style={{ textAlign: 'right', color: p.inkSoft, fontSize: 13 }}>
                      {fmt.point(h.balance)}<span style={{ color: p.inkMuted, marginLeft: 3 }}>P</span>
                    </div>
                  </div>
                );
              })}
            </div>
          </Card>
        </div>

        {/* RIGHT — Leave portfolio */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16, minHeight: 0 }}>
          <Card p={p} padding={20} style={{ background: p.ink, color: '#fff' }}>
            <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.6)', fontWeight: 600 }}>내 연차 잔여</div>
            <div className="mono" style={{ fontSize: 56, fontWeight: 800, letterSpacing: '-0.03em', lineHeight: 1, marginTop: 10 }}>
              16<span style={{ fontSize: 22, color: 'rgba(255,255,255,0.6)', marginLeft: 6 }}>일</span>
            </div>
            <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.5)', marginTop: 4 }}>총 부여 18일 · 사용 2일</div>

            {/* Bar */}
            <div style={{ marginTop: 20, height: 28, borderRadius: 8, overflow: 'hidden', display: 'flex' }}>
              <div style={{ width: '15%', background: p.accent, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, fontWeight: 700 }}>3 AUC</div>
              <div style={{ width: '5%', background: p.warn, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, fontWeight: 700 }}>1</div>
              <div style={{ width: '80%', background: 'rgba(255,255,255,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, fontWeight: 700, color: '#fff' }}>12 REGULAR</div>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, color: 'rgba(255,255,255,0.55)', marginTop: 6 }}>
              <span>차감 1순위 →</span>
              <span>→ 차감 3순위</span>
            </div>
          </Card>

          <Card p={p} padding={20}>
            <div style={{ fontSize: 13, color: p.inkMuted, fontWeight: 700, marginBottom: 14 }}>입찰 활동 트렌드</div>
            <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between' }}>
              <div>
                <div className="mono" style={{ fontSize: 28, fontWeight: 800, color: p.ink, letterSpacing: '-0.02em' }}>23</div>
                <div style={{ fontSize: 11, color: p.inkMuted }}>총 입찰 / 분기</div>
              </div>
              <Pill p={p} tone="success" size="sm">▲ 47%</Pill>
            </div>
            <div style={{ marginTop: 12 }}>
              <Spark data={[2,4,3,5,4,7,6,8,9,11,9,13]} w={320} h={70} color={p.accent} fill={p.accentSoft} />
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 6, fontSize: 10, color: p.inkMuted }}>
              <span>1월</span><span>2월</span><span>3월</span><span>4월</span>
            </div>
          </Card>

          <Card p={p} padding={20} style={{ flex: 1 }}>
            <div style={{ fontSize: 13, color: p.inkMuted, fontWeight: 700, marginBottom: 12 }}>곧 마감되는 내 입찰</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <div style={{ padding: 12, background: p.accentSoft, borderRadius: 12, borderLeft: `3px solid ${p.accent}` }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div className="mono" style={{ fontSize: 12, color: p.accent, fontWeight: 700 }}>A-2026-105</div>
                  <Pill p={p} tone="accent" size="sm">최고가</Pill>
                </div>
                <div className="mono" style={{ fontSize: 22, fontWeight: 800, color: p.ink, marginTop: 6, letterSpacing: '-0.02em' }}>
                  6,200<span style={{ fontSize: 12, color: p.inkMuted, marginLeft: 3 }}>P</span>
                </div>
                <div style={{ fontSize: 11, color: p.inkSoft, marginTop: 4 }}>내일 09:30 마감 · 19시간 후</div>
              </div>
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}

window.MyActivity = MyActivity;
