// ★ STAR SCREEN ★ — Live auction detail.
// REDESIGNED: game-item shop detail (Maplestory NewName auction reference)
// instead of stock-trading / casino feel. Calm, informational, item-centric.
function AuctionDetail({ p }) {
  const a = FEATURED;
  return (
    <div style={{ width: 1440, height: 900, background: p.bg, fontFamily: FONT.sans, display: 'flex', flexDirection: 'column' }}>
      <TopNav p={p} active="auction" />

      <div style={{ flex: 1, padding: '20px 32px 24px', overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
        {/* Breadcrumb + title row */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, color: p.inkMuted }}>
            <span style={{ cursor: 'pointer' }}>경매장</span>
            {Icon.chev(12, 'right')}
            <span style={{ cursor: 'pointer' }}>진행 중인 경매</span>
            {Icon.chev(12, 'right')}
            <span className="mono" style={{ color: p.ink, fontWeight: 700 }}>{a.id}</span>
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <Btn p={p} variant="ghost" size="sm">관심 등록</Btn>
            <Btn p={p} variant="ghost" size="sm">공유</Btn>
          </div>
        </div>

        {/* 3-column main: ITEM card | BID panel | HISTORY */}
        <div style={{ display: 'grid', gridTemplateColumns: '440px 1fr 320px', gap: 16, flex: 1, minHeight: 0 }}>

          {/* ── LEFT — Item showcase (game-item style) ───────────── */}
          <Card p={p} padding={0} style={{ display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
            {/* Item portrait slot */}
            <ItemPortrait p={p} />

            {/* Item name + meta */}
            <div style={{ padding: '20px 24px 18px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                <Pill p={p} tone="accent" size="sm">
                  <span style={{ width: 6, height: 6, background: p.accent, borderRadius: '50%', marginRight: 2 }} />
                  연차 아이템
                </Pill>
                <span className="mono" style={{ fontSize: 11, color: p.inkMuted, fontWeight: 600 }}>{a.id}</span>
              </div>
              <div style={{ fontSize: 24, fontWeight: 800, color: p.ink, letterSpacing: '-0.025em', lineHeight: 1.1 }}>
                연차 1일권
              </div>
              <div style={{ fontSize: 13, color: p.inkSoft, marginTop: 8, lineHeight: 1.5 }}>
                낙찰 시 즉시 연차 1일이 부여됩니다. 사용 시점은 자유롭게 선택할 수 있어요.
              </div>
            </div>

            {/* Item attributes — like game item stats */}
            <div style={{ padding: '0 24px 18px', display: 'flex', flexDirection: 'column', gap: 6 }}>
              <AttrRow p={p} icon={Icon.cal(14)} k="사용 기한" v="2026-12-31까지" />
              <AttrRow p={p} icon={Icon.bolt(14)} k="차감 순위" v="최우선 (1순위)" />
              <AttrRow p={p} icon={Icon.shield(14)} k="정산 영향" v="연말 수당 제외" />
              <AttrRow p={p} icon={Icon.gift(14)} k="양도 가능" v="불가 · 본인 사용만" />
            </div>

            {/* Seller pool footer */}
            <div style={{ marginTop: 'auto', padding: '14px 24px 18px', borderTop: `1px solid ${p.line}`, background: p.bg }}>
              <div style={{ fontSize: 11, color: p.inkMuted, fontWeight: 600, marginBottom: 8 }}>출처</div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <div style={{ display: 'flex' }}>
                  {['강태오', '이도현', '최예나', '박서연'].map((n, i) => (
                    <div key={n} style={{ marginLeft: i === 0 ? 0 : -8, boxShadow: `0 0 0 2px ${p.bg}`, borderRadius: '50%' }}>
                      <Avatar p={p} name={n} size={24} />
                    </div>
                  ))}
                  <div style={{ marginLeft: -8, width: 24, height: 24, borderRadius: '50%', background: p.surface, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 9, fontWeight: 700, color: p.inkSoft, boxShadow: `0 0 0 2px ${p.bg}` }}>+18</div>
                </div>
                <div style={{ fontSize: 12, color: p.inkSoft, lineHeight: 1.4 }}>
                  공용 풀 · 22명이 기여
                </div>
              </div>
            </div>
          </Card>

          {/* ── CENTER — Bid panel (calm, product-detail style) ──── */}
          <Card p={p} padding={0} style={{ display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
            {/* Status strip */}
            <div style={{
              padding: '14px 24px',
              borderBottom: `1px solid ${p.line}`,
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <Pill p={p} tone="success" size="sm">
                  <span style={{ width: 6, height: 6, background: p.success, borderRadius: '50%', marginRight: 2 }} />
                  진행 중
                </Pill>
                <span style={{ fontSize: 12, color: p.inkMuted }}>
                  <span className="mono" style={{ color: p.inkSoft, fontWeight: 600 }}>{a.bids}</span>회 입찰 · <span className="mono" style={{ color: p.inkSoft, fontWeight: 600 }}>{a.bidders}</span>명 참여
                </span>
              </div>
              <div style={{ fontSize: 12, color: p.inkMuted, display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                {Icon.clock(13)}
                마감까지 <span className="mono" style={{ color: p.ink, fontWeight: 700, marginLeft: 2 }}>8분 47초</span>
              </div>
            </div>

            {/* Current price block */}
            <div style={{ padding: '28px 28px 20px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end' }}>
                <div>
                  <div style={{ fontSize: 12, color: p.inkMuted, fontWeight: 600, marginBottom: 6 }}>현재 입찰가</div>
                  <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
                    <div className="mono" style={{ fontSize: 52, fontWeight: 800, letterSpacing: '-0.035em', color: p.ink, lineHeight: 1 }}>
                      {fmt.point(a.highest)}
                    </div>
                    <div style={{ fontSize: 20, fontWeight: 700, color: p.inkSoft }}>P</div>
                  </div>
                  <div style={{ fontSize: 12, color: p.inkMuted, marginTop: 8, display: 'flex', alignItems: 'center', gap: 6 }}>
                    <span>이전가 <span className="mono" style={{ color: p.inkSoft, fontWeight: 600 }}>{fmt.point(a.prevHighest)} P</span></span>
                    <span>·</span>
                    <span>최고 입찰자 <span style={{ color: p.ink, fontWeight: 600 }}>이도현</span></span>
                  </div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontSize: 11, color: p.inkMuted, fontWeight: 600, marginBottom: 4 }}>시작가</div>
                  <div className="mono" style={{ fontSize: 16, fontWeight: 700, color: p.inkSoft }}>
                    {fmt.point(a.startPrice)} P
                  </div>
                  <div style={{ fontSize: 11, color: p.success, fontWeight: 600, marginTop: 4 }}>
                    +{Math.round((a.highest - a.startPrice) / a.startPrice * 100)}%
                  </div>
                </div>
              </div>

              {/* Auction timeline progress (subtle, no danger color) */}
              <div style={{ marginTop: 18 }}>
                <div style={{ height: 6, background: p.bg, borderRadius: 999, overflow: 'hidden', position: 'relative' }}>
                  <div style={{ width: '94%', height: '100%', background: p.accent, borderRadius: 999 }} />
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 6, fontSize: 11, color: p.inkMuted }}>
                  <span><span className="mono">4/1 09:00</span> 시작</span>
                  <span><span className="mono">4/3 18:00</span> 마감</span>
                </div>
              </div>
            </div>

            {/* Bid input */}
            <div style={{ margin: '0 28px', padding: 20, background: p.bg, borderRadius: 16 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                <div style={{ fontSize: 13, color: p.inkSoft, fontWeight: 700 }}>입찰가 입력</div>
                <div style={{ fontSize: 11, color: p.inkMuted }}>
                  최소 입찰 단위 <span className="mono" style={{ color: p.inkSoft, fontWeight: 600 }}>+100 P</span>
                </div>
              </div>
              <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                <button style={btnStep(p)}>−</button>
                <div style={{
                  flex: 1, height: 52, borderRadius: 12, background: p.surface,
                  border: `1px solid ${p.line}`,
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 16px',
                }}>
                  <div style={{ fontSize: 11, color: p.inkMuted, fontWeight: 600 }}>내 입찰가</div>
                  <div className="mono" style={{ fontSize: 22, fontWeight: 800, color: p.ink, letterSpacing: '-0.025em' }}>
                    9,200<span style={{ fontSize: 13, color: p.inkMuted, marginLeft: 4 }}>P</span>
                  </div>
                </div>
                <button style={btnStep(p)}>+</button>
              </div>
              <div style={{ display: 'flex', gap: 6, marginTop: 10 }}>
                {[100, 200, 500, 1000].map((q) => (
                  <button key={q} className="mono" style={chipStyle(p)}>+{q} P</button>
                ))}
              </div>
            </div>

            {/* Bid submit + balance */}
            <div style={{ padding: '14px 28px 22px', display: 'flex', alignItems: 'center', gap: 12 }}>
              <div style={{ flex: 1, fontSize: 12, color: p.inkMuted }}>
                내 잔액 <span className="mono" style={{ color: p.ink, fontWeight: 700, marginLeft: 4 }}>{fmt.point(a.myBalance)} P</span>
                <span style={{ marginLeft: 8, color: p.inkMuted }}>· 입찰 후 잔액 <span className="mono" style={{ color: p.inkSoft, fontWeight: 600 }}>3,250 P</span></span>
              </div>
              <Btn p={p} variant="primary" size="lg" style={{ padding: '0 32px' }}>
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
                  {Icon.hammer(18)} 입찰하기
                </span>
              </Btn>
            </div>
          </Card>

          {/* ── RIGHT — Bid history (auction log style) ──────────── */}
          <Card p={p} padding={0} style={{ display: 'flex', flexDirection: 'column', overflow: 'hidden', minHeight: 0 }}>
            <div style={{ padding: '16px 18px 12px', borderBottom: `1px solid ${p.line}`, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ fontSize: 14, fontWeight: 800, color: p.ink, letterSpacing: '-0.01em' }}>입찰 기록</div>
              <span className="mono" style={{ fontSize: 11, color: p.inkMuted, fontWeight: 600 }}>총 {a.bids}건</span>
            </div>
            {/* Table header */}
            <div style={{
              padding: '8px 18px',
              display: 'grid', gridTemplateColumns: '1fr auto auto', gap: 10,
              fontSize: 10, color: p.inkMuted, fontWeight: 700, letterSpacing: '0.04em',
              borderBottom: `1px solid ${p.line}`,
              textTransform: 'uppercase',
            }}>
              <span>입찰자</span>
              <span style={{ textAlign: 'right' }}>금액</span>
              <span style={{ textAlign: 'right', minWidth: 50 }}>시각</span>
            </div>
            <div style={{ overflow: 'auto', flex: 1 }}>
              {a.recentBids.map((b, i) => (
                <div key={i} style={{
                  padding: '11px 18px',
                  display: 'grid', gridTemplateColumns: '1fr auto auto', gap: 10,
                  alignItems: 'center',
                  borderBottom: i < a.recentBids.length - 1 ? `1px solid ${p.line}` : 'none',
                  background: b.mine ? p.accentSoft : 'transparent',
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
                    <Avatar p={p} name={b.user} size={24} />
                    <div style={{ display: 'flex', alignItems: 'center', gap: 4, minWidth: 0 }}>
                      <span style={{ fontSize: 13, fontWeight: 600, color: p.ink, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{b.user}</span>
                      {b.mine && (
                        <span style={{ fontSize: 9, fontWeight: 700, color: p.accent, padding: '1px 5px', background: p.surface, borderRadius: 4, border: `1px solid ${p.accent}` }}>나</span>
                      )}
                      {i === 0 && (
                        <span style={{ fontSize: 9, fontWeight: 700, color: p.success, padding: '1px 5px', background: '#E6F6F0', borderRadius: 4 }}>1위</span>
                      )}
                    </div>
                  </div>
                  <div className="mono" style={{ fontSize: 13, fontWeight: 700, color: i === 0 ? p.ink : p.inkSoft, letterSpacing: '-0.01em', textAlign: 'right' }}>
                    {fmt.point(b.amount)}<span style={{ fontSize: 10, color: p.inkMuted, marginLeft: 2, fontWeight: 600 }}>P</span>
                  </div>
                  <div className="mono" style={{ fontSize: 10, color: p.inkMuted, textAlign: 'right', minWidth: 50, fontWeight: 600 }}>
                    {b.t}
                  </div>
                </div>
              ))}
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// ItemPortrait — game-item style display slot
// ─────────────────────────────────────────────────────────────
function ItemPortrait({ p }) {
  return (
    <div style={{
      height: 240,
      background: `linear-gradient(180deg, ${p.bgDeep} 0%, ${p.bg} 100%)`,
      position: 'relative',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      borderBottom: `1px solid ${p.line}`,
      overflow: 'hidden',
    }}>
      {/* Decorative grid backdrop */}
      <svg width="100%" height="100%" viewBox="0 0 440 240" preserveAspectRatio="xMidYMid slice" style={{ position: 'absolute', inset: 0, opacity: 0.4 }}>
        <defs>
          <pattern id="dotgrid" x="0" y="0" width="20" height="20" patternUnits="userSpaceOnUse">
            <circle cx="10" cy="10" r="1" fill={p.accent} opacity="0.25" />
          </pattern>
        </defs>
        <rect width="100%" height="100%" fill="url(#dotgrid)" />
      </svg>
      {/* Soft accent glow */}
      <div style={{
        position: 'absolute', width: 240, height: 240, borderRadius: '50%',
        background: `radial-gradient(circle, ${p.accent}22 0%, transparent 65%)`,
        filter: 'blur(8px)',
      }} />

      {/* The item itself — stylized "Day Pass" ticket card */}
      <div style={{ position: 'relative', zIndex: 1 }}>
        <DayPassCard p={p} />
      </div>

      {/* Rarity / tier corner */}
      <div style={{
        position: 'absolute', top: 14, left: 14,
        display: 'flex', alignItems: 'center', gap: 6,
        padding: '5px 10px', borderRadius: 8,
        background: p.surface, border: `1px solid ${p.line}`,
        fontSize: 10, fontWeight: 700, color: p.inkSoft, letterSpacing: '0.04em', textTransform: 'uppercase',
      }}>
        <span style={{ width: 6, height: 6, background: p.accent, borderRadius: 2 }} />
        Standard
      </div>
      {/* Count */}
      <div style={{
        position: 'absolute', top: 14, right: 14,
        padding: '5px 10px', borderRadius: 8,
        background: p.ink, color: '#fff',
        fontSize: 10, fontWeight: 700, letterSpacing: '0.04em',
        fontFamily: FONT.mono,
      }}>
        × 1
      </div>
    </div>
  );
}

// Stylized "vacation day pass" item card — looks like an in-game ticket item
function DayPassCard({ p }) {
  return (
    <div style={{
      width: 220, height: 168,
      background: p.surface,
      borderRadius: 14,
      border: `1.5px solid ${p.line}`,
      boxShadow: `0 8px 24px ${p.accent}1f, 0 1px 0 rgba(11,25,41,0.04)`,
      position: 'relative',
      overflow: 'hidden',
      display: 'flex', flexDirection: 'column',
    }}>
      {/* Top color band */}
      <div style={{
        height: 38, background: p.accent,
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '0 14px',
      }}>
        <div style={{ fontSize: 10, fontWeight: 800, color: '#fff', letterSpacing: '0.12em' }}>ANNUAL LEAVE</div>
        <div style={{ display: 'flex', gap: 3 }}>
          <span style={{ width: 4, height: 4, background: '#fff', borderRadius: '50%', opacity: 0.9 }} />
          <span style={{ width: 4, height: 4, background: '#fff', borderRadius: '50%', opacity: 0.6 }} />
          <span style={{ width: 4, height: 4, background: '#fff', borderRadius: '50%', opacity: 0.3 }} />
        </div>
      </div>
      {/* Perforation line */}
      <div style={{ position: 'relative', height: 0 }}>
        <div style={{
          position: 'absolute', left: -6, top: -6, width: 12, height: 12, borderRadius: '50%',
          background: p.bg,
        }} />
        <div style={{
          position: 'absolute', right: -6, top: -6, width: 12, height: 12, borderRadius: '50%',
          background: p.bg,
        }} />
        <div style={{
          position: 'absolute', left: 8, right: 8, top: -1, height: 2,
          background: `repeating-linear-gradient(90deg, ${p.line} 0 4px, transparent 4px 8px)`,
        }} />
      </div>

      {/* Body */}
      <div style={{ flex: 1, padding: '14px 16px 12px', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
        <div>
          <div style={{ fontSize: 10, color: p.inkMuted, fontWeight: 600, letterSpacing: '0.04em' }}>VALID FOR</div>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 6, marginTop: 2 }}>
            <div className="mono" style={{ fontSize: 36, fontWeight: 800, color: p.ink, letterSpacing: '-0.04em', lineHeight: 1 }}>1</div>
            <div style={{ fontSize: 14, fontWeight: 700, color: p.inkSoft }}>DAY</div>
            <div style={{ fontSize: 11, color: p.inkMuted, marginLeft: 4 }}>OFF</div>
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div className="mono" style={{ fontSize: 9, color: p.inkMuted, fontWeight: 700, letterSpacing: '0.06em' }}>NO. A-2026-106</div>
          {/* Tiny sun glyph */}
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
            <circle cx="12" cy="12" r="4" fill={p.accent} />
            <g stroke={p.accent} strokeWidth="1.8" strokeLinecap="round">
              <line x1="12" y1="2.5" x2="12" y2="5" />
              <line x1="12" y1="19" x2="12" y2="21.5" />
              <line x1="2.5" y1="12" x2="5" y2="12" />
              <line x1="19" y1="12" x2="21.5" y2="12" />
              <line x1="5" y1="5" x2="6.8" y2="6.8" />
              <line x1="17.2" y1="17.2" x2="19" y2="19" />
              <line x1="19" y1="5" x2="17.2" y2="6.8" />
              <line x1="6.8" y1="17.2" x2="5" y2="19" />
            </g>
          </svg>
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────
function AttrRow({ p, icon, k, v }) {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 10,
      padding: '8px 12px',
      background: p.bg, borderRadius: 10,
    }}>
      <span style={{ color: p.inkMuted, display: 'inline-flex' }}>{icon}</span>
      <span style={{ fontSize: 12, color: p.inkMuted, fontWeight: 500, flex: 1 }}>{k}</span>
      <span className="mono" style={{ fontSize: 12, color: p.ink, fontWeight: 700 }}>{v}</span>
    </div>
  );
}

function btnStep(p) {
  return {
    width: 44, height: 52, borderRadius: 12,
    background: p.surface, border: `1px solid ${p.line}`,
    color: p.inkSoft, fontSize: 20, fontWeight: 600,
    cursor: 'pointer', display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
    fontFamily: FONT.sans,
  };
}

function chipStyle(p) {
  return {
    padding: '6px 12px', fontSize: 12, fontWeight: 600,
    background: p.surface, color: p.inkSoft,
    borderRadius: 8, cursor: 'pointer',
    border: `1px solid ${p.line}`,
    fontFamily: FONT.mono,
  };
}

function Row({ p, k, v }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 13 }}>
      <span style={{ color: p.inkMuted }}>{k}</span>
      <span className="mono" style={{ color: p.ink, fontWeight: 700 }}>{v}</span>
    </div>
  );
}

window.AuctionDetail = AuctionDetail;
window.Row = Row;
