// Admin OPS — auction batch open / unsold inventory management
function AdminOps({ p }) {
  return (
    <div style={{ width: 1440, height: 900, background: p.bg, fontFamily: FONT.sans, display: 'flex', flexDirection: 'column' }}>
      <TopNav p={p} active="admin" user="박부장" role="관리자" />
      <div style={{ flex: 1, padding: '24px 40px', overflow: 'hidden' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: 20 }}>
          <div>
            <div style={{ fontSize: 13, color: p.inkMuted, fontWeight: 500, display: 'flex', alignItems: 'center', gap: 6 }}>
              {Icon.shield(14)} 관리자 콘솔
            </div>
            <div style={{ fontSize: 28, fontWeight: 800, color: p.ink, letterSpacing: '-0.025em', marginTop: 4 }}>운영 대시보드</div>
          </div>
          <Btn p={p} variant="dark" size="md">
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>{Icon.plus(14)} 경매 즉시 오픈</span>
          </Btn>
        </div>

        {/* KPI strip */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 12, marginBottom: 16 }}>
          {[
            { k: '공용 풀 잔여', v: '32', sub: '연차 1일권' },
            { k: '진행 중 경매', v: '4', sub: '오늘 마감 2건' },
            { k: '에스크로 잔액', v: '187,200', sub: 'P · 정합성 ✓', mono: true },
            { k: '유찰 재고', v: '6', sub: 'EVENT 지급 대기' },
            { k: 'DLQ', v: '0', sub: 'HR API 정상', good: true },
          ].map((s, i) => (
            <Card key={i} p={p} padding={16}>
              <div style={{ fontSize: 11, color: p.inkMuted, fontWeight: 600 }}>{s.k}</div>
              <div className={s.mono ? 'mono' : ''} style={{ fontSize: 26, fontWeight: 800, color: s.good ? p.success : p.ink, marginTop: 4, letterSpacing: '-0.02em' }}>{s.v}</div>
              <div style={{ fontSize: 11, color: p.inkMuted, marginTop: 2 }}>{s.sub}</div>
            </Card>
          ))}
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1.4fr 1fr', gap: 16 }}>
          {/* LEFT — Scheduling table */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <Card p={p} padding={0}>
              <div style={{ padding: '18px 24px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: `1px solid ${p.line}` }}>
                <div>
                  <div style={{ fontSize: 16, fontWeight: 800, color: p.ink, letterSpacing: '-0.01em' }}>분산 오픈 스케줄</div>
                  <div style={{ fontSize: 12, color: p.inkMuted, marginTop: 2 }}>주당 5건 · 풀 소진까지 8주 예상</div>
                </div>
                <Btn p={p} variant="soft" size="sm">스케줄 편집</Btn>
              </div>
              <div style={{ padding: 24 }}>
                {[
                  { wk: '14주차 (4/1)', count: 5, status: '진행 중', done: 1, color: p.accent },
                  { wk: '15주차 (4/8)', count: 5, status: '예약됨', done: 0, color: p.inkMuted },
                  { wk: '16주차 (4/15)', count: 5, status: '예약됨', done: 0, color: p.inkMuted },
                  { wk: '17주차 (4/22)', count: 5, status: '예약됨', done: 0, color: p.inkMuted },
                  { wk: '18주차 (4/29)', count: 5, status: '예약됨', done: 0, color: p.inkMuted },
                  { wk: '19주차 (5/6)', count: 5, status: '예약됨', done: 0, color: p.inkMuted },
                  { wk: '20주차 (5/13)', count: 2, status: '풀 소진 예정', done: 0, color: p.warn },
                ].map((w, i) => (
                  <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 16, padding: '10px 0', borderBottom: i === 6 ? 'none' : `1px solid ${p.line}` }}>
                    <div style={{ width: 130, fontSize: 13, color: p.ink, fontWeight: 600 }}>{w.wk}</div>
                    <div style={{ flex: 1, height: 8, background: p.bg, borderRadius: 999, overflow: 'hidden' }}>
                      <div style={{ height: '100%', width: `${(w.done / w.count) * 100}%`, background: w.color, borderRadius: 999 }} />
                    </div>
                    <div className="mono" style={{ width: 60, textAlign: 'right', fontSize: 13, color: p.ink, fontWeight: 700 }}>
                      {w.done}<span style={{ color: p.inkMuted }}>/{w.count}</span>
                    </div>
                    <Pill p={p} tone={w.status === '진행 중' ? 'live' : w.status === '풀 소진 예정' ? 'warn' : 'neutral'} size="sm">{w.status}</Pill>
                  </div>
                ))}
              </div>
            </Card>

            <Card p={p} padding={20}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
                <div>
                  <div style={{ fontSize: 16, fontWeight: 800, color: p.ink, letterSpacing: '-0.01em' }}>유찰 재고 수동 지급</div>
                  <div style={{ fontSize: 12, color: p.inkMuted, marginTop: 2 }}>EVENT 속성으로 지급 · 에스크로 변동 없음</div>
                </div>
                <Pill p={p} tone="warn" size="sm">6건 대기</Pill>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8 }}>
                {['A-2026-091','A-2026-088','A-2026-076','A-2026-064','A-2026-052','A-2026-041'].map((id, i) => (
                  <div key={id} style={{
                    padding: 12, background: p.bg, borderRadius: 10,
                    display: 'flex', flexDirection: 'column', gap: 6,
                  }}>
                    <div className="mono" style={{ fontSize: 11, color: p.inkMuted, fontWeight: 600 }}>{id}</div>
                    <div style={{ fontSize: 12, color: p.ink, fontWeight: 600 }}>연차 1일권</div>
                    <Btn p={p} variant="soft" size="sm" full>직원에게 지급</Btn>
                  </div>
                ))}
              </div>
            </Card>
          </div>

          {/* RIGHT — System health */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <Card p={p} padding={20}>
              <div style={{ fontSize: 14, fontWeight: 800, color: p.ink, marginBottom: 14, letterSpacing: '-0.01em' }}>시스템 상태</div>
              {[
                { k: 'HR API (Outbox)', v: '정상', sub: 'p95 142ms', tone: 'success' },
                { k: 'Redis 분산 락', v: '정상', sub: '활성 락 0', tone: 'success' },
                { k: 'WebSocket', v: '정상', sub: '연결 24명', tone: 'success' },
                { k: '에스크로 정합성', v: '✓', sub: '마지막 검증 14:30', tone: 'success' },
                { k: 'Outbox 대기열', v: '0', sub: '재시도 0건', tone: 'success' },
                { k: 'DLQ', v: '0', sub: '관리자 개입 불필요', tone: 'success' },
              ].map((h, i) => (
                <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 0', borderBottom: i === 5 ? 'none' : `1px solid ${p.line}` }}>
                  <div style={{ width: 8, height: 8, borderRadius: '50%', background: p.success, boxShadow: `0 0 0 3px ${p.success}33` }} />
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 13, color: p.ink, fontWeight: 600 }}>{h.k}</div>
                    <div style={{ fontSize: 11, color: p.inkMuted, marginTop: 1 }}>{h.sub}</div>
                  </div>
                  <div className="mono" style={{ fontSize: 13, color: p.success, fontWeight: 700 }}>{h.v}</div>
                </div>
              ))}
            </Card>

            <Card p={p} padding={20}>
              <div style={{ fontSize: 14, fontWeight: 800, color: p.ink, marginBottom: 4, letterSpacing: '-0.01em' }}>연말 배당 카운트다운</div>
              <div style={{ fontSize: 12, color: p.inkMuted }}>2026-12-31 23:59 자동 실행</div>
              <div style={{ marginTop: 16, padding: 16, background: p.ink, borderRadius: 14, color: '#fff' }}>
                <div className="mono" style={{ fontSize: 32, fontWeight: 800, letterSpacing: '-0.02em', textAlign: 'center' }}>
                  273<span style={{ fontSize: 14, color: 'rgba(255,255,255,0.6)', marginLeft: 4 }}>일</span>
                  <span style={{ margin: '0 8px', color: 'rgba(255,255,255,0.3)' }}>·</span>
                  09<span style={{ fontSize: 14, color: 'rgba(255,255,255,0.6)', marginLeft: 4 }}>시간</span>
                </div>
              </div>
              <Btn p={p} variant="ghost" size="sm" full style={{ marginTop: 12 }}>드라이런 시뮬레이션 실행</Btn>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}

window.AdminOps = AdminOps;
