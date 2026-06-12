# TimesoftCone Frontend

연차 경매 시스템의 UI.

- **스택**: React 18 + Vite + TypeScript + Tailwind (디자인 토큰만)
- **백엔드 연결**: 17개 화면 컴포넌트 중 **BidInteractions(정적 비교 페이지)·Index(`/_screens` 개발용 카탈로그)를 제외한 전부가 실제 API와 통신**

## 실행

> **SQLite 파일 DB라 Docker 불필요.** 시드 DB(`backend/prisma/dev.db`)가 동봉돼 `db:migrate`/`db:seed` 없이 바로 동작.

```powershell
# 1. 백엔드 먼저 띄우기
cd backend
npm install
copy .env.example .env
npm run start:dev          # → http://localhost:3002

# 2. 별도 터미널에서 프론트
cd frontend
npm install
npm run dev                # → http://localhost:5173
```

Vite의 `/api` 프록시가 자동으로 `127.0.0.1:3002`로 포워딩합니다.

## 화면 라우트

> `/` 와 알 수 없는 경로는 `/login`으로 리다이렉트. `/admin/*`는 `RequireAdmin`, 나머지 보호 화면은 `RequireAuth` 가드 안에서만 렌더.

| 경로 | 화면 | 가드 | 데이터 |
|---|---|---|---|
| `/login` | 로그인 변주 토글 | — | **API** `POST /api/auth/login` |
| `/dashboard` | 대시보드 | Auth | **API** 잔액 + OPEN 경매 |
| `/auction` · `/auction/row` · `/auction/timeline` | 경매장 (그리드/리스트/타임라인) | Auth | **API** `/api/auctions` |
| `/auction/detail` · `/auction/detail/:id` | 입찰 상세 ★ | Auth | **API** 상세 + 입찰 POST + SSE 스트림 |
| `/auction/bid-variants` | 입찰 인터랙션 변주 | Auth | 정적 (의도) |
| `/activity` | 내 활동 | Auth | **API** `/api/users/:id/activity` + `/balance` |
| `/dividend` | 연말 배당 ★ | Auth | **API** `/api/dividend/me/:id` |
| `/redemption` | 복지 교환몰 (ADR-023) | Auth | **API** `/api/redemption/*` |
| `/admin/ops` | 관리자 운영 | Admin | **API** `/api/admin/stats` + 예정/유찰 경매 |
| `/admin/ledger` | 관리자 원장 | Admin | **API** `/api/admin/ledger` (필터+페이지) |
| `/admin/members` | 회원/권한 관리 | Admin | **API** `/api/admin/members*` |
| `/admin/auctions` | 경매 생성/스케줄/정산 | Admin | **API** `/api/admin/auctions*` |
| `/admin/redemption` | 교환 요청 승인 (ADR-023) | Admin | **API** `/api/admin/redemption-requests*` |
| `/admin/store` | 교환 품목 관리 (ADR-023) | Admin | **API** `/api/admin/redemption/items*` |
| `/_screens` | 전체 화면 카탈로그 (개발용) | — | 정적 |

## 데모 사용자 전환

두 가지 방법:

1. **로그인 화면** (`/login`)에서 사번 입력 → `POST /api/auth/login` → 자동 이동
2. **우상단 아바타** 클릭 → 시드된 9명 중 선택 (localStorage 저장)

시드 사용자: 김기철·오지석·이도현·박서연·정민우·한지윤·최예나·강태오 (직원) + 박부장 (관리자)

## E2E 데모 시나리오

### 시나리오 A: 입찰 → 자동 환불 → 정산
1. **이도현**으로 로그인
2. `/auction`에서 **A-2026-106** 클릭
3. 5,100P 입찰 → 토스트 성공
4. **박서연**으로 전환 → 같은 경매 5,300P 입찰 → "자동 환불됨"
5. 다시 **이도현** → `/activity`에서 BID(-5,100) + REFUND(+5,100) 두 줄 확인
6. `/admin/ops`에서 "마감된 경매 즉시 정산" 클릭 (A-2026-104는 2분 후 자동 마감)

