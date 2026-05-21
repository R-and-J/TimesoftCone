// Dashboard — Toss-style impact cards for the employee landing.
function Dashboard({ p }) {
  return (
    <div style={{ width: 1440, height: 900, background: p.bg, fontFamily: FONT.sans, display: 'flex', flexDirection: 'column' }}>
      <TopNav p={p} active="dashboard" />

      <div style={{ flex: 1, padding: '32px 40px', overflow: 'hidden' }}>
        {/* Greeting */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: 24 }}>
          <div>
            <div style={{ fontSize: 13, color: p.inkMuted, fontWeight: 500 }}>2026년 4월 2일 (수)</div>
            <div style={{ fontSize: 32, fontWeight: 800, color: p.ink, letterSpacing: '-0.025em', marginTop: 4 }}>
              안녕하세요, <span style={{ color: p.accent }}>김기철</span>님
            </div>
          </div>
          <div style={{ display: 'flex', gap: 10 }}>
            <Btn p={p} variant="ghost" size="md">
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>{Icon.cal(16)} 휴가 사용 신청</span>
            </Btn>
            <Btn p={p} variant="dark" size="md">
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>{Icon.hammer(16)} 경매장 입장</span>
            </Btn>
          </div>
        </div>

        {/* Hero row — Wallet + Stake + Live auctions */}
        <div style={{ display: 'grid', gridTemplateColumns: '1.4fr 1fr 1fr', gap: 16, marginBottom: 16 }}>
          {/* Wallet card — big number */}
          <Card p={p} padding={28} style={{ background: p.ink, color: '#fff', position: 'relative', overflow: 'hidden' }}>
            <div style={{ position: 'absolute', right: -40, bottom: -40, opacity: 0.08 }}>
              <BrandGlyph color="#fff" size={220} />
            </div>
            <div style={{ position: 'relative', zIndex: 1 }}>
              <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.6)', fontWeight: 500 }}>내 복지 포인트</div>
              <div className="mono" style={{ fontSize: 56, fontWeight: 800, letterSpacing: '-0.03em', marginTop: 6, lineHeight: 1 }}>
                12,450<span style={{ fontSize: 24, fontWeight: 600, marginLeft: 6, color: 'rgba(255,255,255,0.7)' }}>P</span>
              </div>
              <div style={{ display: 'flex', gap: 8, marginTop: 24 }}>
                <Pill p={p} tone="dark" style={{ background: 'rgba(255,255,255,0.14)', color: '#fff' }}>입찰 중 6,200 P</Pill>
                <Pill p={p} tone="dark" style={{ background: 'rgba(255,255,255,0.14)', color: '#fff' }}>사용가능 6,250 P</Pill>
              </div>
              <div style={{ display: 'flex', gap: 8, marginTop: 16 }}>
                <Btn p={p} variant="primary" size="sm">충전 내역</Btn>
                <Btn p={p} variant="ghost" size="sm" style={{ color: '#fff', borderColor: 'rgba(255,255,255,0.25)' }}>전체 원장 보기</Btn>
              </div>
            </div>
          </Card>

          {/* Predicted dividend */}
          <Card p={p} padding={24}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div style={{ fontSize: 13, color: p.inkMuted, fontWeight: 600 }}>예상 연말 배당</div>
              <Pill p={p} tone="accent" size="sm">실시간 산정</Pill>
            </div>
            <div className="mono" style={{ fontSize: 36, fontWeight: 800, color: p.ink, letterSpacing: '-0.025em', marginTop: 12 }}>
              <span style={{ color: p.success }}>+</span>3,840 <span style={{ fontSize: 16, color: p.inkMuted }}>P</span>
            </div>
            <div style={{ fontSize: 12, color: p.inkMuted, marginTop: 4 }}>지분율 8.7% · 기여 6일</div>
            <div style={{ marginTop: 16, height: 8, background: p.bg, borderRadius: 999, overflow: 'hidden' }}>
              <div style={{ width: '8.7%', height: '100%', background: p.accent, borderRadius: 999 }} />
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 8, fontSize: 11, color: p.inkMuted }}>
              <span>현재 에스크로 44,200 P</span>
              <span className="mono" style={{ fontWeight: 600 }}>8.7%</span>
            </div>
          </Card>

          {/* My leave balance */}
          <Card p={p} padding={24}>
            <div style={{ fontSize: 13, color: p.inkMuted, fontWeight: 600, marginBottom: 12 }}>내 휴가 잔여</div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8 }}>
              {[
                { k: 'REGULAR', v: 12, label: '법정', color: p.ink },
                { k: 'AUCTION', v: 3, label: '경매', color: p.accent },
                { k: 'EVENT', v: 1, label: '포상', color: p.warn },
              ].map((it) => (
                <div key={it.k} style={{ background: p.bg, borderRadius: 12, padding: 12 }}>
                  <div className="mono" style={{ fontSize: 28, fontWeight: 800, color: it.color, letterSpacing: '-0.02em' }}>{it.v}</div>
                  <div style={{ fontSize: 11, fontWeight: 700, color: it.color, marginTop: -2 }}>{it.k}</div>
                  <div style={{ fontSize: 10, color: p.inkMuted, marginTop: 2 }}>{it.label}일</div>
                </div>
              ))}
            </div>
            <div style={{ marginTop: 14, padding: 10, background: p.accentSoft, borderRadius: 10, fontSize: 11, color: p.accent, lineHeight: 1.5 }}>
              <strong>차감 순서:</strong> AUCTION → EVENT → REGULAR<br/>
              <span style={{ color: p.inkMuted, fontWeight: 500 }}>4일까지는 소멸 연차로 자동 차감됩니다.</span>
            </div>
          </Card>
        </div>

        {/* Mid row — Live auctions strip */}
        <Card p={p} padding={0} style={{ marginBottom: 16 }}>
          <div style={{ padding: '20px 24px 12px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <Pill p={p} tone="live">
                <span style={{ width: 6, height: 6, background: '#fff', borderRadius: '50%', marginRight: 2 }} />
                LIVE
              </Pill>
              <div style={{ fontSize: 17, fontWeight: 700, color: p.ink, letterSpacing: '-0.01em' }}>진행 중인 경매 4건</div>
            </div>
            <div style={{ fontSize: 13, color: p.accent, fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: 4, cursor: 'pointer' }}>
              전체보기 {Icon.chev(14, 'right')}
            </div>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 1, background: p.line, borderBottomLeftRadius: 20, borderBottomRightRadius: 20, overflow: 'hidden' }}>
            {AUCTIONS.filter(a => a.status === 'OPEN').slice(0, 4).map((a) => (
              <div key={a.id} style={{ background: p.surface, padding: 20, position: 'relative' }}>
                {a.hot && <div style={{ position: 'absolute', top: 16, right: 16 }}><Pill p={p} tone="danger" size="sm">🔥 곧 마감</Pill></div>}
                <div className="mono" style={{ fontSize: 11, color: p.inkMuted, fontWeight: 600 }}>{a.id}</div>
                <div style={{ fontSize: 13, color: p.ink, fontWeight: 700, marginTop: 4 }}>연차 1일권</div>
                <div className="mono" style={{ fontSize: 28, fontWeight: 800, color: p.ink, letterSpacing: '-0.025em', marginTop: 10 }}>
                  {fmt.point(a.highest)}<span style={{ fontSize: 14, color: p.inkMuted, marginLeft: 4 }}>P</span>
                </div>
                <div style={{ fontSize: 11, color: p.inkMuted, marginTop: 2 }}>입찰 {a.bids}회 · {a.bidders}명 참여</div>
                <div style={{ marginTop: 14, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div style={{ fontSize: 11, color: a.hot ? p.danger : p.inkMuted, fontWeight: 600 }}>{a.endLabel}</div>
                  {a.my && <Pill p={p} tone="accent" size="sm">참여 중</Pill>}
                </div>
              </div>
            ))}
          </div>
        </Card>

        {/* Bottom row — Quick links */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16 }}>
          {[
            { i: Icon.hammer(22), t: '경매장 둘러보기', s: '오늘 진행 중인 4건', tone: 'accent' },
            { i: Icon.gift(22), t: '연말 배당 시뮬레이션', s: '내 지분 8.7% 상세 분석', tone: 'success' },
            { i: Icon.ledger(22), t: '내 거래 내역', s: '입찰 12건 · 낙찰 1건', tone: 'warn' },
            { i: Icon.spark(22), t: '연차 사용 신청', s: '그룹웨어로 연결', tone: 'neutral' },
          ].map((it, i) => {
            const toneColors = {
              accent: p.accent, success: p.success, warn: p.warn, neutral: p.inkSoft,
            }[it.tone];
            return (
              <Card key={i} p={p} padding={20} hover>
                <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                  <div style={{ width: 44, height: 44, borderRadius: 12, background: p.bg, color: toneColors, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    {it.i}
                  </div>
                  <div>
                    <div style={{ fontSize: 14, fontWeight: 700, color: p.ink }}>{it.t}</div>
                    <div style={{ fontSize: 12, color: p.inkMuted, marginTop: 2 }}>{it.s}</div>
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
      </div>
    </div>
  );
}

window.Dashboard = Dashboard;
