// Auction list — TIMELINE layout (weekly schedule with bars)
function AuctionListTimeline({ p }) {
  // Build a fake week. Hours 09:00 - 20:00.
  const hours = [9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19];
  const days = ['월 3/31', '화 4/1', '수 4/2', '목 4/3', '금 4/4'];
  // Each row -> day. Each auction has [day, startH, endH, status, label, highest, hot, my]
  const rows = [
    [
      { s: 9, e: 18, status: 'AWARDED', id: 'A-2026-100', highest: 7200, label: '낙찰 7,200P', my: false },
      { s: 13, e: 16, status: 'UNSOLD', id: 'A-2026-101', highest: 0, label: '유찰', my: false },
    ],
    [
      { s: 10, e: 18, status: 'AWARDED', id: 'A-2026-102', highest: 9400, label: '낙찰 9,400P · 이도현', my: false },
    ],
    [
      { s: 9, e: 18, status: 'AWARDED', id: 'A-2026-103', highest: 7800, label: '낙찰 7,800P · 내가 낙찰', my: true },
      { s: 10, e: 19, status: 'OPEN', id: 'A-2026-104', highest: 8400, label: '진행 중 8,400P', my: false, progress: 0.5 },
    ],
    [
      { s: 11, e: 9.5, status: 'OPEN', id: 'A-2026-106', highest: 9100, label: '⚡ 5분 후 마감 9,100P', my: false, hot: true, progress: 0.9 },
      { s: 9, e: 18, status: 'OPEN', id: 'A-2026-105', highest: 6200, label: '진행 중 6,200P · 참여 중', my: true, progress: 0.4 },
      { s: 14, e: 19, status: 'OPEN', id: 'A-2026-107', highest: 5300, label: '진행 중 5,300P', my: false, progress: 0.15 },
    ],
    [
      { s: 9, e: 13, status: 'CREATED', id: 'A-2026-108', label: '오픈 예정', my: false },
      { s: 13, e: 19, status: 'CREATED', id: 'A-2026-109', label: '오픈 예정', my: false },
    ],
  ];

  const nowCol = 5; // wed 14:00ish
  const colWidth = `repeat(${hours.length}, 1fr)`;

  const colors = {
    OPEN: { bg: p.accent, fg: '#fff' },
    AWARDED: { bg: '#D0D5DD', fg: p.ink },
    UNSOLD: { bg: '#fff', fg: p.inkMuted, border: `1px dashed ${p.line}` },
    CREATED: { bg: p.bgDeep, fg: p.inkSoft, border: `1px solid ${p.line}` },
  };

  return (
    <div style={{ width: 1440, height: 900, background: p.bg, fontFamily: FONT.sans, display: 'flex', flexDirection: 'column' }}>
      <TopNav p={p} active="auction" />
      <div style={{ flex: 1, padding: '28px 40px', overflow: 'hidden' }}>
        <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', marginBottom: 20 }}>
          <div>
            <div style={{ fontSize: 13, color: p.inkMuted, fontWeight: 500 }}>경매장 · 14주차</div>
            <div style={{ fontSize: 30, fontWeight: 800, color: p.ink, letterSpacing: '-0.025em', marginTop: 4 }}>
              주간 경매 일정
            </div>
          </div>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <Btn p={p} variant="ghost" size="sm">{Icon.chev(14, 'left')}</Btn>
            <div className="mono" style={{ fontSize: 14, color: p.ink, fontWeight: 700, padding: '0 8px' }}>3/31 — 4/4</div>
            <Btn p={p} variant="ghost" size="sm">{Icon.chev(14, 'right')}</Btn>
            <div style={{ width: 1, height: 24, background: p.line, margin: '0 8px' }} />
            <div style={{ display: 'flex', background: p.surface, borderRadius: 12, padding: 4, border: `1px solid ${p.line}` }}>
              {['그리드', '리스트', '타임라인'].map((v, i) => (
                <div key={v} style={{
                  padding: '8px 14px', fontSize: 13, fontWeight: 600,
                  background: i === 2 ? p.ink : 'transparent',
                  color: i === 2 ? '#fff' : p.inkMuted,
                  borderRadius: 8, cursor: 'pointer',
                }}>{v}</div>
              ))}
            </div>
          </div>
        </div>

        <Card p={p} padding={0} style={{ overflow: 'hidden' }}>
          {/* Hour header */}
          <div style={{ display: 'grid', gridTemplateColumns: `100px ${colWidth}`, borderBottom: `1px solid ${p.line}`, background: p.bg }}>
            <div style={{ padding: '12px 16px', fontSize: 11, color: p.inkMuted, fontWeight: 700 }}>요일 / 시간</div>
            {hours.map((h) => (
              <div key={h} style={{ padding: '12px 0', textAlign: 'center', fontSize: 11, color: p.inkMuted, fontWeight: 600, borderLeft: `1px solid ${p.line}` }}>
                <span className="mono">{String(h).padStart(2, '0')}:00</span>
              </div>
            ))}
          </div>

          {days.map((d, di) => (
            <div key={d} style={{ display: 'grid', gridTemplateColumns: `100px ${colWidth}`, position: 'relative', borderBottom: di === days.length - 1 ? 'none' : `1px solid ${p.line}`, minHeight: 90 }}>
              <div style={{ padding: '14px 16px', display: 'flex', flexDirection: 'column', justifyContent: 'center', borderRight: `1px solid ${p.line}`, background: di === 2 ? p.accentSoft : p.surface }}>
                <div style={{ fontSize: 11, color: p.inkMuted, fontWeight: 600 }}>{d.split(' ')[0]}</div>
                <div style={{ fontSize: 16, fontWeight: 800, color: p.ink, marginTop: 2 }}>{d.split(' ')[1]}</div>
                {di === 2 && <div style={{ fontSize: 10, color: p.accent, fontWeight: 700, marginTop: 2 }}>오늘</div>}
              </div>
              <div style={{ gridColumn: `2 / span ${hours.length}`, position: 'relative', padding: '10px 0' }}>
                {/* Hour grid */}
                {hours.map((h, i) => (
                  <div key={h} style={{ position: 'absolute', top: 0, bottom: 0, left: `${(i / hours.length) * 100}%`, borderLeft: i === 0 ? 'none' : `1px solid ${p.line}` }} />
                ))}
                {/* "Now" line on Wed */}
                {di === 2 && (
                  <div style={{ position: 'absolute', top: 0, bottom: 0, left: `${((14 - 9) / hours.length) * 100}%`, width: 2, background: p.danger, zIndex: 3 }}>
                    <div className="mono" style={{ position: 'absolute', top: -22, left: -22, fontSize: 10, color: p.danger, fontWeight: 700, background: p.surface, padding: '2px 6px', borderRadius: 4, border: `1px solid ${p.danger}` }}>NOW 14:08</div>
                  </div>
                )}
                {/* Bars */}
                {rows[di].map((a, i) => {
                  const start = ((a.s - 9) / hours.length) * 100;
                  const end = ((Math.max(a.s + 1, a.e) - 9) / hours.length) * 100;
                  const c = colors[a.status];
                  return (
                    <div key={i} style={{
                      position: 'absolute',
                      left: `${start}%`, width: `${end - start}%`,
                      top: 12 + i * 28, height: 24,
                      background: c.bg, color: c.fg, border: c.border,
                      borderRadius: 8, padding: '0 10px',
                      display: 'flex', alignItems: 'center', gap: 6,
                      fontSize: 11, fontWeight: 700,
                      overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis',
                      boxShadow: a.hot ? `0 0 0 2px ${p.danger}, 0 4px 10px rgba(220,63,74,0.3)` : 'none',
                      cursor: 'pointer', zIndex: a.hot ? 2 : 1,
                    }}>
                      {a.my && <span style={{ width: 6, height: 6, background: '#fff', borderRadius: '50%' }} />}
                      <span className="mono" style={{ fontSize: 10, opacity: 0.85 }}>{a.id}</span>
                      <span>·</span>
                      <span>{a.label}</span>
                      {a.status === 'OPEN' && a.progress != null && (
                        <div style={{
                          position: 'absolute', bottom: 0, left: 0,
                          height: 3, width: `${a.progress * 100}%`,
                          background: a.hot ? p.danger : 'rgba(255,255,255,0.6)',
                        }} />
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </Card>

        {/* Legend */}
        <div style={{ display: 'flex', gap: 20, marginTop: 16, fontSize: 12, color: p.inkSoft, alignItems: 'center', flexWrap: 'wrap' }}>
          <LegendDot color={p.accent} label="진행 중 (OPEN)" />
          <LegendDot color="#D0D5DD" label="낙찰 (AWARDED)" />
          <LegendDot color={p.bgDeep} label="오픈 예정 (CREATED)" />
          <LegendDot color="#fff" border={`1px dashed ${p.line}`} label="유찰 (UNSOLD)" />
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
            <span style={{ width: 6, height: 6, background: '#fff', borderRadius: '50%', boxShadow: `0 0 0 1px ${p.accent}` }} />
            내가 참여 중
          </span>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
            <span style={{ width: 2, height: 12, background: p.danger }} />
            현재 시각
          </span>
        </div>
      </div>
    </div>
  );
}

const LegendDot = ({ color, label, border }) => (
  <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
    <span style={{ width: 14, height: 10, background: color, borderRadius: 3, border: border || 'none' }} />
    {label}
  </span>
);

window.AuctionListTimeline = AuctionListTimeline;
