# 컴포넌트 인벤토리

현재 디자인은 12개 화면에서 **공유 atoms 14종**과 **도메인 컴포넌트 약 30개**를 사용합니다. shadcn 기본 컴포넌트를 베이스로 우리 prop 시그니처와 variants 를 입혀서 래핑하는 방식을 권장합니다.

---

## 1. 공유 Atoms (`src/atoms.jsx`)

| 우리 컴포넌트 | shadcn 베이스 | props | 추가 작업 |
|---|---|---|---|
| `Card` | `Card` | `padding`, `hover`, `style`, `onClick` | hover 시 translateY(-2px) + 강한 그림자, padding prop 으로 padding 제어 |
| `Btn` | `Button` | `variant: primary\|dark\|soft\|ghost\|danger`, `size: sm\|md\|lg\|xl`, `full` | size 4종 (h=36/44/56/64, br=10/12/14/16), variant 5종. shadcn 기본 default→primary, outline→ghost, destructive→danger 로 매핑하고 `dark` `soft` 추가 |
| `Pill` | `Badge` | `tone: neutral\|accent\|success\|warn\|danger\|live\|dark`, `size: sm\|md` | tone 7종, 높이 20/24, radius=999 |
| `Avatar` | `Avatar` (+ `AvatarFallback`) | `name`, `size`, `bg` | 이름 첫 글자를 표시. 이름 charCode 로 6가지 색상 중 결정. `name.charCodeAt(0) % 6` |
| `TopNav` | 직접 빌드 | `active`, `user`, `role` | 60px 고정, 좌측 Brand + 5개 메뉴 탭 + 우측 검색/벨/아바타. shadcn nav 컴포넌트 없음 |
| `Brand` | 직접 빌드 | `compact`, `color` | 워드마크 `타임소프트콘` + `BrandGlyph` |
| `BrandGlyph` | 직접 빌드 (SVG) | `color`, `size` | 40x40 viewBox, rect rounded + 모래시계 path + 중앙 점 |
| `ImgPlaceholder` | 직접 빌드 | `label`, `h`, `w` | 사선 줄무늬 배경 + 모노 라벨. 실제 이미지 자리 표시 |
| `Donut` | 직접 빌드 (SVG) | `size`, `thickness`, `segments[]`, `ringBg` | 도넛 차트. segments=`[{value, color, cap}]` |
| `Spark` | 직접 빌드 (SVG) | `data[]`, `w`, `h`, `color`, `fill` | 미니 영역 차트 |
| `SectionH` | 직접 빌드 | `eyebrow`, `title`, `action` | 아트보드 내부 섹션 헤더 |
| `Row` | 직접 빌드 | `k`, `v` | key-value 좌우 정렬 라인 (label-value 행) |
| `Icon.*` | `lucide-react` 로 교체 권장 | — | 현재 직접 SVG. lucide 의 매칭 아이콘으로 교체: arrow→ArrowRight, chev→ChevronRight, bell→Bell, search→Search, user→User, cal→Calendar, spark→Sparkles, trophy→Trophy, hammer→Hammer, coin→Coins, shield→ShieldCheck, ledger→FileText, bolt→Zap, gift→Gift, clock→Clock, check→Check, x→X, plus→Plus, sort→ArrowUpDown, filter→Filter |
| `fmt` 유틸 | 일반 함수 | — | `fmt.point(n)` = `n.toLocaleString('ko-KR')`, `fmt.pointP`, `fmt.date`, `fmt.time` |

### Btn variants 매핑표

| variant | bg | fg | border |
|---|---|---|---|
| `primary` | accent (`--primary`) | #fff | transparent |
| `dark` | ink | #fff | transparent |
| `soft` | accent-soft | accent | transparent |
| `ghost` | transparent | ink-soft | line (`--border`) |
| `danger` | danger | #fff | transparent |

### Btn size 매핑표

| size | height | padding-x | font-size | border-radius |
|---|---|---|---|---|
| `sm` | 36 | 14 | 14 | 10 |
| `md` | 44 | 18 | 15 | 12 |
| `lg` | 56 | 24 | 17 | 14 |
| `xl` | 64 | 32 | 18 | 16 |

### Pill tone 매핑표

