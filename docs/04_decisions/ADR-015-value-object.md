# ADR-015: Value Object 도입 정책

- **상태**: ✅ Accepted
- **결정일**: 2026-05-14
- **결정자**: 타임소프트콘

## 컨텍스트

도메인의 핵심 식별자·값들이 모두 원시 타입(`number`, `string`)으로 표현되면 다음 문제가 발생한다:

```typescript
// 1. Primitive Obsession — 타입은 같지만 의미가 다름
function placeBid(userId: number, auctionId: number, amount: number) { ... }
placeBid(auctionId, userId, amount);  // 컴파일 통과, 런타임 버그

// 2. 검증 분산 — Point는 음수 금지인데 매번 체크해야 함
if (amount < 0) throw ...

// 3. 도메인 표현력 부족 — 1포인트와 1일은 같은 number지만 의미는 다름
```

[[ADR-012]] Hexagonal에서 도메인 코어는 *외부 라이브러리 무의존* 원칙. 그러나 *타입 안전*과 *불변식 강제*는 도메인 자체에서 보장해야 한다 → Value Object 패턴.

## 초기 아이디어 (Rejected)

### 옵션 X — 모든 원시 타입을 *클래스*로 wrap
- 모든 ID·금액·일수·이메일·이름을 클래스로
- **거절 이유**: 보일러플레이트 폭발. 학교 프로젝트 9주 일정에 부담.

### 옵션 Y — 원시 타입만 사용 (Value Object 도입 안 함)
- **거절 이유**: 위 3가지 문제 그대로. 특히 1번(타입 혼동)이 *재무 정합성*에 직결 — 자칫 `userId`로 `amount`를 차감하는 버그.

### 옵션 Z — 라이브러리 사용 (`io-ts`, `zod` 등)
- **부분 채택**: 입력 검증(REST 경계)에는 zod 사용 권장. 그러나 *도메인 내부*는 자체 Value Object 사용 (외부 라이브러리 침투 방지 — [[ADR-012]]).

## 회피한 리스크

💣 **Primitive Obsession 기반 버그**
- 같은 `number` 타입의 인자 순서 바뀜 → 컴파일러가 못 잡음
- 재무 트랜잭션에서 발생 시 *심각한 정합성 사고*

💣 **불변식 검증 분산**
- "포인트는 음수 금지", "일수는 정수만" 등이 곳곳에 흩어짐
- 한 곳 누락 시 데이터 오염

💣 **도메인 표현력 부족**
- 코드가 자기-문서화 안 됨 → 신규 팀원·검토자 이해 비용 ↑

## 결정

**Tiered Value Object — 도메인 핵심만 wrap, 나머지는 원시 타입 + 검증**

### Tier 1 — 강한 Value Object (클래스 or Brand)

다음은 *반드시* Value Object로 wrap:

| Value Object | 표현 | 불변식 | 구현 방식 |
|---|---|---|---|
| `UserId` | 사용자 식별자 | `> 0` 정수 | `class UserId { constructor(readonly value: bigint) { ... } }` |
| `AuctionId` | 경매 식별자 | `> 0` 정수 | 클래스 |
| `EmpId` | 사번 (HR 연동) | 정해진 패턴 (예: `^E\d{5}$`) | 클래스 |
| `Point` | 포인트 금액 | `>= 0` 정수 | 클래스 + 산술 메서드 (`add`, `subtract`) |
| `LeaveDays` | 휴가 일수 | `>= 0` 정수 | 클래스 |
| `LeaveType` | REGULAR / AUCTION / EVENT | enum 한정 | TypeScript enum |
| `Year` | 정산 연도 | `>= 2020` 정수 | 클래스 |
| `Currency` | 화폐 코드 | enum + 사전 등록 | TypeScript enum + 등록 검증 |

### Tier 2 — Brand Type (가벼운 wrap)

DB row를 다룰 때마다 클래스 인스턴스화는 부담 → TypeScript Brand Type으로 *컴파일 타임만* 보호:

```typescript
type Brand<T, B> = T & { readonly __brand: B };
type Email = Brand<string, 'Email'>;
type IsoTimestamp = Brand<string, 'IsoTimestamp'>;
```

