# Scope Cuts — 학교 프로젝트 일정에 맞춘 단순화 결정

**상태**: 🟡 살아있는 문서 — 컷을 추가/번복할 때마다 갱신
**최초 작성**: 2026-05-20
**팀**: 타임소프트콘 (2인, 9주)

---

## 왜 이 문서가 있는가

설계 단계의 ADR들은 "운영 환경에서 견딘다"는 가정 아래 작성되었습니다. 하지만 실제 산출물은 **2인 9주 학교 프로젝트**입니다. 모든 ADR을 그대로 구현하면 학기 안에 못 끝납니다.

이 문서는 **무엇을 잘랐고, 왜 잘랐고, 어떤 ADR/요구사항을 어떻게 대체했는지** 추적합니다. 발표나 회고에서 "왜 ADR-XXX대로 안 만들었나요?"라는 질문이 나오면 여기를 가리키세요.

원칙:
- **인바리언트 (CLAUDE.md §"Hard invariants")는 자르지 않는다** — 정합성과 직결.
- **구조 (Hexagonal, Value Object, 통화 추상화)는 자르지 않는다** — 잘라봐야 코드 더 늘어남.
- **운영/스케일/성능 최적화는 자른다** — 학교 프로젝트 부하에서 의미 없음.
- **자른 것은 *어떻게* 대체했는지 명시한다** — "그냥 안 함"이 아니라 "더 단순한 X로 대체".

---

## ✂️ 자른 것들

### CUT-1. Redis 분산 락 ([ADR-006](../04_decisions/ADR-006-redis-lock.md) — Superseded)

**원안**: 입찰 처리 시 Redlock 알고리즘으로 Redis 기반 분산 락 (TTL 5s).

**자른 이유**:
- 본 시스템은 단일 deployable. 분산 락은 *복수 인스턴스* 환경의 답인데 우리는 인스턴스 1대.
- 학교 프로젝트의 동시성은 부하 테스트로 의도적으로 만들지 않으면 발생 안 함.
- Redis 추가 = 인프라 1개 더, 컨테이너 1개 더, 장애 지점 1개 더.

**대체**:
- **SQLite write 락** — `lockAuction()`이 no-op `UPDATE auction SET id=id`로 트랜잭션 write 락을 선점, 같은 경매 입찰을 직렬화 (SQLite엔 행 락이 없어 전역 write 락 사용).
- 자동 해제 (트랜잭션 커밋/롤백 시), 무료, 같은 DB라 일관성 보장.
- 코드는 [`PrismaUnitOfWork.lockAuction()`](../backend/src/adapters/persistence/prisma-unit-of-work.ts) 한 줄.

**되돌리는 비용**: 낮음. `BIDDING_CURRENCY` 인터페이스 영향 없음. `UnitOfWork.lockAuction`의 no-op UPDATE를 `redlock.acquire`로 바꾸면 됨 (현재는 되살릴 계획 없음).

**docker-compose/.env에서 redis 제거 (2026-05-26)** — Redis는 영구 미사용으로 확정. compose 서비스·`REDIS_URL`·문서 전반의 Redis 참조 삭제. 부활이 필요해지면 어댑터만 추가하면 됨.

---

### CUT-2. 도메인 이벤트 in-process 버스 ([ADR-013](../04_decisions/ADR-013-domain-event.md))

**원안**: Use Case가 `BidPlacedEvent` / `AuctionWonEvent` 등을 in-process EventBus에 publish → 구독자(브로드캐스팅·메트릭·감사 로그)가 비동기 처리.

**자른 이유**:
- 우리는 *지금* 브로드캐스팅 안 함 (WebSocket 없음), 메트릭 수집 안 함, 별도 감사 로그 시스템 없음.
- 구독자가 0개인 이벤트 버스는 추상화 비용만 발생.
- 미래에 필요하면 use case 안의 "이벤트 발행" 자리에 NestJS `EventEmitter2`를 끼우는 데 1시간이면 됨.

