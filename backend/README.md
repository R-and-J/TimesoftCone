# TimesoftCone Backend

연차 경매 시스템 — NestJS + TypeScript + Prisma + SQLite.

**현재 스코프**: Wallet/Ledger 기반 + Auction 도메인 + 입찰/낙찰 로직.
잘라낸 항목은 [`scope-cuts.md`](../06_tech/scope-cuts.md) 참고.

## 실행

```powershell
cd backend
npm install
copy .env.example .env
npm run db:migrate         # SQLite dev.db 생성 (DB 컨테이너 불필요)
npm run db:seed
npm run start:dev          # → http://localhost:3001
```

## API

### 경매 — 공개

| 메서드 | 경로 | 용도 |
|---|---|---|
| `GET`  | `/api/auctions?status=OPEN,CREATED` | 경매 목록 (Grid/Row/Timeline 화면) |
| `GET`  | `/api/auctions/:id`                  | 경매 상세 + 최근 입찰 기록 (입찰 상세 화면) |
| `POST` | `/api/auctions/:id/bids`             | 입찰 (body: `userId`, `amount`) |

### 경매 — 관리자

| 메서드 | 경로 | 용도 |
|---|---|---|
| `POST` | `/api/admin/auctions`             | 신규 경매 생성 |
| `POST` | `/api/admin/auctions/:id/settle`  | 경매 종료 (AWARDED/UNSOLD 확정) |
| `POST` | `/api/admin/auctions/settle-due`  | 마감된 OPEN 경매 일괄 정산 (cron 수동 트리거) |

### 사용자

| 메서드 | 경로 | 용도 |
|---|---|---|
| `GET`  | `/api/users/:userId/activity` | 거래 내역 + 요약 (내 활동 화면) |
| `GET`  | `/api/users/:userId/balance`  | 현재 포인트 잔액 |

### 인증 (데모)

| 메서드 | 경로 | 용도 |
|---|---|---|
| `POST` | `/api/auth/login`             | 사번(`empId`)으로 로그인. 비밀번호 검증 없음 — [CUT-8](../06_tech/scope-cuts.md) |

### 배당 (Dividend 화면용)

| 메서드 | 경로 | 용도 |
|---|---|---|
| `GET`  | `/api/dividend/me/:userId`    | 내 지분율 + 예상 배당금 + 상위 9명 stake 분포 |

### 관리자 — 통계 / 원장

| 메서드 | 경로 | 용도 |
|---|---|---|
| `GET`  | `/api/admin/stats`            | 에스크로 잔액 (NFR-2 등식) + 경매 카운트 (AdminOps KPI) |
| `GET`  | `/api/admin/ledger`           | 원장 검색 (`?actionTypes=BID,REFUND&from=ISO&to=ISO&limit=50&cursor=BIGINT`) |

### 지갑 — 관리자

| 메서드 | 경로 | 용도 |
|---|---|---|
| `POST` | `/api/admin/wallet/credit`    | 관리자 포인트 적립 (audit `reason` 필수) |
| `GET`  | `/api/wallet/:userId`         | (legacy) 잔액 조회 |

> ⚠️ 모든 `/api/admin/*` 라우트는 인증/권한 미적용 ([scope-cuts.md CUT-8](../06_tech/scope-cuts.md)). 데모 환경 전용.

## 자동 정산 스케줄러

`SettleDueAuctionsScheduler`가 시작 시 1회 + 매 `SETTLE_INTERVAL_MS` (기본 60초) 마다 마감된 OPEN 경매를 찾아 정산합니다.

- 비활성화: `.env`에 `SETTLE_INTERVAL_MS=0`
- 데모 빠르게 보기: `.env`에 `SETTLE_INTERVAL_MS=10000` (10초)
- 즉시 1회 실행: `curl -X POST http://localhost:3001/api/admin/auctions/settle-due`

scope-cuts.md CUT-5 (anti-snipe)는 여전히 미구현이라, 마감 시각 이후 들어오는 입찰은 다음 tick에서 그대로 거부됩니다.

## 시나리오: 입찰 → 자동 환불 → 자동 낙찰

```powershell
# 시드 직후: A-2026-106 highest=5000(시작가), bidCount=0
curl http://localhost:3001/api/auctions/A-2026-106

# 1) 이도현(id=3)이 5,200P 입찰
curl -X POST http://localhost:3001/api/auctions/A-2026-106/bids `
  -H "Content-Type: application/json" `
  -d '{\"userId\":3,\"amount\":5200}'
# → newHighest=5200, refundedTo=null

# 2) 박서연(id=4)이 5,400P 입찰 → 이도현은 자동 환불받음
curl -X POST http://localhost:3001/api/auctions/A-2026-106/bids `
  -H "Content-Type: application/json" `
  -d '{\"userId\":4,\"amount\":5400}'
# → newHighest=5400, refundedTo=3, refundedAmount=5200

# 3) 이도현의 잔액 확인 → 차감된 5,200이 다시 들어와 있어야 함
curl http://localhost:3001/api/users/3/balance

# 4) 이도현의 활동 로그 → BID(-5200), REFUND(+5200) 두 줄
curl http://localhost:3001/api/users/3/activity

# 5) 시드 기준 A-2026-104는 ~2분 후 자동 마감.
#    그냥 기다리거나, 즉시 트리거 가능:
curl -X POST http://localhost:3001/api/admin/auctions/settle-due
# → { attempted, settled, failed, outcomes: [...] }
```

