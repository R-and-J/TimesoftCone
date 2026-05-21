// ★ STAR ★ Year-End Dividend Settlement — celebrates the user's stake & payout
function Dividend({ p }) {
  const myStake = STAKES.find(s => s.isMe);
  const totalEscrow = 187200;
  const myDividend = Math.floor(totalEscrow * myStake.ratio);

  return (
    <div style={{ width: 1440, height: 900, background: p.bg, fontFamily: FONT.sans, display: 'flex', flexDirection: 'column' }}>
      <TopNav p={p} active="dividend" />

      <div style={{ flex: 1, padding: '24px 40px', overflow: 'hidden' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: 20 }}>
          <div>
            <div style={{ fontSize: 13, color: p.inkMuted, fontWeight: 500 }}>2026년 연말 배당</div>
            <div style={{ fontSize: 30, fontWeight: 800, color: p.ink, letterSpacing: '-0.025em', marginTop: 4 }}>
              내 지분과 배당 시뮬레이션
            </div>
          </div>
          <div style={{ display: 'flex', gap: 6, padding: 4, background: p.surface, borderRadius: 12, border: `1px solid ${p.line}` }}>
            {['2026 (예상)', '2025', '2024'].map((y, i) => (
              <div key={y} style={{
                padding: '8px 14px', fontSize: 13, fontWeight: 600,
                background: i === 0 ? p.ink : 'transparent',
                color: i === 0 ? '#fff' : p.inkMuted,
                borderRadius: 8, cursor: 'pointer',
              }}>{y}</div>
            ))}
          </div>
        </div>

        {/* Hero — Big dividend reveal */}
        <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: 16, marginBottom: 16 }}>
          <Card p={p} padding={0} style={{
            background: `linear-gradient(135deg, ${p.accent} 0%, ${p.accentDeep} 100%)`,
            color: '#fff', position: 'relative', overflow: 'hidden', minHeight: 360,
          }}>
            {/* Confetti dots */}
            <div aria-hidden style={{ position: 'absolute', inset: 0, opacity: 0.18 }}>
              <svg width="100%" height="100%" viewBox="0 0 600 400">
                {[...Array(50)].map((_, i) => {
                  const x = (i * 73) % 600;
                  const y = (i * 41) % 400;
                  return <circle key={i} cx={x} cy={y} r={2 + (i % 3)} fill="#fff" />;
                })}
              </svg>
            </div>
            <div style={{ position: 'relative', zIndex: 1, padding: 36 }}>
              <Pill p={p} size="sm" style={{ background: 'rgba(255,255,255,0.2)', color: '#fff' }}>
                {Icon.gift(12)} 연말 배당 산정 결과
              </Pill>
              <div style={{ marginTop: 16, fontSize: 17, color: 'rgba(255,255,255,0.85)', fontWeight: 500, lineHeight: 1.5 }}>
                <strong>김기철</strong>님, 올해 기여하신 <strong>연차 6일</strong>의 결실이에요.
              </div>
              <div style={{ marginTop: 20 }}>
                <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.6)', fontWeight: 600, letterSpacing: 0.5 }}>2026 예상 배당금</div>
                <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginTop: 8 }}>
                  <div className="mono" style={{ fontSize: 108, fontWeight: 800, letterSpacing: '-0.04em', lineHeight: 1 }}>
                    {fmt.point(myDividend)}
                  </div>
                  <div style={{ fontSize: 32, fontWeight: 700, color: 'rgba(255,255,255,0.7)' }}>P</div>
                </div>
                <div style={{ marginTop: 10, fontSize: 13, color: 'rgba(255,255,255,0.75)' }}>
                  복지카드 한도 <span style={{ color: '#fff', fontWeight: 700 }}>+{fmt.point(myDividend)}원</span>으로 12/31에 입금돼요
                </div>
              </div>

              <div style={{ display: 'flex', gap: 8, marginTop: 28 }}>
                <div style={{ flex: 1, background: 'rgba(255,255,255,0.12)', borderRadius: 14, padding: 14 }}>
                  <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.6)', fontWeight: 600 }}>내 지분율</div>
                  <div className="mono" style={{ fontSize: 26, fontWeight: 800, marginTop: 2 }}>8.7%</div>
                </div>
                <div style={{ flex: 1, background: 'rgba(255,255,255,0.12)', borderRadius: 14, padding: 14 }}>
                  <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.6)', fontWeight: 600 }}>전체 순위</div>
                  <div className="mono" style={{ fontSize: 26, fontWeight: 800, marginTop: 2 }}>5<span style={{ fontSize: 14, fontWeight: 600, color: 'rgba(255,255,255,0.6)' }}>/27</span></div>
                </div>
                <div style={{ flex: 1, background: 'rgba(255,255,255,0.12)', borderRadius: 14, padding: 14 }}>
                  <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.6)', fontWeight: 600 }}>작년 대비</div>
                  <div className="mono" style={{ fontSize: 26, fontWeight: 800, marginTop: 2 }}>▲ +42%</div>
                </div>
              </div>
            </div>
          </Card>

          {/* Stake donut */}
          <Card p={p} padding={28}>
            <div style={{ fontSize: 13, color: p.inkMuted, fontWeight: 700 }}>전체 지분 분포 · 2026년</div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 24, marginTop: 16 }}>
              <div style={{ position: 'relative' }}>
                <Donut size={180} thickness={26}
                  ringBg={p.bg}
                  segments={STAKES.map((s, i) => ({
                    value: s.ratio,
                    color: s.isMe ? p.accent : ['#0E1240','#3F4474','#5e6385','#8A8FB5','#cfd2e6','#dde0f3'][i % 6],
                  }))}
                />
                <div style={{
                  position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column',
                  alignItems: 'center', justifyContent: 'center',
                }}>
                  <div style={{ fontSize: 11, color: p.inkMuted, fontWeight: 600 }}>내 지분</div>
                  <div className="mono" style={{ fontSize: 28, fontWeight: 800, color: p.accent, letterSpacing: '-0.02em' }}>8.7%</div>
                </div>
              </div>
              <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 6 }}>
                {STAKES.slice(0, 6).map((s, i) => (
                  <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12 }}>
                    <span style={{ width: 8, height: 8, borderRadius: 2, background: s.isMe ? p.accent : ['#0E1240','#3F4474','#5e6385','#8A8FB5','#cfd2e6','#dde0f3'][i % 6] }} />
                    <span style={{ color: s.isMe ? p.accent : p.ink, fontWeight: s.isMe ? 700 : 500, flex: 1 }}>{s.name}{s.isMe && ' (나)'}</span>
                    <span className="mono" style={{ color: p.inkMuted, fontSize: 11 }}>{s.days}일</span>
                    <span className="mono" style={{ color: s.isMe ? p.accent : p.inkSoft, fontWeight: 700, width: 50, textAlign: 'right' }}>{(s.ratio * 100).toFixed(1)}%</span>
                  </div>
                ))}
              </div>
            </div>
          </Card>
        </div>

        {/* Bottom row — Escrow source + formula + 3-way win */}
        <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr 1fr', gap: 16 }}>
          <Card p={p} padding={20}>
            <div style={{ fontSize: 13, color: p.inkMuted, fontWeight: 700, marginBottom: 12 }}>에스크로 누적 추이</div>
            <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', marginBottom: 12 }}>
              <div>
                <div className="mono" style={{ fontSize: 32, fontWeight: 800, color: p.ink, letterSpacing: '-0.025em' }}>
                  {fmt.point(totalEscrow)}<span style={{ fontSize: 14, color: p.inkMuted, marginLeft: 4 }}>P</span>
                </div>
                <div style={{ fontSize: 12, color: p.inkMuted }}>현재 잔액 · 4월 2일 기준</div>
              </div>
              <Pill p={p} tone="success" size="sm">12/31 배당 재원</Pill>
            </div>
            <Spark data={[12,18,22,38,55,72,94,118,142,165,178,187]} w={420} h={80} color={p.accent} fill={p.accentSoft} />
            <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 6, fontSize: 10, color: p.inkMuted }}>
              <span>1월</span><span>2월</span><span>3월</span><span>4월</span><span>...</span><span>12월</span>
            </div>
          </Card>

          <Card p={p} padding={20}>
            <div style={{ fontSize: 13, color: p.inkMuted, fontWeight: 700, marginBottom: 14 }}>내 배당 계산식</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <FormulaRow p={p} k="에스크로 잔액" v={`${fmt.point(totalEscrow)} P`} />
              <FormulaRow p={p} k="× 내 지분율" v="× 0.087" />
              <div style={{ height: 1, background: p.line, margin: '4px 0' }} />
              <FormulaRow p={p} k="raw_dividend" v="16,286.4 P" muted />
              <FormulaRow p={p} k="floor()" v={`${fmt.point(myDividend)} P`} muted />
              <div style={{ padding: 12, background: p.accentSoft, borderRadius: 10, marginTop: 4 }}>
                <div style={{ fontSize: 11, color: p.accent, fontWeight: 700, marginBottom: 4 }}>최종 배당금</div>
                <div className="mono" style={{ fontSize: 22, fontWeight: 800, color: p.accent, letterSpacing: '-0.02em' }}>
                  {fmt.point(myDividend)} P
                </div>
              </div>
            </div>
          </Card>

          <Card p={p} padding={20}>
            <div style={{ fontSize: 13, color: p.inkMuted, fontWeight: 700, marginBottom: 12 }}>3-Way Win</div>
            {[
              { who: '회사', color: p.ink, bg: p.bg, value: '예산 0원 선투입', desc: '재무 리스크 0%' },
              { who: '판매자 (나)', color: p.accent, bg: p.accentSoft, value: `+${fmt.point(myDividend)}P`, desc: '소멸 예정이던 연차 → 배당' },
              { who: '구매자', color: p.success, bg: '#E6F6F0', value: '연차 +1일', desc: '원할 때 사용' },
            ].map((w, i) => (
              <div key={i} style={{
                padding: 12, marginBottom: 8, borderRadius: 10,
                background: w.bg, display: 'flex', alignItems: 'center', gap: 12,
              }}>
                <div style={{
                  width: 32, height: 32, borderRadius: '50%', background: w.color,
                  color: '#fff', fontSize: 14, fontWeight: 800,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}>{i+1}</div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 11, color: w.color, fontWeight: 700 }}>{w.who}</div>
                  <div style={{ fontSize: 13, color: p.ink, fontWeight: 700, marginTop: 1 }}>{w.value}</div>
                </div>
                <div style={{ fontSize: 10, color: p.inkMuted, textAlign: 'right', maxWidth: 90 }}>{w.desc}</div>
              </div>
            ))}
          </Card>
        </div>
      </div>
    </div>
  );
}

function FormulaRow({ p, k, v, muted }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 13 }}>
      <span style={{ color: muted ? p.inkMuted : p.inkSoft, fontWeight: muted ? 500 : 600 }}>{k}</span>
      <span className="mono" style={{ color: muted ? p.inkMuted : p.ink, fontWeight: 700 }}>{v}</span>
    </div>
  );
}

window.Dividend = Dividend;