**대체**:
- Use Case가 후속 동작을 *직접* 호출.
- 예: `PlaceBidUseCase`가 입찰 성공 후 BidEvent 로그를 직접 INSERT (LedgerRepository가 받아 처리).
- "이벤트가 발생했다"는 사실은 `ledger_entry` + `bid_event` 테이블에 INSERT되므로 *암묵적 이벤트 소싱*.

**되돌리는 비용**: 낮음. Use Case 끝에 `await this.events.publish(new BidPlacedEvent(...))` 한 줄 추가.

**↩️ 부활 (2026-05-27 ~ 06-04)**: **알림 기능이 첫 실구독자가 되어 EventBus를 되살림**(예상대로 ~1시간). `@nestjs/event-emitter` 도입, `NotificationObserver`가 단일 실구독자로 **10개 핸들러**를 가짐. 이벤트는 4그룹으로 확장됨(`application/events/`): `auction-events`(bid_placed·won·**inventory_created**) · `charge-events`(ADR-024 충전: submitted·approved·rejected) · `redemption-events`(ADR-023 교환: submitted·approved·rejected·received) · `notification-events`(created). "구독자 0 → 추상화 비용만"이 더는 아님. 실시간 전달은 WebSocket이 아니라 **SSE**(`@Sse`, `NotificationStream`/`AuctionStream` — CUT-6 대체)로 구현됨; `NotificationObserver`가 `notification.created`를 재발행하면 `NotificationStream`이 받아 화면으로 push. 메트릭·Slack 구독자는 여전히 없음 — 핸들러만 더 붙이면 됨(Use Case 무수정). 이벤트 클래스는 도메인이 아니라 `application/events/`에 둠(도메인 순수성 유지) — ADR-013 원안의 "도메인 코어 위치" 제약과는 의도적으로 다름. 상세 [[event-bus-guide]] · [[ADR-013]] 구현 현황.

---

### CUT-3. 경매 State Pattern ([ADR-014](../04_decisions/ADR-014-auction-state-pattern.md))

**원안**: `OpenState` / `ClosedState` / `AwardedState` / `UnsoldState` / `ExpiredState` / `CreatedState` 클래스 객체화. 각 상태 객체가 자기 책임의 메서드만 노출.

**자른 이유**:
- 상태 6개 × 메서드 N개 = 클래스 폭발. 학교 프로젝트 코드 리뷰 비용 ↑.
- 본 도메인 상태는 *단순 선형 전이* (CREATED → OPEN → AWARDED/UNSOLD/EXPIRED). State 패턴이 빛나는 경우(상태 간 메서드 셋이 크게 다름)는 아님.

**대체**:
- `AuctionStatus` enum + `Auction` 엔티티의 메서드 안에서 가드 절 (`if (this.status !== 'OPEN') throw ...`).
- 가드는 *도메인 메서드 안에만* 존재 — 어플리케이션/어댑터 계층에서는 `if (status === ...)` 분기 금지 (CLAUDE.md 구조 인바리언트).

**예외**: 만약 상태별 메서드 셋이 크게 달라지면 (예: AWARDED 상태에서만 `cancelAward()`, OPEN 상태에서만 `extendDeadline()`) 그때 State 패턴으로 회귀.

**되돌리는 비용**: 중간. 도메인 메서드 시그니처 자체는 안 바뀌어서 use case는 무영향. `Auction` 클래스를 추상 + 상태별 서브클래스로 분리하는 리팩터링.

---

### CUT-4. Outbox 패턴 ([ADR-005](../04_decisions/ADR-005-hr-api-timing.md))

**원안**: 외부 시스템 호출 (HR API, 알림 등)은 Outbox 테이블 + relay 워커.

**상태**: **이미 ADR-005에서 "Outbox 골격은 두되 dormant"로 결정됨.** 본 PR에서도 그대로.

