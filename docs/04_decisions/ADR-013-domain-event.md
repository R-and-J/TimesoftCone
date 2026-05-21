# ADR-013: Domain Event 기반 횡단 관심사 처리

- **상태**: ✅ Accepted
- **결정일**: 2026-05-14
- **결정자**: 타임소프트콘

## 컨텍스트

입찰 1건이 발생하면 다음이 동시에 일어나야 한다:

1. WebSocket 브로드캐스트 (실시간 최고가 갱신)
2. 이전 최고가 입찰자에게 *알림* (FR-2.1)
3. Prometheus 메트릭 기록
4. `LEDGER_ENTRY`에 BID 로그 INSERT
5. (실패 시) Slack Critical 알림

낙찰 1건이 발생하면:

1. `LEDGER_ENTRY`에 WIN 로그 INSERT
2. 에스크로 적립
3. Outbox에 HR `/leave` 호출 요청 INSERT ([[ADR-005]])
4. WebSocket 마감 브로드캐스트
5. 메트릭·감사 로그

이를 *하나의 서비스 메서드*에서 모두 처리하면 SRP 폭주 + 결합도 폭발이 발생한다.

## 초기 아이디어 (Rejected)

### 옵션 X — 단일 메서드 안에서 순차 호출
```typescript
async placeBid(...) {
  await this.bidRepo.save(...);
  await this.wsGateway.broadcast(...);
  await this.notifier.notify(previousBidder);
  this.metrics.increment(...);
  await this.ledger.insert(...);
}
```
- **거절 이유**: 새 부수효과 추가 시 `placeBid` 메서드 수정 (OCP 위반), 단위 테스트가 모든 의존성 모킹 요구

### 옵션 Y — Aspect-Oriented Programming (AOP)
- **부분 채택**: NestJS Interceptor가 이를 일부 담당 가능. 그러나 *비즈니스 의미가 있는 부수효과*는 AOP가 부적절 (인증·로깅 등 *기술적* 횡단 관심사에만 적합).

## 회피한 리스크

💣 **God Service**
- `AuctionService`가 도메인·인프라·알림·로깅을 다 떠안음

💣 **부수효과 추가의 폭발적 비용**
- 새 알림 채널·새 메트릭·새 감사 요구사항이 *코어 메서드*를 매번 수정

💣 **트랜잭션 경계 모호**
- 외부 호출(WebSocket, Slack)이 DB 트랜잭션 안에서 실행되면 트랜잭션 길어지고 락 지연

## 결정

**도메인 이벤트(Domain Event) + 인-프로세스 이벤트 버스(Observer 패턴) 채택**

### 이벤트 정의 (도메인 코어 안)

```typescript
// domain/auction/events.ts
export class BidPlacedEvent {
  constructor(
    public readonly auctionId: AuctionId,
    public readonly bidderId: UserId,
    public readonly amount: Point,
    public readonly previousHighestBidderId: UserId | null,
    public readonly occurredAt: Date,
  ) {}
}

export class AuctionWonEvent { /* ... */ }
export class AuctionExpiredEvent { /* ... */ }
export class DividendDistributedEvent { /* ... */ }
export class WalletCreditedEvent { /* ... */ }
```

### 발행 (Use Case 안에서)

```typescript
// application/place-bid.usecase.ts
async execute(cmd: PlaceBidCommand) {
  await this.lockProvider.withLock(`auction:${cmd.auctionId}`, async () => {
    await this.unitOfWork.transaction(async (tx) => {
      const auction = await this.auctionRepo.findById(cmd.auctionId, tx);
      const event = auction.placeBid(cmd.bidderId, cmd.amount);  // 도메인이 이벤트 *반환*
      await this.auctionRepo.save(auction, tx);
      await this.ledger.insertBid(event, tx);                    // 트랜잭션 내부
      this.eventBus.publish(event);                              // 커밋 후 발행
    });
  });
}
```

### 구독 (어댑터 계층 — N개의 핸들러)