Tier 2는 **검증·산술이 거의 없고, 단순 식별·표현용**일 때 사용.

### Tier 3 — 원시 타입 그대로

다음은 원시 타입 + 경계에서의 zod 검증만으로 충분:

- HTTP request body (입력은 zod 스키마로 검증 후 도메인 객체 생성)
- 로그 메시지, 디버그 출력
- 외부 시스템 raw response
- 단순 boolean / Date

### 핵심 클래스 예시

```typescript
// domain/shared/value-objects/point.ts
export class Point {
  private constructor(private readonly amount: bigint) {}

  static of(value: bigint | number): Point {
    const v = BigInt(value);
    if (v < 0n) throw new InvalidPointError('Point cannot be negative');
    return new Point(v);
  }

  static ZERO = Point.of(0n);

  add(other: Point): Point { return Point.of(this.amount + other.amount); }
  subtract(other: Point): Point {
    if (this.amount < other.amount) throw new InsufficientPointError();
    return Point.of(this.amount - other.amount);
  }

  greaterThan(other: Point): boolean { return this.amount > other.amount; }
  lessThanOrEqual(other: Point): boolean { return this.amount <= other.amount; }

  toBigInt(): bigint { return this.amount; }
  toString(): string { return this.amount.toString(); }
}
```

→ 도메인 코드가 `point.subtract(bid)` 로 자기-문서화. 음수 방지·차감 부족 검증이 *Point 클래스에 응집*.

### 영속성 매핑

Value Object ↔ DB column 매핑은 [[ADR-012]] 어댑터 계층에서:

```typescript
// adapters/persistence/wallet.row.ts → domain
const wallet = new Wallet(
  UserId.of(row.user_id),
  row.currency as Currency,
  Point.of(row.balance),
);
```

도메인은 *Value Object*만, DB row는 *어댑터에서만* — 경계가 명확.

## 결과 및 트레이드오프

### ✅ 긍정적 결과

- **타입 혼동 컴파일 타임 차단** — `placeBid(amount, userId)` 같은 순서 버그 불가능
- **불변식 단일 위치 집중** — `Point` 클래스 하나 보면 모든 규칙 확인
- **도메인 자기-문서화** — `point.subtract(bid)` vs `n - m`
- **테스트 표현력 향상** — `Point.of(1000)` 같은 명시적 의도

### ⚠️ 트레이드오프

- **보일러플레이트** — 클래스 1개 ≈ 30~50줄 (`Point`, `UserId` 등)
- **객체 생성 비용** — 핫 패스에서 수천 번 인스턴스화 시 성능 부담 (단, 본 시스템은 입찰 TPS가 SQLite write 락(직렬화)에 묶여 있어 영향 미미)
- **직렬화/역직렬화 코드 추가** — JSON ↔ Value Object 변환 필요

### 🛡️ 제약

- Value Object는 **불변(immutable)** — `readonly` 필드 + 새 인스턴스 반환
- **`new Point(...)` 직접 호출 금지** — `Point.of(...)` 정적 팩토리만 사용 (검증 강제)
- Value Object는 **equals 메서드 제공** — `===` 객체 동일성이 아닌 *값* 동등성
- 도메인 코어 안에서 **원시 타입을 *직접* 받는 메서드 시그니처 금지** — 항상 Value Object
- 외부 경계(REST·Outbox payload)는 *원시 타입 직렬화*하되 즉시 Value Object로 재구성

### 적용 우선순위 (구현 단계)

1. **Phase 1** (반드시): `UserId`, `Point`, `LeaveDays`, `AuctionId`, `LeaveType`
2. **Phase 2**: `EmpId`, `Year`, `Currency`
3. **Phase 3** (선택): `Email`, `Slug` 등 Brand Type

학교 프로젝트 9주 일정 안에서 Phase 1만 완료해도 의미 있는 안전성 확보.

## 관련 문서

- [[ADR-012]] Hexagonal Architecture — Value Object는 도메인 코어 안에 위치
- [[ADR-013]] Domain Event — 이벤트 필드 타입에 Value Object 사용
- [[ADR-014]] Auction State 패턴 — 상태 메서드 파라미터에 Value Object 사용
- [[db-schema]] — DB 컬럼 ↔ Value Object 매핑 어댑터에서 처리