### 시나리오 B: 배당 가시화
1. **강태오**로 로그인 (contributedDays=14, 최다 기여자)
2. `/dividend` → 지분율 23.3% · 1위 표시
3. **김기철**로 전환 → 지분율 10% · 5위 (기여 6일)
4. 5명이 입찰/환불을 몇 번 돌리면 에스크로 잔액이 증가 → 다시 `/dividend` 새로고침하면 배당금 액수 변동

### 시나리오 C: 원장 감사
1. **박부장**으로 전환
2. `/admin/ledger` → 모든 거래 시간순 표시
3. action_type 필터 (BID만 / REFUND만) 토글 → 즉시 재조회
4. 50건 이상이면 "더 보기" 페이지네이션

## 폴더 구조

```
src/
├── main.tsx                 ← CurrentUserProvider + ToastProvider
├── App.tsx                  ← HashRouter
├── styles/globals.css
├── lib/
│   ├── api.ts               ← fetch + ApiError
│   ├── queries.ts           ← 모든 API 함수 (auctions·dividend·admin·auth·activity)
│   ├── use-query.ts         ← 마운트 fetch + refetch
│   ├── current-user.tsx     ← 9명 데모 사용자, localStorage 저장
│   ├── toast.tsx            ← 우상단 토스트
│   └── tokens.ts
├── components/
│   ├── ScreenFrame.tsx
│   ├── ListVariantSwitcher.tsx
│   ├── icons.tsx
│   └── atoms/
└── pages/  (17개)
```

## 백엔드 응답 처리

백엔드는 bigint를 **문자열**로 직렬화 (`BigIntInterceptor`). 프론트 타입에서 `balance: string`으로 받고 표시 직전 `Number(s)` 변환. 금액 ≤ 10^7이라 float64 안전.

## 빌드

```powershell
npm run build              # tsc + Vite 번들
npm run preview            # 빌드 결과 미리보기 (4173)
```

## Mock vs Real — 어떤 데이터가 실제 백엔드에서 오는가

| 화면 | Real (백엔드) | Mock (정적) — 라벨 표시 |
|---|---|---|
| Dashboard | 잔액 · OPEN 경매 strip · 예상 배당 · **휴가 잔여** | — |
| AuctionListGrid/Row/Timeline | 전부 | — |
| AuctionDetail | 전부 (입찰 동작·기록 포함) | — |
| MyActivity | 거래 내역 · 요약 · 잔액 · **휴가 잔여** · 내가 최고가인 입찰 | — |
| Dividend | 배당 액수 · 도넛 · 상위 기여자 · 계산식 | 에스크로 누적 추이 시계열 (월별 집계 endpoint 없음) |
| AdminOps | KPI · 예정/유찰 · 즉시 정산 · D-day | 시스템 상태 (probe 미구현) |
| AdminLedger | 전부 (필터+페이지) | — |
| Login | 전부 (사번 조회) | — |
| Redemption / AdminStore / AdminRedemption | 전부 (교환 품목·요청 — ADR-023) | — |
| AdminMembers | 전부 (회원 조회·동기화·ROLE 변경) | — |
| AdminAuctions | 전부 (경매 생성·스케줄·정산·취소) | — |
| BidInteractions / Index(`/_screens`) | — | 정적 (의도) |

Mock 항목은 모두 "(데모)" 또는 명확한 Pill 라벨로 표시됨.

## 알려진 한계

- **AuctionListTimeline** — endsAt 기준 5일 윈도우에 분배하는 *근사 표현*. 픽셀-퍼펙트 캘린더 아님.
- 자동 정산 cron으로 시드 직후 약 2분 뒤 A-2026-104가 사라집니다.

> 과거 한계였던 "세션 없음"·"권한 가드 없음"(CUT-8)은 **해소됨**: 로그인이 JWT를 발급하고(`POST /api/auth/login`),
> `RequireAuth`/`RequireAdmin` 라우트 가드 + 백엔드 전역 가드 3종(`JwtAuthGuard`→`RolesGuard`→`SelfOrAdminGuard`)으로 RBAC이 적용된다.
