// Auction list — DENSE ROW layout (table-y, more data dense)
function AuctionListRow({ p }) {
  const items = [
    ...AUCTIONS.filter(a => a.status === 'OPEN'),
    ...AUCTIONS.filter(a => a.status === 'CREATED').slice(0, 2),
  ];
  return (
    <div style={{ width: 1440, height: 900, background: p.bg, fontFamily: FONT.sans, display: 'flex', flexDirection: 'column' }}>
      <TopNav p={p} active="auction" />
      <div style={{ flex: 1, padding: '28px 40px', overflow: 'hidden' }}>
        <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', marginBottom: 20 }}>
          <div>
            <div style={{ fontSize: 13, color: p.inkMuted, fontWeight: 500 }}>경매장</div>
            <div style={{ fontSize: 30, fontWeight: 800, color: p.ink, letterSpacing: '-0.025em', marginTop: 4 }}>
              진행 중인 경매 <span className="mono" style={{ color: p.accent }}>{items.length}</span>건
            </div>
          </div>
          <div style={{ display: 'flex', background: p.surface, borderRadius: 12, padding: 4, border: `1px solid ${p.line}` }}>
            {['그리드', '리스트', '타임라인'].map((v, i) => (
              <div key={v} style={{
                padding: '8px 14px', fontSize: 13, fontWeight: 600,
                background: i === 1 ? p.ink : 'transparent',
                color: i === 1 ? '#fff' : p.inkMuted,
                borderRadius: 8, cursor: 'pointer',
              }}>{v}</div>
            ))}
          </div>
        </div>

        <Card p={p} padding={0}>
          {/* header */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: '60px 110px 100px 1.2fr 1fr 0.8fr 1.2fr 120px',
            gap: 16, padding: '14px 24px', fontSize: 12, color: p.inkMuted, fontWeight: 600,
            borderBottom: `1px solid ${p.line}`, alignItems: 'center',
          }}>
            <div>상태</div><div>경매 ID</div><div>매물</div>
            <div style={{ textAlign: 'right' }}>현재 최고가</div>
            <div>최근 입찰</div>
            <div>참여</div>
            <div>마감</div>
            <div></div>
          </div>
          {items.map((a, i) => (
            <div key={a.id} style={{
              display: 'grid',
              gridTemplateColumns: '60px 110px 100px 1.2fr 1fr 0.8fr 1.2fr 120px',
              gap: 16, padding: '18px 24px', alignItems: 'center',
              borderBottom: i === items.length - 1 ? 'none' : `1px solid ${p.line}`,
              background: a.hot ? `linear-gradient(90deg, ${p.surface} 0%, #FFF6F7 100%)` : p.surface,
            }}>
              <div>
                {a.status === 'OPEN'
                  ? <Pill p={p} tone={a.hot ? 'live' : 'success'} size="sm">{a.hot ? '🔥' : 'LIVE'}</Pill>
                  : <Pill p={p} tone="neutral" size="sm">예정</Pill>}
              </div>
              <div className="mono" style={{ fontSize: 12, color: p.inkSoft, fontWeight: 600 }}>{a.id}</div>
              <div style={{ fontSize: 13, color: p.ink, fontWeight: 600 }}>연차 1일권</div>
              <div className="mono" style={{ textAlign: 'right', fontSize: 22, fontWeight: 800, color: p.ink, letterSpacing: '-0.02em' }}>
                {fmt.point(a.highest)}<span style={{ fontSize: 12, color: p.inkMuted, marginLeft: 3, fontWeight: 600 }}>P</span>
              </div>
              <div>
                {a.status === 'OPEN' ? (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <Avatar p={p} name={TEAM[(a.bids || 0) % TEAM.length].name} size={26} />
                    <div style={{ fontSize: 12 }}>
                      <div style={{ color: p.ink, fontWeight: 600 }}>{TEAM[(a.bids || 0) % TEAM.length].name}</div>
                      <div style={{ color: p.inkMuted, fontSize: 10 }}>방금</div>
                    </div>
                  </div>
                ) : <span style={{ color: p.inkMuted, fontSize: 12 }}>—</span>}
              </div>
              <div style={{ fontSize: 13, color: p.inkSoft }}>
                <span className="mono" style={{ fontWeight: 700, color: p.ink }}>{a.bids}</span>회 · {a.bidders}명
              </div>
              <div style={{ fontSize: 12, color: a.hot ? p.danger : p.inkSoft, fontWeight: a.hot ? 700 : 500 }}>
                {a.endLabel}
                {a.status === 'OPEN' && (
                  <div className="mono" style={{ fontSize: 11, color: p.inkMuted, marginTop: 2 }}>{a.end}</div>
                )}
              </div>
              <div style={{ display: 'flex', gap: 6, justifyContent: 'flex-end' }}>
                {a.my && <Pill p={p} tone="accent" size="sm">참여 중</Pill>}
                <Btn p={p} variant={a.hot ? 'primary' : 'soft'} size="sm">
                  {a.status === 'OPEN' ? '입찰' : '상세'}
                </Btn>
              </div>
            </div>
          ))}
        </Card>

        {/* footer summary */}
        <div style={{ display: 'flex', gap: 16, marginTop: 16 }}>
          {[
            { k: '진행 중', v: AUCTIONS.filter(a => a.status === 'OPEN').length },
            { k: '오픈 예정', v: AUCTIONS.filter(a => a.status === 'CREATED').length },
            { k: '내가 참여 중', v: 2 },
            { k: '오늘 마감', v: 2 },
          ].map((s, i) => (
            <Card key={i} p={p} padding={16} style={{ flex: 1 }}>
              <div style={{ fontSize: 12, color: p.inkMuted, fontWeight: 600 }}>{s.k}</div>
              <div className="mono" style={{ fontSize: 24, fontWeight: 800, color: p.ink, marginTop: 4, letterSpacing: '-0.02em' }}>{s.v}<span style={{ fontSize: 12, color: p.inkMuted, marginLeft: 4, fontWeight: 500 }}>건</span></div>
            </Card>
          ))}
        </div>
      </div>
    </div>
  );
}

window.AuctionListRow = AuctionListRow;
