# TimesoftCone Backend

연차 경매 시스템 — NestJS + TypeScript + Prisma + SQLite.

**현재 스코프**: Wallet/Ledger + Auction(입찰/낙찰/자동정산) + 낙찰 연차 가산 + 인증/RBAC + 알림 + 연말 배당 지급 + 실시간(SSE) + 연말 풀 수집(LeavePool).
구현 현황은 아래 [구현 현황 체크리스트](#구현-현황-체크리스트), 잘라낸 항목은 [`scope-cuts.md`](../06_tech/scope-cuts.md) 참고.

## 실행

```powershell
cd backend
npm install
copy .env.example .env
npm run db:migrate         # SQLite dev.db 생성 (DB 컨테이너 불필요)
npm run db:seed
npm run start:dev          # → http://localhost:3001
```

## 공유 시드 `dev.db` (팀 온보딩)

이 레포는 `backend/prisma/dev.db`(SQLite)를 **팀 공유 테스트 시드**로 커밋합니다.
회원·경매·지갑·원장·연차 데이터가 그 파일 한 개에 들어 있어서, **클론하면 migrate/seed 없이
바로 같은 데이터로 실행**됩니다. (데이터는 `user001@exam.com` 류 샌드박스 — 실제 PII 아님.)

### 받는 개발자 — 클론/풀 후 **1회만**

```bash
git config merge.ours.driver true                       # .gitattributes merge=ours 드라이버 등록
git update-index --skip-worktree backend/prisma/dev.db  # 내 로컬 dev.db 변경을 git이 무시
```

그 뒤엔 그냥:

```bash
cd backend && npm install
copy .env.example .env      # MSAPORTAL_URL / EZPASS_* 등 실제 값은 .env 에만
npm run start:dev
```

> 위 `## 실행`의 `db:migrate` / `db:seed`는 **빈 DB를 처음부터 만들 때**만 필요합니다.
> 커밋된 dev.db를 그대로 쓸 거면 생략하세요.

### 왜 충돌이 안 나는가 (안전장치)

- **단일 소유자**: dev.db 커밋은 시드 정본 관리자 **1명만**.
- **`skip-worktree`**: 받는 쪽이 앱을 돌려 dev.db가 바뀌어도 git이 무시 → 오커밋/충돌 없음.
- **`.gitattributes` `binary merge=ours`**: 병합 시 conflict 마커 없이 정본이 자동 채택.
- sidecar(`*.db-wal` / `-shm` / `-journal`)는 `.gitignore`로 계속 제외.

### 시드 갱신 (소유자)

```bash
# 데이터를 만든 뒤
git add backend/prisma/dev.db && git commit -m "chore(db): 시드 갱신" && git push
# 스키마도 바꿨으면 prisma 마이그레이션 파일도 같이 커밋
```

### 새 시드 받기 (받는 쪽 — skip-worktree라 자동으로 안 옴)

```bash
git update-index --no-skip-worktree backend/prisma/dev.db
git checkout -- backend/prisma/dev.db    # 또는 git pull 로 최신 dev.db 반영
git update-index --skip-worktree backend/prisma/dev.db
# 스키마가 바뀐 커밋이면: npm run db:migrate
```

## API

### 경매 — 공개

| 메서드 | 경로 | 용도 |
|---|---|---|
| `GET`  | `/api/auctions?status=OPEN,CREATED&year=2026` | 경매 목록 (Grid/Row/Timeline). `year`는 id prefix `A-{year}-` 매칭 — LeavePool 익년도 매물 격리용 |
| `GET`  | `/api/auctions/:id`                  | 경매 상세 + 최근 입찰 기록 (입찰 상세 화면) |
| `GET`  | `/api/auctions/:id/stream`           | **실시간 업데이트 SSE** (입찰/정산 신호 push, `@Public`, CUT-6) |
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

### 인증

| 메서드 | 경로 | 용도 |
|---|---|---|
| `POST` | `/api/auth/login`             | 이메일+비밀번호 로그인. 성공 시 **JWT 발급**(`token`). ezpass 위임 / 로컬 bcrypt 합성 (ADR-019/022) |

> 이후 모든 보호 라우트는 `Authorization: Bearer <token>` 필요. RBAC는 [scope-cuts CUT-8 ✅](../06_tech/scope-cuts.md) 참고.

### 배당 (Dividend)

| 메서드 | 경로 | 용도 |
|---|---|---|
| `GET`  | `/api/dividend/me/:userId`    | 내 지분율 + 예상 배당금 + 상위 9명 stake 분포 (self/ADMIN) |
| `POST` | `/api/admin/dividend/settle`  | **연말 배당 실지급 배치** (ADMIN). `?dryRun=true` 미리보기, 멱등(재호출 409) — ADR-008 |

### 풀 수집 (LeavePool — ADR-017)

| 메서드 | 경로 | 용도 |
|---|---|---|
| `POST` | `/api/admin/leave-pool/collect` | **연말 풀 수집 배치** (ADMIN). REGULAR 미사용 → 익년도 1일권 매물 + Stake. `?dryRun=true` 미리보기, `?sourceYear=`, 멱등(`leave_pool_run.target_year` UNIQUE → 재호출 409) |

### 휴가 사용 / 유찰 재고 처리 (FR-3.1 / FR-4.2)

| 메서드 | 경로 | 용도 |
|---|---|---|
| `POST` | `/api/admin/leave/use` | **휴가 사용 — 우선순위 차감** (ADMIN, FR-3.1). body: `{userId, days, year?}`. 도메인 규칙 AUCTION→EVENT→REGULAR로 강제. 잔여 부족 시 409 |
| `POST` | `/api/admin/auctions/:id/grant-event` | **UNSOLD → EVENT 변환** (ADMIN, FR-4.2). body: `{userId}`. 경매 행은 삭제(인벤토리 소진), 수령자 EVENT 잔액 +leaveDays. 비-UNSOLD면 409 |
| `POST` | `/api/admin/auctions/purge-unsold?upToYear=` | **유찰 재고 영구 삭제** (ADMIN, FR-4.2). 자동 스케줄은 `PURGE_UNSOLD_AUTO_ENABLED=true` |

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

> 🔒 모든 `/api/admin/*` 라우트는 **ADMIN 토큰 필요**(JWT + `@Roles('ADMIN')`). 무토큰 401 / 비ADMIN 403 ([scope-cuts.md CUT-8 ✅](../06_tech/scope-cuts.md)).

## 자동 정산 스케줄러

`SettleDueAuctionsScheduler`가 시작 시 1회 + 매 `SETTLE_INTERVAL_MS` (기본 60초) 마다 마감된 OPEN 경매를 찾아 정산합니다.

- 비활성화: `.env`에 `SETTLE_INTERVAL_MS=0`
- 데모 빠르게 보기: `.env`에 `SETTLE_INTERVAL_MS=10000` (10초)
- 즉시 1회 실행: `curl -X POST http://localhost:3001/api/admin/auctions/settle-due`

scope-cuts.md CUT-5 (anti-snipe)는 여전히 미구현이라, 마감 시각 이후 들어오는 입찰은 다음 tick에서 그대로 거부됩니다.

### 연말 배당 자동 지급 스케줄러

`YearEndDividendScheduler`가 **컷오프(기본 올해 12/31 23:59) 이후** 첫 tick에서 배당 배치를
자동 1회 실행합니다 (수동 `POST /api/admin/dividend/settle`와 동일 use case, 멱등). 한 번 지급되면
다음 tick에서 409를 감지하고 스스로 타이머를 멈춥니다.

- 활성화: `.env`에 `DIVIDEND_AUTO_ENABLED=true` (기본 비활성 — 실지급은 신중히)
- 체크 주기: `DIVIDEND_CHECK_INTERVAL_MS` (기본 3600000=1시간)
- 데모/테스트: `DIVIDEND_CUTOFF=2026-01-01T00:00:00` 처럼 과거 시각으로 오버라이드하면 즉시 발동

### 연말 풀 수집 자동 스케줄러

`LeavePoolScheduler`가 컷오프(기본 올해 12/31 23:59) 이후 첫 tick에서 `CollectLeavePoolUseCase`를
자동 1회 실행합니다 (수동 `POST /api/admin/leave-pool/collect`와 동일 use case, 멱등). 한 번 수집되면
다음 tick을 기다리지 않고 스스로 타이머를 멈춥니다.

- 활성화: `.env`에 `LEAVEPOOL_AUTO_ENABLED=true` (기본 비활성)
- 체크 주기: `LEAVEPOOL_CHECK_INTERVAL_MS` (기본 3600000=1시간)
- 데모/테스트: `LEAVEPOOL_CUTOFF=2026-01-01T00:00:00` 으로 과거 시각 오버라이드

### 연말 유찰 재고 청산 스케줄러

`PurgeUnsoldAuctionsScheduler`가 컷오프(기본 올해 12/31 23:59) 이후 첫 tick에서 `PurgeUnsoldAuctionsUseCase`를
자동 1회 실행합니다(FR-4.2 "익년 이월 회계상 원천 차단"). 한 번 비우면 자체 정지.

- 활성화: `.env`에 `PURGE_UNSOLD_AUTO_ENABLED=true` (기본 비활성 — 영구 삭제는 신중히)
- 체크 주기: `PURGE_UNSOLD_CHECK_INTERVAL_MS` (기본 1시간)
- 데모/테스트: `PURGE_UNSOLD_CUTOFF=2026-01-01T00:00:00`

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
   auction.extendIfSniped(now, window, extend)      ← 마감 임박이면 연장 (CUT-5)
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

**도메인 단위** (`npm test`, rootDir=`src`): Point·UserId·AuctionId·Wallet·Auction 등 37개. Prisma/DB 없이 순수 실행.

**어댑터 통합** (`npm run test:e2e`, `test/*.e2e-spec.ts`):
```powershell
npm run test:e2e
```
실제 AppModule(실 Prisma 어댑터·`PrismaUnitOfWork`·이벤트버스)을 **임시 SQLite DB**에 대고 띄워 검증.
`test/setup-e2e.ts`가 OS temp에 새 DB를 만들고 `prisma migrate deploy`로 트리거(insert-only)·CHECK까지
포함한 깨끗한 스키마를 깐다(시드 dev.db에 의존하지 않음). 커버리지:
- 입찰 단일 tx: 차감+BID 원장, 패자 자동환불(원 BID 유지 = Insert-Only), 잔액 부족 시 전체 롤백
- anti-snipe(CUT-5): 마감 임박 입찰 → `endsAt` 연장이 DB에 영속화
- 정산: 낙찰 AWARD + AUCTION 연차 적립(같은 tx) + WIN audit 원장(amount=0)
- 연말 배당: 기여 지분 비례 분배, **Σ배당 = 에스크로(NFR-2)**, 지급 후 에스크로=0, 재호출 멱등(409)

## 자른 것들

자세한 내역과 되돌리는 비용은 [`scope-cuts.md`](../06_tech/scope-cuts.md). 요약:

- **CUT-1**: Redis 분산 락 → SQLite write 락(`lockAuction` no-op UPDATE)
- **CUT-2**: in-process 도메인 이벤트 버스 → ✅ **부활** (알림 Observer, `@nestjs/event-emitter`)
- **CUT-3**: State Pattern → `AuctionStatus` enum + 가드 절
- **CUT-4**: Outbox → 외부 호출 없으니 생략 (ADR-005 dormant)
- **CUT-5**: Anti-snipe 마감 연장 → ✅ **부활** (`Auction.extendIfSniped` + `PlaceBid`, `ANTISNIPE_*` knob)
- **CUT-6**: WebSocket 실시간 → ✅ **부활 (SSE)** (`AuctionStream` + `GET /auctions/:id/stream`, socket.io 무의존)
- **CUT-8**: 인증/RBAC → ✅ **완전 부활** (자체 JWT + RBAC/ABAC 가드)

## 구현 현황 체크리스트

- [x] Wallet/Ledger (Insert-Only) + 입찰 단일 트랜잭션 + 패자 자동환불
- [x] 경매 라이프사이클 (생성/목록/상세/입찰/정산) + 자동 정산 스케줄러
- [x] 낙찰 시 AUCTION 연차 자동 가산 (`grantAuctionLeave`, 같은 tx — 인바리언트 #6)
- [x] 도메인 이벤트 + 알림 Observer (ADR-013)
- [x] 인증 (ezpass 위임 + 로컬 bcrypt 합성, ADR-019~022)
- [x] **RBAC/ABAC 가드** (JWT + `@Roles`/`@SelfParam`, permission-matrix 1:1)
- [x] 관리자 통계/원장/회원관리/엑셀 export
- [x] 배당 예상치 (`GET /dividend/me/:id`)
- [x] **연말 배당 실지급 배치** (`PayoutChannel` + `SettleYearEndDividend`, NFR-2 등식 검증, 멱등)
- [x] **배당 정산 관리자 UI 버튼** (AdminOps "연말 배당 정산" → 미리보기 모달 → 실지급)
- [x] **12/31 배당 자동 스케줄** (`YearEndDividendScheduler`, 컷오프 이후 자동 1회 지급, 멱등 정지)
- [x] **CUT-5 Anti-snipe** 마감 임박 입찰 시 자동 연장 (`extendIfSniped`, 단일 tx, 영속화)
- [x] **어댑터 통합/E2E 테스트** (`test/*.e2e-spec.ts` — 실 SQLite, 입찰/정산/배당 핫패스)
- [x] **CUT-6 실시간** (SSE — `GET /auctions/:id/stream`, 입찰/정산 push → 프론트 즉시 갱신)
- [x] **LeavePool 바운디드 컨텍스트** (ADR-017 — `CollectLeavePool` 배치: REGULAR 미사용 → 익년도 1일권 매물 + Stake, `leave_pool_run`으로 멱등, AdminOps UI)
- [x] **FR-3.1 휴가 차감 우선순위** (`UseLeaveUseCase`, 도메인 `planLeaveDeduction` 순수, ADMIN 엔드포인트 — 외부 그룹웨어 통합 전까지 디버그/시연용)
- [x] **FR-4.2 유찰 재고 처리** (`GrantEventFromUnsoldUseCase` + `PurgeUnsoldAuctionsUseCase` + 12/31 자동 스케줄러)

## 후속 PR

scope-cuts CUT-1~9는 사실상 모두 정리됐습니다. 추가 작업이 생기면 이 섹션에 기록.

## 참고

- [CLAUDE.md](../CLAUDE.md) — 하드 인바리언트
- [`06_tech/scope-cuts.md`](../06_tech/scope-cuts.md) — 잘라낸 것 추적
- [`04_decisions/`](../04_decisions/) — ADR 원본 18개