```typescript
// adapters/notification/bid-broadcaster.handler.ts
@OnEvent('auction.bid.placed')
class BidBroadcasterHandler {
  handle(event: BidPlacedEvent) {
    this.wsGateway.broadcast(`auction:${event.auctionId}`, ...);
  }
}

// adapters/notification/previous-bidder-notifier.handler.ts
@OnEvent('auction.bid.placed')
class PreviousBidderNotifierHandler { ... }

// adapters/metrics/bid-metrics.handler.ts
@OnEvent('auction.bid.placed')
class BidMetricsHandler { ... }
```

→ Use Case는 *이벤트 발행*까지만 책임. 누가 듣는지는 모름. **OCP 충족**: 새 구독자 추가 시 Use Case 무수정.

### 발행 시점 규칙 (중요)

| 이벤트 종류 | 발행 시점 | 이유 |
|---|---|---|
| **State Mutation 이벤트** (`BidPlaced`, `AuctionWon`) | **DB COMMIT 후** | 트랜잭션 롤백 시 이벤트도 무효 |
| **외부 시스템 호출 트리거** (`AuctionWon → HR`) | **Outbox 경유** ([[ADR-005]]) | 이벤트 버스는 *프로세스 내부*만, 외부는 Outbox |
| **단순 알림** (Slack, WebSocket) | 이벤트 버스 동기/비동기 핸들러 | 실패해도 도메인에 영향 없음 |

→ 이벤트 버스와 Outbox의 *역할 분리*: 이벤트 버스는 *프로세스 내부 fan-out*, Outbox는 *프로세스 경계 이상의 신뢰성 발행*.

### 구현 선택

- **NestJS `@nestjs/event-emitter`** (Node EventEmitter 기반) — 동기/비동기 핸들러 지원
- 미래에 *프로세스 외부*로 확장 시 동일 인터페이스(`EventBus`)에 Kafka 어댑터로 교체 가능 — [[ADR-012]] outbound port

## 결과 및 트레이드오프

### ✅ 긍정적 결과

- **SRP 회복** — Use Case는 도메인 변경만, 부수효과는 핸들러
- **OCP 충족** — 새 부수효과는 새 핸들러 추가
- **트랜잭션 경계 명확** — 외부 호출이 DB 트랜잭션 밖
- **테스트 용이** — Use Case 테스트 시 이벤트 발행 *검증*만, 실제 핸들러 동작은 별도 테스트
- **[[ADR-012]] Hexagonal과 정합** — EventBus가 outbound port

### ⚠️ 트레이드오프

- **이벤트 흐름 추적이 *암묵적*** — "이 이벤트는 누가 듣는가?"가 코드 검색을 강요
- **순서 보장 어려움** — 동기 핸들러 다중 등록 시 등록 순서 의존 위험
- **이벤트 *유실* 가능성** — 인-프로세스 이벤트 버스는 *신뢰성 발행* 보장 안 함 (그래서 외부 트리거는 Outbox로)

### 🛡️ 제약

- 도메인 이벤트는 **불변(immutable)** — 발행 후 수정 금지
- 이벤트 클래스는 **도메인 코어에 위치** — `@nestjs/event-emitter` 데코레이터 직접 사용 금지 (`EventBus` 인터페이스 경유)
- 핸들러는 **각자의 트랜잭션** — 부수효과 핸들러 실패가 본 트랜잭션 롤백 유발 금지
- **외부 시스템 호출은 본 이벤트 버스로 트리거하지 않음** — Outbox 사용 ([[ADR-005]])

## 관련 문서

- [[ADR-005]] HR API 호출 시점 (Outbox) — 외부 신뢰성 발행
- [[ADR-012]] Hexagonal Architecture — EventBus가 outbound port
- [[ADR-014]] Auction State 패턴 — 상태 전이가 이벤트를 *반환*
- [[SRS]] FR-2.1, FR-2.2 — 실시간 알림 요구사항