**자른 부분**: Outbox 테이블/워커 자체. 외부 시스템 호출이 *없으니까* 만들 게 없음.

**대체**: 없음. 필요할 때 만든다.

**되돌리는 비용**: 중간. 외부 어댑터를 도입하는 시점에 Outbox 테이블 + relay 워커 추가.

**✅ 부활 (2026-05-29)**: 외부 HR 연동(`LEAVE_GRANT_MODE=groupware`)을 도입하며 트랜잭션 아웃박스를 실제 구현. `outbox` 테이블 + `UnitOfWork.enqueueOutbox`(낙찰 정산과 *같은 tx*에 적재) + `OutboxRelayScheduler`(PENDING polling → `HrLeaveClient` 전송 → 성공 SENT / 실패 지수백오프 재시도 / maxAttempts 초과 DEAD=DLQ). DLQ 깊이는 관리자 stats `dlqDepth`로 노출(더는 하드코딩 0 아님). **우리 leave_balance가 마스터**이고 외부 통지는 *추가*일 뿐 — ezpass 연차 테이블엔 직접 쓰지 않음(읽기전용 정책 유지, ADR-016/020). HR 대상은 설정형(`HR_API_URL`, 없으면 Mock 로그). 기본은 `internal`(아웃박스 미적재).

---

### CUT-5. Anti-snipe (마감 5분 내 입찰 시 자동 연장)

**원안 (README/SRS)**: "마감 5분 이내 입찰 발생 → 마감 시각 자동 연장".

**자른 이유**:
- 정책 변수 (몇 분 이내? 몇 분 연장?) 미확정.
- 핵심 UX는 *입찰 자체가 동작하는 것*. anti-snipe는 "있으면 좋은" 기능.

**대체**: 없음. 마감 시각 도달 시 즉시 종료.

**되돌리는 비용**: 낮음. `PlaceBidUseCase`에 "if (now ≥ endsAt − 5min) auction.extendBy(5min)" 추가 + 도메인 메서드 1개.