| tone | bg | fg |
|---|---|---|
| `neutral` | `#F3F5F8` | ink-soft |
| `accent` | accent-soft | accent |
| `success` | `#E6F6F0` | success |
| `warn` | `#FFF4E0` | warn |
| `danger` | `#FDECEE` | danger |
| `live` | danger | #fff |
| `dark` | ink | #fff |

---

## 2. 도메인 컴포넌트 (화면별)

화면 안에서만 쓰이는 작은 조각들. **별도 파일로 추출하지 않아도 되지만** 재사용되는 것은 `components/domain/` 으로 분리하면 깔끔합니다.

### 입찰 상세 (`AuctionDetail.jsx`)
- `ItemPortrait` — 게임 아이템 슬롯 (220x168 카드 + dot-grid 배경 + accent glow)
- `DayPassCard` — 연차권 티켓 카드 (상단 컬러 밴드 + 천공선 + 1 DAY OFF 라벨)
- `AttrRow` — 아이콘 + 라벨 + 값 행 (아이템 속성 표시)
- `btnStep` / `chipStyle` — 입찰 +/- 버튼, 빠른 입찰 칩 (Button variant 로 흡수 가능)

### 입찰 인터랙션 (`BidInteractions.jsx`)
- 변주 3종 — 한 카드 안에 3가지 입찰 UX 옵션. **메인 디자인을 정하면 1개만 구현하면 됩니다.**

### 경매장 리스트 (`AuctionListGrid` / `AuctionListRow` / `AuctionListTimeline`)
- `AuctionCard` (Grid) — 카드형 매물
- `AuctionRowItem` (Row) — 데이터 밀도 높은 테이블 행
- `AuctionTimelineBlock` (Timeline) — 시간축 블록

→ **3가지 모두 구현할 필요 없음.** Grid 만 구현해도 핵심 기능은 다 동작. Row/Timeline 은 사용자 피드백 받고 결정.

### 대시보드 (`Dashboard.jsx`)
- `BalanceCard` — 잔액 + sparkline
- `HotAuctionCard` — HOT 매물 미니 카드
- `ActivityRow` — 최근 활동 리스트

### 내 활동 / 연말 배당 (`MyActivity` / `Dividend`)
- 도넛 차트 + 활동 히스토리 테이블 + 배당금 카드 (`Donut` atoms 재사용)

### 관리자 (`AdminOps` / `AdminLedger`)
- 운영 KPI 카드 + 원장 테이블 (감사 추적용)

---

## 3. shadcn 컴포넌트 설치 명령

```bash
# Phase 2 (베이스)
npx shadcn@latest add button card badge avatar input
npx shadcn@latest add separator label

# Phase 3 (확장)
npx shadcn@latest add tooltip dialog dropdown-menu
npx shadcn@latest add tabs progress
npx shadcn@latest add table         # 입찰 기록, 원장
npx shadcn@latest add sheet         # 모바일 메뉴 (필요 시)

# 아이콘
npm install lucide-react
```

---

## 4. 데이터 모델 (`src/data.jsx`)

목업 데이터는 `design_files/src/data.jsx` 그대로 가져다 쓰면 됩니다. 실 서비스 연동 시 schema:

```ts
type User = {
  id: number;
  name: string;
  emp: string;        // "TS-2024-018"
  role: 'EMPLOYEE' | 'ADMIN';
  team: string;
  wallet: number;     // 잔여 포인트
  stake_ratio: number;
  contributed_days: number;
};

type Auction = {
  id: string;         // "A-2026-106"
  status: 'CREATED' | 'OPEN' | 'AWARDED' | 'UNSOLD';
  startPrice: number;
  highest: number;
  prevHighest?: number;
  bids: number;       // 입찰 횟수
  bidders: number;    // 참여자 수
  startedAt: string;  // ISO
  endsAt: string;
  hot?: boolean;
  winner?: string;
  myBalance?: number;
  minIncrement: number;
  recentBids: Bid[];
};

type Bid = {
  user: string;
  amount: number;
  t: string;          // "방금" / "12초 전" — 서버 측 timestamp 로 교체
  mine: boolean;
};

type LedgerEntry = {
  t: string;          // "14:32:08"
  user: string;
  auction: string;
  type: 'BID' | 'REFUND' | 'WIN' | 'CREDIT_ADMIN' | 'DIVIDEND';
  amount: number;     // 음수 = 차감, 양수 = 적립
  balance: number;
  note?: string;
};
```
