# Handoff: TimesoftCone · 연차 경매 시스템

> 사내 연차(휴가) 자산을 포인트로 환산해 경매·재분배·연말 배당하는 인하우스 시스템의 디자인 핸드오프 패키지입니다.

## 📌 빠르게 시작하려면

1. `tokens/globals.css` 를 프로젝트 `globals.css` 에 머지
2. `tokens/tailwind.config.snippet.ts` 를 `tailwind.config.ts` 에 머지
3. `component_inventory.md` 의 컴포넌트 매핑표 따라 atoms 빌드
4. `CHECKLIST.md` 순서대로 진행

상세 명세는 아래 절을 참고하세요.

---

## 1. Overview

타임소프트(주) 직원의 **남은 연차**를 사내 가상 포인트로 환산해, **공용 풀에서 1일 단위로 경매** 처리하는 사내 플랫폼입니다. 낙찰자는 연차를 즉시 부여받고, 경매로 회수된 포인트는 연말에 **지분 비례 배당**으로 직원에게 돌려줍니다.

핵심 사용자 여정:
1. 직원이 사용하지 않은 연차를 풀에 기여 → 지분 획득
2. 다른 직원이 풀의 연차권을 경매로 입찰 → 낙찰 → 즉시 연차 부여
3. 연말에 풀 잔액을 지분 비례로 배당금 환산

총 12개 화면, 5개 섹션 (진입 / 경매장 / 입찰 상세 / 내 활동 + 배당 / 관리자) 으로 구성.

## 2. About the Design Files

이 번들의 HTML 파일들은 **디자인 레퍼런스 (HTML 프로토타입)** 입니다. 직접 production 으로 쓰는 코드가 아니라, **목표 외형과 동작을 보여주는 레퍼런스**입니다.

작업 방향: **이 디자인을 타겟 코드베이스 (React + Next.js + shadcn/ui + Tailwind) 로 재구현**하세요. HTML 파일들을 그대로 import 해서 쓰지 말고, 토큰과 컴포넌트 명세를 보고 shadcn 패턴으로 새로 빌드하는 것이 옳습니다.

원본 prototyping stack:
- Vanilla React 18 (UMD CDN) + Babel standalone (브라우저 트랜스파일)
- Inline style 기반 (Tailwind 미사용) — `p` (palette) 객체를 모든 컴포넌트에 prop 으로 전파
- Pretendard Variable (한글) + JetBrains Mono (숫자/코드)

## 3. Fidelity

**High-fidelity (hifi)** 입니다.
- 모든 색상, 타이포, 간격, radius, 그림자 값이 픽셀 단위로 결정되어 있음
- 모든 화면이 1440 × 900 (입찰 상세 변주 1개만 1440 × 1180) 고정 아트보드로 그려짐
- 디자인 토큰 그대로 적용 권장 — 임의 변경 시 시각 일관성 깨짐

## 4. Tech Stack 권장

| 영역 | 권장 |
|---|---|
| 프레임워크 | Next.js 14+ (App Router) 또는 Vite + React 18 |
| 스타일 | Tailwind CSS v3 |
| 컴포넌트 | shadcn/ui (Radix 기반) |
| 아이콘 | `lucide-react` |
| 폰트 | Pretendard Variable (CDN 또는 npm `pretendard`), JetBrains Mono |
| 차트 | 직접 SVG (Donut / Spark 단순) — `recharts` 도 가능 |
| 상태 | React state + `nuqs` (URL 쿼리) — 작은 SPA 라 Redux/Zustand 불필요 |
| 실시간 | WebSocket 또는 Server-Sent Events |
| 폼 | `react-hook-form` + `zod` |

## 5. 화면 명세

각 화면은 `design_files/src/<Name>.jsx` 와 직접 대응됩니다. 화면 캡처는 `design_files/index.html` 을 브라우저에서 열어 확인하거나 (`exports/export-tool.html` 로 PNG 일괄 추출 가능), 별도 PNG 패키지가 동봉되었다면 `screenshots/` 폴더 참고.