**✅ 부활 (2026-05-28)**: 예상대로 비용 낮아 복원. `Auction.extendIfSniped(now, windowMs, extendMs)` 도메인 메서드 1개(상태/마감 변경은 애그리거트 안 — 인바리언트 #11) + `PlaceBidUseCase`가 입찰 수락 직후 같은 tx에서 호출. 마감까지 `window`(기본 5분) 이내 입찰이면 마감을 `now + extend`(기본 5분)로 밀되 **절대 당기지 않음**. 정책 변수는 운영 knob으로 확정: `ANTISNIPE_WINDOW_MS`/`ANTISNIPE_EXTEND_MS`(env, 기본 각 300000), `WINDOW=0`이면 비활성. 입찰 응답에 `extended`/`endsAt`을 실어 프론트가 "마감 연장됨" 토스트를 띄움. 도메인 스펙 5개 추가. 연장된 `endsAt`은 `PrismaAuctionRepository.save` update에 포함되어 영속화 → 자동정산 스케줄러도 새 마감을 따름.

**문서**: 발표 시 "scope 외" 명시.

---

### CUT-6. 실시간 입찰 알림 (WebSocket/SSE)

**원안**: 클라이언트가 다른 사용자의 입찰을 실시간 수신.

**자른 이유**:
- WebSocket 게이트웨이 도입 = 인프라 복잡도 ↑, 인증 흐름 분기.
- 학교 프로젝트 부하에서는 *2초 폴링*과 사용자 체감 차이 거의 없음.

**대체**: 클라이언트가 경매 상세 페이지에서 N초 폴링 (`GET /api/auctions/:id` 반복 호출).

**되돌리는 비용**: 큼. NestJS `@WebSocketGateway`, 인증 미들웨어 재사용, 프론트 Socket.io 클라이언트 도입. 별도 PR.

**✅ 부활 (2026-05-28) — WebSocket 대신 SSE**: 우리 케이스는 서버→클라 *단방향* 브로드캐스트뿐이라 양방향 socket.io는 과함. NestJS 내장 `@Sse()` + rxjs `Subject`로 구현 → **백엔드/프론트 모두 새 의존성 0**, 기존 `/api` vite 프록시 그대로 통과. `AuctionStream`(adapters/realtime)이 도메인 이벤트(`BidPlacedEvent`/`AuctionWonEvent`)를 구독(NotificationObserver와 같은 부류)해 `GET /api/auctions/:id/stream`(`@Public`, `AuctionStreamPort`로 경계 분리)으로 push. 페이로드는 "무엇이 바뀌었다"는 *신호*만 담아(민감정보 없음) 스트림을 공개로 둘 수 있고, 프론트는 신호 수신 시 인증된 상세를 다시 읽어 정본 유지(서버 단일 진실원천, 폴링 지연만 제거). 프론트는 네이티브 `EventSource`(`lib/auction-stream.ts`) + 경매 상세에 "실시간" 표시. EventSource 자동 재연결로 일시 단절에 강함.

---

### CUT-7. 도메인 이벤트 → Outbox 연결 ([ADR-013](../04_decisions/ADR-013-domain-event.md) + [ADR-005](../04_decisions/ADR-005-hr-api-timing.md))

CUT-2 + CUT-4 결합. *외부 시스템 트리거*는 결국 없으므로 둘 다 자르고 후속 PR에서 같이 부활.

**✅ 부활 (2026-05-29)**: 외부 HR 트리거가 생기며(낙찰→HR 연차 통지) 완성. 다만 역할 분리는 ADR-013대로 — **in-process EventBus(알림·SSE)와 Outbox(외부 HR)는 별개 경로**다. 낙찰 시: ① EventBus로 `AuctionWonEvent`(프로세스 내부 알림/실시간) ② Outbox로 `HR_LEAVE_GRANT`(외부 시스템, 신뢰성 발행). "외부 호출은 Outbox로, 내부 fan-out은 EventBus로"가 코드로 실현됨.

---

### CUT-8. 인증 / 인가 (RBAC)

**원안**: 사번/SSO 로그인, EMPLOYEE/ADMIN 권한 분기, JWT 또는 세션.

**자른 이유**: 본 PR에 끼면 PR 크기가 폭발. 분리해서 별도 PR.

**대체 (현재)**:
- 모든 사용자가 ADMIN이라고 가정. `/api/admin/*` 라우트가 무방비 — *데모 환경 전용*.
- `userId`는 요청 본문/쿼리/path에서 받음 (인증된 사용자 ID로 자동 주입되지 않음).

**되돌리는 비용**: 별도 PR (PR-Auth). 미들웨어 + Guard + JWT.

**부분 부활 (2026-05-20)**: `POST /api/auth/login`이 사번 조회로 현재 사용자를 결정. 비밀번호 검증·세션·Guard는 여전히 없음. 프론트는 응답의 `userId`를 localStorage에 저장.

**✅ 완전 부활 (2026-05-27)**: **자체 JWT 기반 RBAC + ABAC 적용**. 더는 데모 무방비 아님.
- 로그인 시 우리가 JWT 서명(`{sub,role,empId}`, HS256, `JWT_SECRET`/`JWT_EXPIRES_IN`) → 프론트가 `Authorization: Bearer` 재전송 → 가드가 검증(위변조 불가).
- 전역 가드 3종(`interfaces/http/auth/`): `JwtAuthGuard`(+`@Public()`), `RolesGuard`(+`@Roles('ADMIN')`), `SelfOrAdminGuard`(+`@SelfParam('userId')` ABAC). `APP_GUARD`로 등록.
- 적용: `/admin/*`·legacy `/wallet/:id` = ADMIN, `me`/`dividend`/notifications = 본인 또는 ADMIN, 입찰자는 토큰 주체로 고정(body.userId 무시).
- 인증 어댑터: `AUTH_MODE=local`은 순수 자체 비번, 기본(ezpass)은 `CompositeAuthProvider`(로컬 비번 보유 계정은 로컬 bcrypt, 나머지는 ezpass 위임 — ezpass admin 외부 장애 우회). permission-matrix.md와 1:1.

---

### CUT-9. LeavePool bounded context ([ADR-017](../04_decisions/ADR-017-leave-pool-context.md))

**원안**: 별도의 LeavePool 컨텍스트가 연차 기여를 집계하고 연말에 stake 분포를 산정. 기여 이벤트 / 풀 잔량 / 만료 정책이 모두 자체 도메인.

**자른 이유**:
- 본 PR의 Dividend 화면은 *데모용 가시화*가 우선. ADR-017은 6개 추가 컴포넌트를 요구.
- 9주 일정에서 새 bounded context 1개 추가 = 1주 이상.

**대체**:
- `users.contributed_days` 컬럼 1개 + 비례 계산: `stake = days / Σ days`, `배당금 = floor(escrow × stake)`.
- 시드의 9명에 contributed_days를 박아두고, `GET /api/dividend/me/:userId`가 즉시 계산.

**되돌리는 비용**: 큼. LeavePool aggregate + 기여 이벤트 + 만료 잡 + 별도 테이블.

**부분 부활 (2026-05-20)**: `users.regular_leave_days` / `auction_leave_days` / `event_leave_days` 컬럼 3개 추가 + `GET /api/users/:id/leave` 읽기 전용 엔드콘. Dashboard와 MyActivity의 휴가 카드가 실제 사용자별 값으로 표시됨.

**✅ 추가 부활 (낙찰 연차 가산)**: 휴가 모델을 `leave_balance(userId, year, leaveType)` 테이블로 일반화(3컬럼 폐기). **낙찰 정산 시 `grantAuctionLeave`로 AUCTION 연차를 같은 트랜잭션에서 적립**(`SettleAuctionUseCase` → `UnitOfWork.grantAuctionLeave`). 인바리언트 #6 충족.

**✅ 배당 지급 부활 (2026-05-27)**: 예상치(projection)만 있던 배당에 **실제 지급 배치**를 추가 — `PayoutChannel` 포트(ADR-010 ISP 분리) + `SettleYearEndDividendUseCase`. stake 비례 floor 배당 + 나머지 1위 몰아주기로 `Σ배당 = escrow`(NFR-2) 정확히 성립, 멱등(재호출 409), `POST /api/admin/dividend/settle?dryRun=`.

**✅ LeavePool 컨텍스트 부활 (2026-05-28)**: ADR-017의 다리 역할(Leave→Auction/Dividend)을 별도 바운디드 컨텍스트로 구현. `CollectLeavePoolUseCase` + `LeavePoolPort`(adapter PrismaLeavePoolAdapter) — REGULAR 미사용 연차를 OP-2(1:1)로 익년도 1일권 매물(`A-{Y}-NNN`) + Stake(contributedDays)로 변환, 한 트랜잭션에 매물·Stake·`leave_pool_run` 마커 기록. 멱등 키 `leave_pool_run.target_year` UNIQUE → 재실행 409. 도메인 `planLeavePool`은 순수(외부의존 0), OP-5 주당 분산 오픈 + OP-6 고정 최소가(`LEAVEPOOL_*` knob). `AuctionInventoryCreatedEvent` 발행(ADR-013). 관리자 UI 미리보기→실행(AdminOps). 단, leave_balance에서 기여분을 차감하는 *기안/승인* 워크플로는 기존 스코프 아웃 유지(ADR-016) — 배치는 REGULAR 잔여를 *조회*만.

---

## 🛡 자르지 *않은* 것들 (왜 유지하는지)

여기는 "잘랐다고 생각했지만 안 자른" 항목을 명시합니다. 발표 시 "왜 이건 그대로 뒀나"를 답하기 위함.

### KEEP-1. Insert-Only ledger 트리거 ([CLAUDE.md DB-RULE-1](../CLAUDE.md))

**왜 유지**: 트리거 SQL 20줄. 자르는 비용 > 유지 비용. 그리고 **재무 정합성의 핵심 인바리언트**라 자르면 안 됨.

### KEEP-2. Value Objects (Cone, UserId, Currency) ([ADR-015](../04_decisions/ADR-015-value-object.md))

**왜 유지**: 클래스 3개, 100줄 정도. Primitive obsession 방지 + 음수 차감 같은 *재무 사고* 예방. ROI 매우 높음.

### KEEP-3. Hexagonal 의존 방향 ([ADR-012](../04_decisions/ADR-012-hexagonal-architecture.md))

**왜 유지**: 잘라봐야 결과적으로 모든 레이어가 Nest 데코레이터 + Prisma client를 import하게 되어 *테스트 어려움 + 화폐 추상화 깨짐*. ESLint boundaries 규칙 30줄이 미래의 리팩터링을 막아줌.

### KEEP-4. Currency Abstraction ([ADR-010](../04_decisions/ADR-010-currency-abstraction.md))

**왜 유지**: 어차피 `WelfarePointProvider` 하나만 구현해도 인터페이스 비용은 작음. 미래에 화폐 정책 바뀌어도 도메인 무수정.

### KEEP-5. 3-flag leave separation ([ADR-002](../04_decisions/ADR-002-leave-type-flag.md))

**왜 유지**: DB 컬럼 1개. 자르면 *근로기준법* 인바리언트 깨짐.

---

## 🗺 적용 우선순위 (자른 것을 *되살리는* 순서)

미래에 시간이 남으면 다음 순서로 되살림. 위가 ROI 높음.

1. **CUT-8 (Auth)** — 데모를 누군가에게 보여줘야 할 때 가장 먼저 필요.
2. **CUT-5 (Anti-snipe)** — 입찰 UX 완성도. 비용 낮음.
3. **CUT-6 (실시간)** — 데모 임팩트 큰데 비용 큼. 발표 직전에 결정.
4. ~~CUT-1 (Redis 분산 락)~~ — **영구 드롭**. 되살리지 않음.
5. **CUT-2/3/4/7 (이벤트/Outbox/State)** — 시스템이 *진짜* 커질 때.

---

## 🪙 부활시킨 항목

### REVIVED-A. 자동 정산 (마감 시각 도달 후)

**상태**: ✅ 부활 — `SettleDueAuctionsScheduler` (backend/src/adapters/scheduling/).

**왜**: 마감된 OPEN 경매가 영원히 OPEN으로 남아있으면 시연/데모가 죽은 시스템처럼 보임.

**구현 방식**:
- `setInterval` 기반 (기본 60초). `SETTLE_INTERVAL_MS` 환경변수로 조절.
- `@nestjs/schedule` 미도입 — 단순 인터벌이면 충분 (학교 프로젝트 scope).
- 동시 실행 가드 (한 tick 진행 중이면 다음 tick skip).
- 각 경매를 독립 트랜잭션에서 정산 — advisory lock으로 cron tick끼리 race 방지.

**관련 ADR**: 새 ADR 안 만듦. `setInterval` 선택은 가벼운 결정이라 scope-cuts.md에 메모로 충분.

---

## 변경 로그

- 2026-05-20 — 초안 작성. CUT-1~8 식별, KEEP-1~5 명시.
- 2026-05-20 — REVIVED-A 자동 정산 스케줄러 추가 (setInterval, @nestjs/schedule 안 씀).
- 2026-05-20 — CUT-8 부분 부활 (auth/login만), CUT-9 LeavePool 신규 컷.
- 2026-05-20 — CUT-9 부분 부활 (휴가 잔여 read-only 표시. auction 일수 자동 가산은 후속 PR).
- 2026-05-26 — CUT-1 Redis **영구 제거** 확정. docker-compose/.env/문서 전반에서 Redis 참조 삭제, ADR-006 Superseded 표기.
- 2026-05-26 — DB를 SQLite로 전환(원격 MySQL 의존 제거). CUT-1 락이 SQLite write 락(no-op UPDATE)으로, 문서 전반 DB엔진 SQLite 정합.
- 2026-05-27 — CUT-2 EventBus 부분 부활(알림 Observer), ADR-019~022 중앙 인증 위임 도입.
- 2026-05-27 — **CUT-8 완전 부활**: 자체 JWT + RBAC/ABAC 가드 + CompositeAuthProvider.
- 2026-05-27 — CUT-9 추가 부활: 낙찰 연차 가산(`grantAuctionLeave`) + **연말 배당 실지급 배치**(`PayoutChannel`/`SettleYearEndDividend`).
- 2026-05-28 — 배당 정산 관리자 UI(AdminOps 미리보기→실지급) + **12/31 배당 자동 스케줄**(`YearEndDividendScheduler`).
- 2026-05-28 — **CUT-5 Anti-snipe 부활**: `Auction.extendIfSniped` + `PlaceBidUseCase` 연장, 운영 knob `ANTISNIPE_*`.
- 2026-05-28 — 어댑터 통합 E2E 하니스(`test/*.e2e-spec.ts`, 실 SQLite) — 입찰/정산/배당 핫패스.
- 2026-05-28 — **CUT-6 실시간 부활 (SSE)**: `AuctionStream` + `GET /auctions/:id/stream`, 프론트 `EventSource`. socket.io 없이 무의존.
- 2026-05-28 — **CUT-9 LeavePool 완전 부활**: `CollectLeavePoolUseCase` + `LeavePoolPort` + `leave_pool_run` 마이그레이션, 매물·Stake 단일 tx, 도메인 순수 plan, AdminOps UI.
- 2026-05-28 — LeavePool 12/31 자동 스케줄(`LeavePoolScheduler`, YearEndDividendScheduler와 동일 패턴, 컷오프 게이트·멱등 선제 정지).
- 2026-05-28 — `AuctionInventoryCreatedEvent` 구독자(`NotificationObserver`) — 풀 수집 시 ADMIN 알림(`notification.type` CHECK에 `INVENTORY_CREATED` 추가).
- 2026-05-28 — **연도별 Stake 테이블** 도입 — `user.contributedDays` 단일 컬럼 → `stake(userId, year)` 분리(ADR-017). 마이그레이션이 기존 contributedDays를 `stake(year=2026)`로 이관, `GetMyDividend`/`SettleYearEndDividend`/`PrismaLeavePoolAdapter`가 모두 stake 테이블 기준으로 동작. contributedDays 컬럼은 legacy 디스플레이 스냅샷으로 sync 유지.
- 2026-05-28 — **FR-3.1 휴가 차감 우선순위** 구현(도메인 `planLeaveDeduction` 순수 + `UseLeaveUseCase`, ADMIN 엔드콘). 외부 그룹웨어 트리거가 없어 미뤘던 항목 — 권위 있는 도메인 규칙을 미리 박아두는 게 더 안전하다고 판단, ADMIN 디버그/시연용으로 노출. 외부 통합 시 같은 use case 재사용.
- 2026-05-28 — **FR-4.2 유찰 재고 처리** 구현 — `GrantEventFromUnsoldUseCase`(UNSOLD→EVENT 변환, 경매 행 삭제) + `PurgeUnsoldAuctionsUseCase` + 12/31 `PurgeUnsoldAuctionsScheduler`. SRS 제약 "익년 이월 회계상 원천 차단" 충족. 새 파일 헤더에 "왜 이게 늦게 들어왔나" 분석 주석 박음.
