// Auction list — GRID layout (default toss-style card grid)
function AuctionListGrid({ p }) {
  const open = AUCTIONS.filter(a => a.status === 'OPEN');
  const upcoming = AUCTIONS.filter(a => a.status === 'CREATED');
  const closed = AUCTIONS.filter(a => a.status === 'AWARDED' || a.status === 'UNSOLD');
  return (
    <div style={{ width: 1440, height: 900, background: p.bg, fontFamily: FONT.sans, display: 'flex', flexDirection: 'column' }}>
      <TopNav p={p} active="auction" />
      <div style={{ flex: 1, padding: '28px 40px', overflow: 'hidden' }}>
        <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', marginBottom: 20 }}>
          <div>
            <div style={{ fontSize: 13, color: p.inkMuted, fontWeight: 500 }}>경매장 · 2026 4월 14주차</div>
            <div style={{ fontSize: 30, fontWeight: 800, color: p.ink, letterSpacing: '-0.025em', marginTop: 4 }}>
              이번 주 오픈 <span style={{ color: p.accent }}>20일권</span> 중 <span className="mono">{open.length + upcoming.length}</span>건 진행
            </div>
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <Btn p={p} variant="ghost" size="md"><span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>{Icon.filter(14)} 필터</span></Btn>
            <Btn p={p} variant="ghost" size="md"><span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>{Icon.sort(14)} 마감 임박순</span></Btn>
            <div style={{ display: 'flex', background: p.surface, borderRadius: 12, padding: 4, border: `1px solid ${p.line}` }}>
              {['그리드', '리스트', '타임라인'].map((v, i) => (
                <div key={v} style={{
                  padding: '8px 14px', fontSize: 13, fontWeight: 600,
                  background: i === 0 ? p.ink : 'transparent',
                  color: i === 0 ? '#fff' : p.inkMuted,
                  borderRadius: 8, cursor: 'pointer',
                }}>{v}</div>
              ))}
            </div>
          </div>
        </div>

        {/* Tabs */}
        <div style={{ display: 'flex', gap: 4, marginBottom: 16, borderBottom: `1px solid ${p.line}` }}>
          {[
            { l: '진행 중', n: open.length, on: true },
            { l: '오픈 예정', n: upcoming.length },
            { l: '마감', n: closed.length },
            { l: '내가 참여 중', n: 2 },
          ].map((t, i) => (
            <div key={i} style={{
              padding: '12px 18px', fontSize: 14, fontWeight: 700,
              color: t.on ? p.ink : p.inkMuted,
              borderBottom: `2px solid ${t.on ? p.accent : 'transparent'}`,
              marginBottom: -1, cursor: 'pointer',
            }}>
              {t.l} <span style={{ color: t.on ? p.accent : p.inkMuted, marginLeft: 4 }}>{t.n}</span>
            </div>
          ))}
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16 }}>
          {open.map((a) => <AuctionCard key={a.id} p={p} a={a} />)}
          {upcoming.slice(0, 4).map((a) => <AuctionCard key={a.id} p={p} a={a} />)}
        </div>
      </div>
    </div>
  );
}

function AuctionCard({ p, a }) {
  const isOpen = a.status === 'OPEN';
  const isUpcoming = a.status === 'CREATED';
  return (
    <Card p={p} padding={20} hover style={{ position: 'relative' }}>
      {a.hot && <div style={{ position: 'absolute', top: 16, right: 16 }}><Pill p={p} tone="danger" size="sm">🔥 곧 마감</Pill></div>}
      {a.my && !a.hot && <div style={{ position: 'absolute', top: 16, right: 16 }}><Pill p={p} tone="accent" size="sm">참여 중</Pill></div>}
      {isUpcoming && <div style={{ position: 'absolute', top: 16, right: 16 }}><Pill p={p} tone="neutral" size="sm">예정</Pill></div>}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <div className="mono" style={{ fontSize: 11, color: p.inkMuted, fontWeight: 600 }}>{a.id}</div>
      </div>
      <div style={{ fontSize: 15, fontWeight: 700, color: p.ink, marginTop: 6, letterSpacing: '-0.01em' }}>연차 1일권</div>
      {isOpen ? (
        <>
          <div style={{ marginTop: 18 }}>
            <div style={{ fontSize: 11, color: p.inkMuted, fontWeight: 600, marginBottom: 4 }}>현재 최고가</div>
            <div className="mono" style={{ fontSize: 32, fontWeight: 800, color: p.ink, letterSpacing: '-0.025em', lineHeight: 1 }}>
              {fmt.point(a.highest)}<span style={{ fontSize: 14, color: p.inkMuted, fontWeight: 600, marginLeft: 4 }}>P</span>
            </div>
          </div>
          <div style={{ marginTop: 14, height: 4, background: p.bg, borderRadius: 999, overflow: 'hidden' }}>
            <div style={{ width: `${Math.min(100, a.bids * 3)}%`, height: '100%', background: a.hot ? p.danger : p.accent, borderRadius: 999 }} />
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 10, fontSize: 11, color: p.inkMuted }}>
            <span>입찰 {a.bids}회 · {a.bidders}명</span>
            <span style={{ color: a.hot ? p.danger : p.inkSoft, fontWeight: 700 }}>{a.endLabel}</span>
          </div>
        </>
      ) : (
        <>
          <div style={{ marginTop: 18 }}>
            <div style={{ fontSize: 11, color: p.inkMuted, fontWeight: 600, marginBottom: 4 }}>시작가</div>
            <div className="mono" style={{ fontSize: 28, fontWeight: 700, color: p.inkMuted, letterSpacing: '-0.025em', lineHeight: 1 }}>
              {fmt.point(a.startPrice)}<span style={{ fontSize: 13, marginLeft: 4 }}>P</span>
            </div>
          </div>
          <div style={{ marginTop: 24, fontSize: 12, color: p.inkSoft, fontWeight: 600 }}>{a.endLabel}</div>
        </>
      )}
    </Card>
  );
}

window.AuctionListGrid = AuctionListGrid;
window.AuctionCard = AuctionCard;
