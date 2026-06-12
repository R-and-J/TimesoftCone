# 이벤트 버스(Observer) 사용 가이드

In-process 도메인 이벤트 버스로 **부수효과를 Use Case에서 분리**한다(Observer/pub-sub, [ADR-013](../04_decisions/ADR-013-domain-event.md)). 발행자(Use Case)는 누가 듣는지 모르고, 구독자(핸들러)는 같은 이벤트에 자유롭게 얹힌다 → **새 부수효과를 추가해도 Use Case는 안 건드린다(OCP)**.

> 구현체는 `@nestjs/event-emitter`(EventEmitter2). 프로세스 *내부* fan-out 전용. **외부 시스템 호출(HR API 등)은 이 버스가 아니라 Outbox로** ([ADR-005](../04_decisions/ADR-005-hr-api-timing.md)).

## 3단계 레시피

### ① 이벤트 정의 — `backend/src/application/events/`
이벤트 이름 상수 + 불변 클래스. **도메인이 아니라 application 계층**에 둔다(도메인 순수성 유지 — `domain/`은 외부 의존 0).

```ts
// application/events/auction-events.ts
export const AUCTION_EVENTS = {
  BID_PLACED: "auction.bid_placed",
  WON: "auction.won",
  INVENTORY_CREATED: "auction.inventory_created",
} as const;

export class BidPlacedEvent {
  constructor(
    public readonly auctionId: string,
    public readonly bidderId: bigint,
    public readonly amount: bigint,
    public readonly previousHighBidderId: bigint | null,
    public readonly previousHighAmount: bigint | null,
  ) {}
}
```

### ② 발행 — Use Case에서, **트랜잭션 커밋 후**
`EventEmitter2`를 주입하고, `uow.run(...)`이 **성공적으로 반환된 뒤**(=커밋 후) emit한다. 롤백 시엔 emit에 도달하지 않으므로 헛알림이 없다.

```ts
constructor(
  @Inject(UNIT_OF_WORK) private readonly uow: UnitOfWork,
  private readonly events: EventEmitter2,
) {}

async execute(input: PlaceBidInput) {
  const result = await this.uow.run(async (tx) => { /* ...DB 작업... */ return r; });

  // ✅ 커밋 성공 후에만 발행
  this.events.emit(
    AUCTION_EVENTS.BID_PLACED,
    new BidPlacedEvent(result.auctionId, bidder.toBigInt(), amount.toBigInt(),
      result.refundedTo, result.refundedAmount),
  );
  return result;
}
```

> ⚠️ **트랜잭션 안에서 emit 금지.** 핸들러는 별도 작업(별도 트랜잭션)이라, 본 트랜잭션이 롤백돼도 핸들러가 이미 실행됐을 수 있다.

### ③ 구독 — 새 핸들러 추가 (Use Case 무수정)
`@OnEvent`로 듣는다. **핸들러는 throw하면 안 된다** — 부수효과 실패가 입찰/정산 같은 핵심 흐름을 깨면 안 되므로 try/catch로 삼키고 로그만 남긴다.

```ts
// adapters/notification/notification.observer.ts
@Injectable()
export class NotificationObserver {
  constructor(private readonly prisma: PrismaService) {}

  @OnEvent(AUCTION_EVENTS.BID_PLACED)
  async onBidPlaced(e: BidPlacedEvent) {
    if (e.previousHighBidderId === null) return;
    try {
      await this.prisma.notification.create({ data: { /* ... */ } });
    } catch (err) {
      this.logger.warn(`알림 적재 실패: ${(err as Error).message}`); // throw 안 함
    }
  }
}
```

마지막으로 **`app.module`에 등록**:
```ts
imports: [ /* ... */ EventEmitterModule.forRoot() ],   // 버스 활성화 (1회)
providers: [ /* ... */ NotificationObserver ],          // 새 구독자 등록
```

## 현재 이벤트 ↔ 구독자

이벤트는 4개 그룹(`application/events/`): `auction-events.ts` · `charge-events.ts`(ADR-024) · `redemption-events.ts`(ADR-023) · `notification-events.ts`. 모든 도메인 이벤트는 `NotificationObserver`(단일 실구독자, 10개 핸들러)가 받아 `notification` 행을 적재하고, 내부적으로 `notification.created`를 재발행 → **`NotificationStream`(SSE)** 가 듣고 사용자 화면으로 실시간 push 한다.

| 이벤트 | 발행 위치 | 구독자 핸들러 | 동작(알림 type) |
|---|---|---|---|
| `auction.bid_placed` | `PlaceBidUseCase` | `onBidPlaced` | 직전 최고가자에게 `OUTBID` |
| `auction.won` | `SettleAuctionUseCase` (수동·스케줄러 공통) | `onAuctionWon` | 낙찰자에게 `AUCTION_WON` |
| `auction.inventory_created` | `CollectLeavePoolUseCase` (ADR-017) | `onInventoryCreated` | 관리자들에게 `INVENTORY_CREATED` |
| `charge.submitted` | 충전 요청 등록 (ADR-024) | `onChargeRequestSubmitted` | 관리자들에게 `CHARGE_REQUEST_SUBMITTED` |
| `charge.approved` / `charge.rejected` | 충전 승인/반려 | `onChargeApproved` / `onChargeRejected` | 요청자에게 `CHARGE_APPROVED`/`CHARGE_REJECTED` |
| `redemption.submitted` | 교환 신청 (ADR-023) | `onRedemptionSubmitted` | 관리자들에게 `REDEMPTION_REQUEST_SUBMITTED` |
| `redemption.approved` / `redemption.rejected` | 교환 승인/반려 | `onRedemptionApproved` / `onRedemptionRejected` | 요청자에게 `REDEMPTION_APPROVED`/`REDEMPTION_REJECTED` |
| `redemption.received` | 사용자 수령 컨펌 | `onRedemptionReceived` | 관리자들에게 `REDEMPTION_RECEIVED` |
| `notification.created` | `NotificationObserver`(위 핸들러들이 재발행) | `NotificationStream` | SSE로 사용자 화면 실시간 push |

> 실시간 전달은 WebSocket이 아니라 **SSE**(`@Sse`, `NotificationStream`/`AuctionStream`)로 구현됨 — CUT-6의 대체. 같은 버스에 **Slack 운영알림·메트릭** 핸들러를 더 붙이는 것이 다음 확장 지점이고, 핸들러만 추가하면 되며 위 ②는 손대지 않는다.

## 규칙 요약 (체크리스트)

- [ ] 이벤트 클래스는 `application/events/`에 (도메인 아님), 불변.
- [ ] 발행은 **커밋 후**. 트랜잭션 안에서 emit 금지.
- [ ] 핸들러는 **throw 금지**(try/catch + 로그). 각자 별도 트랜잭션.
- [ ] **외부 시스템 호출은 이 버스 금지** → Outbox([ADR-005](../04_decisions/ADR-005-hr-api-timing.md)).
- [ ] 새 구독자는 `app.module` providers에 등록.

## 코드 레퍼런스
- 이벤트: `backend/src/application/events/auction-events.ts`
- 발행: `backend/src/application/auction/place-bid.use-case.ts`, `settle-auction.use-case.ts`
- 구독: `backend/src/adapters/notification/notification.observer.ts`
- 배선: `backend/src/app.module.ts` (`EventEmitterModule.forRoot()`)
- 설계 근거: [ADR-013](../04_decisions/ADR-013-domain-event.md)