### 01 · 로그인 (브랜드 임팩트형) — `Login.jsx`
- **목적**: 첫 진입, 브랜드 인상 각인
- **레이아웃**: 좌측 50% 브랜드 패널 (브랜드 글리프 + 카피) / 우측 50% 로그인 폼
- **컴포넌트**: `<Brand>` 큰 사이즈, `<Btn variant="primary" size="lg">` 로그인 버튼
- **사이즈**: 1440 × 900

### 02 · 로그인 (표준 사내 시스템형) — `Login.jsx` (LoginStandard)
- **목적**: 같은 기능의 보수적 변주 — 사내 시스템 톤
- **레이아웃**: 중앙 정렬 단일 카드 (440px 너비) + 우측 도움말 사이드
- **사이즈**: 1440 × 900

### 03 · 대시보드 — `Dashboard.jsx`
- **목적**: 진입 직후 잔액 / HOT 매물 / 최근 활동 한눈에 파악
- **레이아웃**: 상단 `<TopNav>` + 좌측 잔액 큰 카드 (sparkline 포함) + 우측 HOT 매물 카드 + 하단 활동 피드
- **컴포넌트**: `Card`, `Spark`, `Pill tone="live"`, `Avatar`, `Btn`

### 04 · 경매장 · 그리드 — `AuctionListGrid.jsx`
- **목적**: 진행 중/예정/마감 경매 카드형 일람
- **레이아웃**: 3-column 그리드, 상단 필터/정렬 바
- **카드**: 매물 ID, 현재가, 입찰 수, 남은 시간 펄스, 참여자 아바타 스택

### 05 · 경매장 · 리스트 — `AuctionListRow.jsx`
- **목적**: 데이터 밀도 ↑ 변주
- **레이아웃**: 1행 = 1매물, 컬럼: ID / 상태 / 현재가 / 입찰 수 / 참여자 / 마감 시각 / 액션
- **선택 사항**: 사용자가 Grid 와 비교 후 선호하는 것 결정

### 06 · 경매장 · 타임라인 — `AuctionListTimeline.jsx`
- **목적**: 주간 스케줄 변주 — 마감 시점을 시간축에 표시
- **선택 사항**: 위와 동일

### 07 · 입찰 상세 ★ — `AuctionDetail.jsx`
- **목적**: 가장 중요한 화면. 하나의 매물에 대한 입찰 진행
- **디자인 스타일**: **게임 아이템 상점 디테일 페이지** (메이플스토리 뉴네임 옥션 레퍼런스). 카지노/주식 거래 느낌 일체 배제 — 차분한 정보 전달.
- **레이아웃**: 3-column grid `440px / 1fr / 320px`
  - **LEFT** — 게임 아이템 카드 (`<ItemPortrait>` + `<DayPassCard>` + 4개 `<AttrRow>` + 출처 풀)
  - **CENTER** — 입찰 패널 (상태 strip → 현재가 52px → 진행 progress → 입찰 입력 + 빠른 칩 → 잔액 + 입찰 버튼)
  - **RIGHT** — 입찰 기록 테이블 (1위/나 뱃지, 마이 입찰 옅은 accentSoft 강조)
- **금지 패턴**: 빨간 펄스 카운트다운, 96px 거대 숫자, "LIVE" 빨간 점, 핫주식 "▲+200P" 표시, WebSocket 깜빡임 — 이전 버전에 있던 것들. 절대 부활시키지 마세요.
- **유지 패턴**: 마감 시간은 "마감까지 8분 47초" 텍스트로 차분하게, progress bar 는 accent 블루, 갱신 표시는 "이전가 8,900 P · 최고 입찰자 이도현" 같은 정보문