검증 포인트:
- 박서연 잔액에서 5,400 차감 (BID)
- 이도현의 5,200 BID는 그대로 두고, **새로운** REFUND +5,200 INSERT (Insert-Only)
- 경매 `highest=5400`, `bidCount=2`, `highestBidder=4`
- 정산 후 `status=AWARDED`, WIN 원장 (amount=0, audit-only) INSERT
- 백엔드 로그에 `SettleDueAuctionsUseCase` 메시지가 찍힘

## 아키텍처

```
src/
├── domain/            ← 외부 라이브러리 무의존
│   ├── shared/value-objects/  (Point · UserId · AuctionId · Currency)
│   ├── wallet/                (Wallet aggregate)
│   ├── ledger/                (LedgerEntry · LedgerActionType · TransactionRef)
│   └── auction/               (Auction · AuctionStatus · errors)
├── ports/             ← outbound interfaces
│   ├── wallet-repository.ts
│   ├── ledger-repository.ts
│   ├── auction-repository.ts
│   ├── bidding-currency.ts
│   └── unit-of-work.ts        ← 트랜잭션 + write 락(lockAuction) 추상화
├── application/       ← Use Cases
│   ├── wallet/   GetWalletBalance · CreditWalletAdmin
│   ├── auction/  CreateAuction · ListAuctions · GetAuctionDetail · PlaceBid · SettleAuction
│   └── user/     ListMyActivity
├── adapters/
│   ├── persistence/  PrismaService · Prisma{Wallet,Ledger,Auction}Repository · PrismaUnitOfWork
│   └── currency/     WelfarePointProvider
└── interfaces/http/  Wallet · AdminWallet · Auctions · AdminAuctions · Me + zod pipe + bigint interceptor
```

## 입찰 트랜잭션 흐름 (가장 중요한 부분)

`PlaceBidUseCase`가 단일 SQLite 트랜잭션에서:

```
1. UPDATE auction SET id=id WHERE id = ?            ← write 락 선점, 동일 경매 동시 입찰 직렬화 (CUT-1)
2. SELECT auction WHERE id = ?
3. auction.placeBid(bidder, amount, now)           ← 도메인 검증
4. 이전 최고가 입찰자 있으면:
   - prev_wallet.balance += prev_amount            (REFUND)
   - INSERT ledger_entry (REFUND, +prev_amount, ...)
5. 새 입찰자:
   - new_wallet.balance -= amount                  (InsufficientPointError 가능)
   - INSERT ledger_entry (BID, -amount, ...)
6. UPDATE auction SET highest, highest_bidder_id, bid_count++
7. INSERT bid_event (audit log)
8. COMMIT
```

어디서든 throw → 전체 ROLLBACK → wallet/ledger/auction 일관성 유지.

## 인바리언트 검증 위치

| 인바리언트 | 코드 | DB |
|---|---|---|
| Insert-Only 원장 | `LedgerRepository`에 update/delete 없음 | `reject_ledger_mutation()` 트리거 |
| Point 음수 불가 | `Point.of()` 검증 | `wallet.balance_nonnegative` CHECK |
| 동일 경매 동시 입찰 직렬화 | `PrismaUnitOfWork.lockAuction` | no-op `UPDATE` (SQLite write 락) |
| 입찰 = 최고가 + 최소 증분 | `Auction.placeBid()` 가드 | (도메인 책임) |
| 같은 사람 연속 입찰 금지 | `Auction.placeBid()` 가드 | (도메인 책임) |
| 마감 후 입찰 거부 | `Auction.placeBid()` 가드 | (도메인 책임) |
| WIN amount=0 (이미 차감됨) | `SettleAuction` 로직 | (도메인 책임) |
| `CREDIT_ADMIN`은 reason 필수 | `LedgerEntry.create()` | `ledger_credit_admin_needs_note` CHECK |
| 도메인 무외부 의존 | ESLint `boundaries` 규칙 | — |

## 테스트

```powershell
npm test
```

도메인 단위 테스트 5개 — Point, UserId, AuctionId, Wallet, Auction. Prisma/DB 없이 순수 실행.

어댑터 통합 테스트(testcontainers)는 별도 PR.

## 자른 것들

자세한 내역과 되돌리는 비용은 [`scope-cuts.md`](../06_tech/scope-cuts.md). 요약:

- **CUT-1**: Redis 분산 락 → SQLite write 락(`lockAuction` no-op UPDATE)
- **CUT-2**: in-process 도메인 이벤트 버스 → use case가 직접 호출
- **CUT-3**: State Pattern → `AuctionStatus` enum + 가드 절
- **CUT-4**: Outbox → 외부 호출 없으니 생략 (ADR-005 dormant)
- **CUT-5**: Anti-snipe 마감 연장 → 미구현
- **CUT-6**: WebSocket 실시간 → 프론트 폴링
- **CUT-8**: 인증/RBAC → 별도 PR

## 후속 PR

| PR | 내용 |
|---|---|
| Auth | 인증 + RBAC + admin 경로 보호 |
| Leave | LeaveGrantPort + InternalLeaveAdapter ([ADR-016](../04_decisions/ADR-016-internal-leave-system.md)) |
| LeavePool | 연말 배당 잡 + LeavePool 컨텍스트 ([ADR-008](../04_decisions/ADR-008-year-end-dividend.md), [ADR-017](../04_decisions/ADR-017-leave-pool-context.md)) |
| Tests | 어댑터 통합 테스트 (testcontainers) |
| CUT 부활 | WebSocket / Anti-snipe / 도메인 이벤트 |

## 참고

- [CLAUDE.md](../CLAUDE.md) — 하드 인바리언트
- [`06_tech/scope-cuts.md`](../06_tech/scope-cuts.md) — 잘라낸 것 추적
- [`04_decisions/`](../04_decisions/) — ADR 원본 18개
