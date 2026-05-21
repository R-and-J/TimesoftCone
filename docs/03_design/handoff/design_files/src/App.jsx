// App.jsx — wires everything into the design canvas + tweaks panel
const TWEAK_DEFAULTS = /*EDITMODE-BEGIN*/{
  "palette": "cobalt"
}/*EDITMODE-END*/;

function App() {
  const [t, setTweak] = useTweaks(TWEAK_DEFAULTS);
  const p = PALETTES[t.palette] || PALETTES.cobalt;

  return (
    <>
      <DesignCanvas>
        <DCSection id="entry" title="01 · 진입" subtitle="브랜드를 처음 마주하는 화면">
          <DCArtboard id="login" label="A · 로그인 (브랜드 임팩트형)" width={1440} height={900}>
            <Login p={p} />
          </DCArtboard>
          <DCArtboard id="login-standard" label="B · 로그인 (표준 사내 시스템형)" width={1440} height={900}>
            <LoginStandard p={p} />
          </DCArtboard>
          <DCArtboard id="dashboard" label="대시보드 · 토스 스타일 임팩트" width={1440} height={900}>
            <Dashboard p={p} />
          </DCArtboard>
        </DCSection>

        <DCSection id="auction-list" title="02 · 경매장 리스트 — 변주 3종" subtitle="레이아웃별로 동일 데이터를 다르게 다룹니다">
          <DCArtboard id="list-grid" label="A · 그리드 (토스풍 카드)" width={1440} height={900}>
            <AuctionListGrid p={p} />
          </DCArtboard>
          <DCArtboard id="list-row" label="B · 리스트 (데이터 밀도 ↑)" width={1440} height={900}>
            <AuctionListRow p={p} />
          </DCArtboard>
          <DCArtboard id="list-timeline" label="C · 타임라인 (주간 스케줄)" width={1440} height={900}>
            <AuctionListTimeline p={p} />
          </DCArtboard>
        </DCSection>

        <DCSection id="bidding" title="03 · 실시간 입찰 ★" subtitle="이 시스템의 가장 긴장감 있는 순간">
          <DCArtboard id="detail" label="입찰 상세 · 타이머 + 최고가 + 라이브 피드" width={1440} height={900}>
            <AuctionDetail p={p} />
          </DCArtboard>
          <DCArtboard id="bid-variants" label="입찰 인터랙션 — 변주 3종" width={1440} height={1180}>
            <BidInteractions p={p} />
          </DCArtboard>
        </DCSection>

        <DCSection id="me" title="04 · 내 활동 + 연말 배당" subtitle="개인 가치 회수의 마지막 화면">
          <DCArtboard id="activity" label="내 활동 · 거래 내역 + 연차 포트폴리오" width={1440} height={900}>
            <MyActivity p={p} />
          </DCArtboard>
          <DCArtboard id="dividend" label="연말 배당 ★ · 지분과 배당금" width={1440} height={900}>
            <Dividend p={p} />
          </DCArtboard>
        </DCSection>

        <DCSection id="admin" title="05 · 관리자" subtitle="운영자가 보는 화면">
          <DCArtboard id="admin-ops" label="관리자 · 운영 대시보드" width={1440} height={900}>
            <AdminOps p={p} />
          </DCArtboard>
          <DCArtboard id="admin-ledger" label="관리자 · 원장 (감사 추적)" width={1440} height={900}>
            <AdminLedger p={p} />
          </DCArtboard>
        </DCSection>
      </DesignCanvas>

      <TweaksPanel title="Tweaks">
        <TweakSection label="컬러 팔레트">
          <TweakRadio
            label="팔레트"
            value={t.palette}
            options={['cobalt', 'indigo', 'navy', 'sky']}
            onChange={(v) => setTweak('palette', v)}
          />
          <div style={{ display: 'flex', gap: 8, marginTop: 12, padding: 12, background: p.bg, borderRadius: 10 }}>
            <Swatch color={p.bg} label="bg" />
            <Swatch color={p.surface} label="surface" />
            <Swatch color={p.ink} label="ink" />
            <Swatch color={p.accent} label="accent" />
          </div>
        </TweakSection>

        <TweakSection label="가이드">
          <div style={{ fontSize: 12, color: p.inkSoft, lineHeight: 1.6 }}>
            · 아트보드 우상단 ⛶ 으로 확대해서 보기<br/>
            · 캔버스 빈 곳을 드래그하면 이동<br/>
            · 스크롤로 줌 인/아웃<br/>
            · 아트보드는 드래그해서 순서 변경
          </div>
        </TweakSection>
      </TweaksPanel>
    </>
  );
}

function Swatch({ color, label }) {
  return (
    <div style={{ flex: 1, textAlign: 'center' }}>
      <div style={{ height: 28, background: color, borderRadius: 6, boxShadow: '0 0 0 1px rgba(0,0,0,0.06) inset' }} />
      <div style={{ fontSize: 9, marginTop: 4, color: '#666', fontFamily: 'monospace' }}>{label}</div>
    </div>
  );
}

ReactDOM.createRoot(document.getElementById('root')).render(<App />);