### 08 · 입찰 인터랙션 변주 3종 — `BidInteractions.jsx`
- **목적**: 입찰 UX A/B/C 비교 (한 카드 안 3 패턴)
- **사이즈**: 1440 × **1180** (유일한 비표준 높이)
- **선택 사항**: 채택한 변주만 구현

### 09 · 내 활동 — `MyActivity.jsx`
- **목적**: 내 거래 내역 + 보유 연차 포트폴리오
- **컴포넌트**: 거래 테이블 + `<Donut>` (보유 연차 구성)

### 10 · 연말 배당 ★ — `Dividend.jsx`
- **목적**: 연말 정산 시 지분 비례 배당금 표시
- **컴포넌트**: 큰 `<Donut>` (전체 지분 중 내 비율 강조) + 배당금 큰 숫자 + 지급 일정

### 11 · 관리자 · 운영 — `AdminOps.jsx`
- **목적**: 매물 생성/일시중지/낙찰 강제 등 운영 액션
- **컴포넌트**: KPI 카드 4종 + 운영 액션 영역

### 12 · 관리자 · 원장 — `AdminLedger.jsx`
- **목적**: 모든 포인트 이동 감사 추적
- **컴포넌트**: 대용량 테이블 (`virtualize` 권장), 필터/검색

## 6. Interactions & Behavior

### 입찰
- 사용자가 "+100P/+200P/+500P/+1000P" 칩 클릭 → 입찰가 증가
- "−"/"+" 버튼 → 최소 단위(100P) 만큼 증감
- 입찰 버튼 클릭 → 서버에 입찰 요청 → 성공 시 `recentBids` 맨 위에 추가, 현재가 갱신
- 다른 사용자가 더 높은 가격으로 입찰 시 → 알림 (토스트) + 내 입찰가 표시 갱신
- 마감 5분 이내 입찰 발생 → 마감 시각 자동 연장 (Anti-snipe)

### 마감 카운트다운
- 클라이언트 측 카운트다운, 1초마다 갱신
- 빨간색 / 펄스 / 깜빡임 **금지** — 차분한 ink 색상으로
- 마감 시각 도달 시 자동으로 `AWARDED` 상태로 전환

### 알림 (필요 시)
- 추월됨: "더 높은 입찰이 들어왔어요"
- 낙찰됨: "축하합니다! 낙찰되었습니다"
- 토스트 위치: 우상단, 4초 자동 닫힘, shadcn `sonner` 사용

### 애니메이션
- Card hover: `translateY(-2px)` + 그림자 강화, transition `0.15s`
- Btn press: `scale(0.985)`
- Pulse (LIVE 배지 등 한정): `1.4s infinite`, opacity 1↔0.4 — **입찰 상세에서는 사용 금지**

## 7. 데이터 모델

→ `component_inventory.md` 의 "4. 데이터 모델" 절 참고.

`design_files/src/data.jsx` 의 mock 을 그대로 가져다 쓰면서 백엔드 연동을 점진적으로 진행하세요.

## 8. Design Tokens

→ `tokens/globals.css` 와 `tokens/tailwind.config.snippet.ts` 참고.

핵심 값:
| 토큰 | 값 |
|---|---|
| 배경 | `#e3f0ff` (cobalt bg) |
| 카드 표면 | `#ffffff` |
| 텍스트 주 | `#0B1929` (ink) |
| 텍스트 부 | `#3b4a5e` (ink-soft) |
| 텍스트 약 | `#8392a7` (ink-muted) |
| 라인 | `#dde6f3` |
| Primary | `#1B64DA` |
| Primary soft | `#eef4ff` |
| Success | `#16A07A` |
| Warn | `#E08B19` |
| Danger | `#DC3F4A` |
| Radius | sm 8 / md 12 / lg 16 / xl 20 |
| 카드 그림자 | `0 1px 0 rgba(11,25,41,0.04), 0 8px 24px rgba(11,25,41,0.04)` |

대체 팔레트 3종 (`indigo`, `navy`, `sky`) 도 `design_files/src/tokens.jsx` 에 정의되어 있으니, 다크모드처럼 런타임 테마 스위치 구현 시 참고하세요.

