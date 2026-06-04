# ADR-014: Auction 도메인에 State 패턴 적용

- **상태**: ✅ Accepted
- **결정일**: 2026-05-14
- **결정자**: 타임소프트콘

## 컨텍스트

[[uml/04-state.md]]가 이미 Auction 객체의 6개 상태(CREATED · OPEN · CLOSED · AWARDED · UNSOLD · EXPIRED)와 복합 상태·choice 의사상태를 정의했다. 코드 레벨에서 이 상태 머신을 어떻게 표현할지가 결정 필요.

각 상태에서 *허용되는 액션*이 다르다:

| 상태 | placeBid | settle | distributeAsEvent | reopenBidding |
|---|---|---|---|---|
| `CREATED` | ❌ | ❌ | ❌ | ❌ |
| `OPEN` | ✅ | ❌ (마감 전) | ❌ | ❌ |
| `CLOSED` | ❌ | ✅ | ❌ | ❌ (정책) |
| `AWARDED` | ❌ | ❌ (1회만) | ❌ | ❌ |
| `UNSOLD` | ❌ | ❌ | ✅ (관리자) | ❌ |
| `EXPIRED` | ❌ | ❌ | ❌ | ❌ |

→ if-else로 흩어두면 새 상태(예: `PAUSED`) 추가 시 모든 Use Case 메서드를 들춰야 한다.

## 초기 아이디어 (Rejected)

### 옵션 X — `Auction.status` enum + 메서드 내부 if-else
```typescript
class Auction {
  status: AuctionStatus;
  placeBid(amount: Cone) {
    if (this.status !== 'OPEN') throw new Error('not open');
    // ...
  }
  settle() {
    if (this.status !== 'CLOSED') throw new Error('not closed');
    // ...
  }
}
```
- **거절 이유**: 상태별 분기가 메서드마다 중복. 새 상태 추가 시 *모든* 메서드 수정. 상태 전이 조건이 코드 곳곳에 산재.

### 옵션 Y — 외부 상태 머신 라이브러리 (예: `xstate`)
- **부분 채택 가능**: 풍부한 기능 (병렬 상태, 가드, side effect 등). 그러나:
- **거절 이유**: NestJS 도메인 모델에 외부 라이브러리 침투. 학습 비용·디버깅 복잡도 ↑. 6개 상태 규모에는 과잉.

## 회피한 리스크

💣 **상태 분기 산재 (Shotgun Surgery)**
- 새 상태·새 액션 추가 시 변경점이 *수십 군데*
- 누락으로 인한 무결성 버그 (e.g., AWARDED에서 placeBid 허용 누락)

💣 **상태 전이 규칙의 *암묵화***
- [[uml/04-state.md]]에 있는 전이 규칙이 코드에 *드러나 보이지 않음*
- 모델과 구현의 *드리프트* 발생

## 결정

**GoF State 패턴 채택 — 각 상태를 객체로 표현**

### 구조

```typescript
// domain/auction/auction.ts
export class Auction {
  private state: AuctionState;
  // ...

  placeBid(bidderId: UserId, amount: Cone): BidPlacedEvent {
    return this.state.placeBid(this, bidderId, amount);
  }
  settle(): AuctionSettledEvent {
    return this.state.settle(this);
  }
  distributeAsEvent(adminId: UserId, recipientId: UserId): EventLeaveGrantedEvent {
    return this.state.distributeAsEvent(this, adminId, recipientId);
  }
  transitionTo(next: AuctionState) { this.state = next; }
}

// domain/auction/auction-state.ts
export abstract class AuctionState {
  abstract placeBid(a: Auction, bidderId: UserId, amount: Cone): BidPlacedEvent;
  abstract settle(a: Auction): AuctionSettledEvent;
  abstract distributeAsEvent(a: Auction, adminId: UserId, recipientId: UserId): EventLeaveGrantedEvent;

  // 기본: 모두 InvalidStateTransitionError throw
  protected reject(action: string): never {
    throw new InvalidStateTransitionError(this.constructor.name, action);
  }
}

// domain/auction/states/open-state.ts
export class OpenState extends AuctionState {
  placeBid(a: Auction, bidderId: UserId, amount: Cone) {
    if (amount.lessThanOrEqual(a.highestBid)) throw new BidTooLowError();
    a.updateHighestBid(bidderId, amount);
    return new BidPlacedEvent(/* ... */);
  }
  settle(a: Auction) { return this.reject('settle'); }
  distributeAsEvent() { return this.reject('distributeAsEvent'); }
}

// states/closed-state.ts
export class ClosedState extends AuctionState {
  placeBid() { return this.reject('placeBid'); }
  settle(a: Auction) {
    if (a.hasWinner()) a.transitionTo(new AwardedState());
    else a.transitionTo(new UnsoldState());
    return new AuctionSettledEvent(/* ... */);
  }
  distributeAsEvent() { return this.reject('distributeAsEvent'); }
}

// states/unsold-state.ts
export class UnsoldState extends AuctionState {
  placeBid() { return this.reject('placeBid'); }
  settle() { return this.reject('settle'); }
  distributeAsEvent(a: Auction, adminId: UserId, recipientId: UserId) {
    if (!adminId.isAdmin()) throw new ForbiddenError();
    a.markDistributed();
    return new EventLeaveGrantedEvent(/* ... */);
  }
}
```

