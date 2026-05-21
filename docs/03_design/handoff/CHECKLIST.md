# 구현 체크리스트

각 항목을 PR 단위로 끊어서 진행하면 안전합니다.

---

## Phase 0 — 프로젝트 셋업

- [ ] Next.js (App Router) 또는 Vite + React 프로젝트 생성
- [ ] Tailwind CSS 설치 및 초기화 (`npx tailwindcss init -p`)
- [ ] shadcn 초기화: `npx shadcn@latest init`
  - Style: **Default**
  - Base color: **Slate** (이후 token 으로 덮어쓰므로 임의)
  - CSS variables: **Yes**
- [ ] `lucide-react`, `clsx`, `tailwind-merge`, `class-variance-authority` 설치 (shadcn init 시 자동)

## Phase 1 — 토큰 적용

- [ ] `tokens/globals.css` 의 `:root` 변수를 프로젝트 `globals.css` 에 머지
- [ ] `tokens/tailwind.config.snippet.ts` 를 `tailwind.config.ts` 에 머지
- [ ] Pretendard / JetBrains Mono 폰트 로드 확인
- [ ] 동작 검증: 임시 페이지에 `bg-background text-foreground` 적용 시 `#e3f0ff` / `#0B1929` 로 표시되는지

## Phase 2 — shadcn 베이스 컴포넌트 설치

```bash
npx shadcn@latest add button card badge avatar input separator label
```

- [ ] `button.tsx` 에 우리 `Btn` 시그니처 매핑 (variant 5종 + size 4종)
  - `cva` 의 variants 에 `dark`, `soft` 추가
  - size 의 height/padding 을 우리 값으로 override
- [ ] `card.tsx` 에 `padding` prop + `hover` variant 추가
- [ ] `badge.tsx` 에 7개 tone variant 추가 (`Pill` 매핑)
- [ ] `avatar.tsx` 에 `name`, `bg` prop + 이니셜 + 결정적 색상 로직 추가
- [ ] 동작 검증: storybook 또는 임시 `/playground` 라우트에서 모든 variant 노출

## Phase 3 — 직접 빌드 atoms

- [ ] `<BrandGlyph>` — SVG 그대로 옮기기 (40x40 viewBox)
- [ ] `<Brand>` — 워드마크 + glyph 컴포지션, `compact` prop
- [ ] `<TopNav>` — 60px 헤더, 메뉴 5종(active 상태), 검색/벨/아바타 우측 그룹
- [ ] `<Donut>` — segments 배열 받아 SVG circle stroke-dasharray 로 그리기
- [ ] `<Spark>` — 라인 + 옵션 영역 채움
- [ ] `<ImgPlaceholder>` — repeating-linear-gradient + 모노 라벨
- [ ] `<SectionH>` — eyebrow + title + action
- [ ] `<Row>` — k-v 좌우 정렬
- [ ] `Icon` → `lucide-react` 매핑 표 적용 (component_inventory.md 참고)
- [ ] `fmt` 유틸 — `lib/format.ts`

## Phase 4 — 화면 구현 (우선순위 순)

추천 순서: 단순한 화면 → 복잡한 화면, 도메인 컴포넌트 의존성이 적은 순.

- [ ] **01-login** — 단순. atoms 검증 용도
- [ ] **02-login-standard** — 같은 페이지 alt 디자인 (변주 보존하려면)
- [ ] **03-dashboard** — Card / Spark / Pill 조합. 잔액 + HOT 매물 + 활동 피드
- [ ] **04-auction-grid** — Card 반복. 핵심 리스트 화면
- [ ] **05-auction-row** — (선택) 데이터 밀도 높은 alt 디자인
- [ ] **06-auction-timeline** — (선택) 주간 스케줄 alt 디자인
- [ ] **07-auction-detail ★** — 가장 복잡. 도메인 컴포넌트 4개 (ItemPortrait, DayPassCard, AttrRow, BidRow). **마지막에 진행**
- [ ] **08-bid-interactions** — 입찰 UX 변주 3종 (한 가지만 채택 권장)
- [ ] **09-activity** — 거래 내역 테이블 + 포트폴리오 도넛
- [ ] **10-dividend** — 지분 도넛 + 배당금 카드
- [ ] **11-admin-ops** — 운영 대시보드 (KPI + Live 모니터)
- [ ] **12-admin-ledger** — 원장 (대용량 테이블, virtualize 고려)

## Phase 5 — 인터랙션 / 상태

- [ ] 실시간 입찰: WebSocket / SSE — `recentBids` 자동 갱신
- [ ] 마감 타이머: 클라이언트 카운트다운 (`useInterval` 또는 `requestAnimationFrame`)
- [ ] 라우팅: Next.js App Router 기준 `/auction`, `/auction/[id]`, `/activity`, `/dividend`, `/admin/*`
- [ ] 인증: 로그인 → 토큰 보관 → TopNav 우상단 사용자 표시
- [ ] 토스트/알림: shadcn `sonner` 또는 `toast` (낙찰 / 추월 알림)

## Phase 6 — 마감

- [ ] 반응형: 디자인은 1440px 데스크톱 고정. 1024px 이하 처리 필요 시 별도 합의
- [ ] a11y: 색상 대비 (특히 `inkMuted` on `bg`) 확인
- [ ] 다국어: 현재 한국어 하드코딩. i18n 필요 시 `next-intl` 또는 `react-i18next`
- [ ] 다크모드: 디자인에 다크모드 없음. 필요 시 별도 작업

---

## Out of scope (확인 필요)

- [ ] **모바일 디자인** — 현재 데스크톱(1440)만. 모바일 전용 디자인 필요한지 확인
- [ ] **실제 로그인 플로우** — SSO/SAML/OAuth 등 어떤 방식인지
- [ ] **결제/원장 백엔드** — 트랜잭션, 멱등성, 감사 로그 정책
- [ ] **알림 시스템** — 추월/낙찰 알림 채널 (이메일/슬랙/푸시)
- [ ] **권한 모델** — `EMPLOYEE` / `ADMIN` 외 더 세분화 필요한지