## 9. Assets

- **폰트**: Pretendard Variable, JetBrains Mono — CDN 로드 사용 중 (npm 패키지로 전환 권장)
- **아이콘**: 직접 SVG (`Icon.*`) — `lucide-react` 로 전환 권장 (`component_inventory.md` 의 매핑 표)
- **이미지**: 없음. 모든 시각 요소가 SVG/CSS. 실 사용자 아바타가 필요한 경우 `<Avatar src>` 슬롯 추가 필요.
- **브랜드 글리프**: `<BrandGlyph>` SVG — 원본 `src/atoms.jsx` 의 정의 그대로 사용.

## 10. Files

```
design_handoff_timesoftcone/
├── README.md                          ← 지금 이 파일
├── CHECKLIST.md                       ← Phase 0~6 구현 체크리스트
├── component_inventory.md             ← 컴포넌트 매핑표 + variants + 데이터 모델
├── tokens/
│   ├── globals.css                    ← shadcn :root 변수 (HSL)
│   └── tailwind.config.snippet.ts     ← tailwind.config.ts 머지용
└── design_files/
    ├── index.html                     ← 디자인 캔버스 (12개 화면 한 페이지)
    ├── export.html                    ← 단일 화면 렌더링 (?screen=NAME)
    ├── exports/export-tool.html       ← PNG/PDF 일괄 추출 도구
    └── src/
        ├── tokens.jsx                 ← PALETTES, FONT, RADIUS, fmt
        ├── atoms.jsx                  ← Card, Btn, Pill, Avatar, TopNav, etc.
        ├── data.jsx                   ← Mock data (ME, AUCTIONS, FEATURED, ...)
        ├── App.jsx                    ← Design canvas 와이어링
        ├── Login.jsx
        ├── Dashboard.jsx
        ├── AuctionListGrid.jsx
        ├── AuctionListRow.jsx
        ├── AuctionListTimeline.jsx
        ├── AuctionDetail.jsx          ← ★ 입찰 상세 (메이플 옥션 스타일)
        ├── BidInteractions.jsx
        ├── MyActivity.jsx
        ├── Dividend.jsx
        ├── AdminOps.jsx
        └── AdminLedger.jsx
```

## 11. 디자인을 직접 확인하는 방법

```bash
# 1. 패키지 풀어서 디자인 캔버스 열기
cd design_files
python3 -m http.server 8080
# → http://localhost:8080/index.html
```

또는 단일 화면만 보고 싶다면:
```
http://localhost:8080/export.html?screen=auction-detail
```

가능한 `screen` 값: `login`, `login-standard`, `dashboard`, `auction-grid`, `auction-row`, `auction-timeline`, `auction-detail`, `bid-interactions`, `activity`, `dividend`, `admin-ops`, `admin-ledger`.

PNG 일괄 추출:
```
http://localhost:8080/exports/export-tool.html
→ 상단 "PNG 모두 다운로드 (ZIP)" 버튼
```

## 12. 질문 / 보류 사항

구현 시작 전에 사용자와 합의 필요한 것들 (CHECKLIST.md 의 "Out of scope" 참고):

1. **모바일 디자인 필요한지** — 현재 1440 데스크톱만 있음
2. **로그인 방식** — SSO/SAML/OAuth/사번-비번 어느 것인지
3. **실시간 통신** — WebSocket vs SSE vs Polling
4. **권한 모델** — `EMPLOYEE` / `ADMIN` 외 세분화 필요한지
5. **경매장 리스트** — Grid/Row/Timeline 중 어느 것을 메인으로 할지
6. **입찰 인터랙션 변주** — A/B/C 중 어느 것을 채택할지
7. **알림 채널** — 인앱 토스트만 vs 이메일/슬랙/푸시 포함
8. **포인트 시스템** — 1포인트 = 어느 단위인지, 환산 정책