### 영속성 매핑

DB의 `auction_status` ENUM 컬럼 ↔ 상태 객체 변환은 *어댑터 계층*에서 처리 ([[ADR-012]] Hexagonal):

```typescript
// adapters/persistence/auction-state-mapper.ts
const STATE_MAP: Record<AuctionStatus, () => AuctionState> = {
  OPEN:     () => new OpenState(),
  CLOSED:   () => new ClosedState(),
  AWARDED:  () => new AwardedState(),
  UNSOLD:   () => new UnsoldState(),
  EXPIRED:  () => new ExpiredState(),
  CREATED:  () => new CreatedState(),
};
```

→ DB·도메인 매핑 경계는 어댑터에 격리. 도메인은 *객체*만 다룬다.

### 상태 객체는 무상태(stateless) — Flyweight

각 상태 객체는 *Auction 인스턴스의 데이터를 읽고 수정*하지만 *자신은 데이터를 보유하지 않는다*. 따라서 싱글톤(Flyweight)으로 재사용 가능 — 성능 부담 없음.

### Domain Event와의 연결

각 상태 메서드는 [[ADR-013]]의 도메인 이벤트를 *반환*한다. Use Case가 이를 받아 EventBus에 발행한다. 도메인 코어는 외부 의존(EventBus) 없이 순수.

## 결과 및 트레이드오프

### ✅ 긍정적 결과

- **상태 전이 규칙의 *코드화*** — [[uml/04-state.md]]와 1:1 매핑
- **OCP 충족** — 새 상태 추가 시 새 클래스 1개만 추가
- **컴파일러 강제** — `AuctionState` 추상 메서드 미구현 시 빌드 실패
- **테스트 단순화** — 각 상태 객체를 *독립적으로* 단위 테스트
- **[[ADR-012]] Hexagonal과 정합** — 도메인 코어 안의 순수 객체

### ⚠️ 트레이드오프

- **클래스 수 증가** — 6개 상태 = 6개 클래스 (디렉토리 깊이 ↑)
- **`Auction` 객체가 상태를 *위임***하는 간접 호출 — 디버거 추적이 한 단계 깊어짐
- **상태 객체 ↔ DB enum 매핑 코드 별도 필요** — 어댑터에 매퍼 함수

### 🛡️ 제약

- 상태 객체는 **무상태(stateless)** 유지 — 인스턴스 변수 금지
- 상태 전이는 **반드시 `Auction.transitionTo()` 경유** — 외부에서 `auction.state =` 직접 대입 금지
- DB의 `auction_status` 컬럼과 상태 클래스 이름은 **반드시 동기화** — 불일치 시 매퍼에서 *명시적 에러*
- 복합 상태(OPEN의 내부 입찰대기중/최고가갱신중/알림발송중)는 코드 레벨에서는 *별도 상태 객체*로 분리하지 않음 — UML의 *개념적* 분리에 그침 (실제 입찰 흐름은 Use Case + 트랜잭션이 담당)

## 관련 문서

- [[uml/04-state.md]] — 6개 상태와 전이 규칙의 *모델*
- [[ADR-012]] Hexagonal Architecture — 상태 객체는 도메인 코어 안에 위치
- [[ADR-013]] Domain Event — 상태 메서드가 이벤트를 반환
- [[ADR-015]] Value Object — UserId·Cone 등 상태 메서드 파라미터 타입
