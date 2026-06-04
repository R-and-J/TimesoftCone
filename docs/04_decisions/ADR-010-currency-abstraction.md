# ADR-010: 통화 추상화 레이어 (Currency Provider Interface)

- **상태**: ✅ Accepted
- **결정일**: 2026-05-14
- **결정자**: 타임소프트콘

## 컨텍스트

경매의 입찰 재화와 배당 지급 형태가 [[ADR-009]]에서 "사내 복지 콘"로 결정되어 있다. 그러나 **정책(어떤 화폐를 쓸지)** 과 **구조(어떻게 결합할지)** 는 별개의 관심사다.

만약 미래에 다음과 같은 변화가 발생하면:

- 사내 복지 콘 정책이 폐지·교체됨
- 신규 화폐(예: "LEAVE COIN")로 전환 결정
- 본 시스템의 SaaS화로 회사마다 다른 화폐를 주입해야 함
- 다중 화폐 동시 운용 (복지 콘 + 마일리지 등)

이때 경매·배당의 *코어 도메인 로직*이 화폐 종류를 알고 있다면 변경 비용이 폭발한다.

> **OCP의 원전 정의**: "Open for extension, closed for modification"

→ 화폐를 *교체 가능한 외부 어댑터*로 추상화하고, 코어 도메인은 인터페이스에만 의존하도록 설계한다.

## 초기 아이디어 (Rejected)

> "코어 도메인이 직접 `USERS.current_point` 컬럼과 `POST /api/hr/welfare` API를 호출한다."

이 방식은 [[ADR-009]] 시점에 이미 *암묵적으로* 가정되어 있었으나, 다음 문제가 있다:

1. **DB 컬럼명·테이블명·API 엔드콘이 코어에 침투** → 화폐 교체 시 도메인 코드 수정 필요
2. **테스트 어려움** — 단위 테스트에서 실제 DB·HR 모킹 필요
3. **Mock HR 환경 분리 불가** ([[wbs]] R2 리스크 — WireMock HR 서버 사용 시 어댑터 필수)

## 회피한 리스크

💣 **화폐 정책 변경 시 코어 도메인 수정 필요 (OCP 위반)**
- 화폐 교체 = 경매·배당·정산·로그 코드 전체 수정
- 회귀 테스트 범위 폭발

💣 **테스트·Mock 환경 격리 불가**
- 단위 테스트에서 HR API를 stub 처리 못 함
- 학교 프로젝트 발표 시연 시 실 HR API 의존 위험

## 결정

**CurrencyProvider 추상화 + ISP 분리 (2-인터페이스)**

```typescript
// 인터페이스 #1: 경매 시점에 사용 (DB 내부 트랜잭션)
export interface BiddingCurrency {
  readonly currencyCode: string;            // 'WELFARE_POINT'

  getBalance(userId: UserId): Promise<bigint>;

  // 입찰 시 즉시 차감 (홀드 없음 — ADR-009 §6)
  debit(userId: UserId, amount: bigint, ref: TransactionRef): Promise<void>;

  // 유찰·취소 환불 (REFUND 로그)
  credit(userId: UserId, amount: bigint, ref: TransactionRef): Promise<void>;
}

// 인터페이스 #2: 배당 시점에 사용 (외부 채널 송출)
export interface PayoutChannel {
  readonly channelCode: string;             // 'WELFARE_CARD_LIMIT'

  // 연말 배당 출금 — Outbox로 보내야 함
  payout(userId: UserId, amount: bigint, ref: TransactionRef): Promise<PayoutResult>;
}

export interface TransactionRef {
  actionType: 'BID' | 'WIN' | 'REFUND' | 'DIVIDEND' | 'CREDIT_ADMIN' | 'EXPIRE';
  auctionId?: AuctionId;
  reason?: string;
}
```

### 인터페이스 2개로 분리하는 이유 (ISP)

| 인터페이스 | 사용자 | 호출 특성 |
|---|---|---|
| `BiddingCurrency` | `AuctionService` / `BidService` | DB 내부 트랜잭션, 동기 |
| `PayoutChannel` | `DividendService` | 외부 채널 송출, [[ADR-005]] Outbox 경유 |

경매 서비스가 `payout`을 보지 못하고, 배당 서비스가 `debit/credit`을 보지 못한다. 의존성 표면이 줄어든다.

### 구현체 등록 (현재)

```typescript
// app.module.ts
{
  provide: 'BiddingCurrency',
  useClass: WelfarePointProvider,
},
{
  provide: 'PayoutChannel',
  useClass: WelfareCardLimitChannel,
}
```

- `WelfarePointProvider` — 내부 wallet 테이블 마스터 ([[ADR-011]] 참조)
- `WelfareCardLimitChannel` — HR `/api/hr/welfare` API 호출 (Outbox 경유)

### 미래 확장 시나리오 (Open for extension)

| 시나리오 | 추가할 구현체 | 코어 수정 |
|---|---|---|
| LEAVE COIN 전환 | `LeaveCoinProvider` | ❌ DI 설정만 |
| 사내 마일리지 통합 | `MileageProvider` + 다중 currency 정책 | ❌ DI 설정만 |
| SaaS화 — A사용 어댑터 | `CompanyAWelfareProvider` | ❌ DI 설정만 |
| 배당 채널을 *급여*로 변경 | `PayrollBonusChannel` | ❌ DI 설정만 |

## 결과 및 트레이드오프

### ✅ 긍정적 결과

- **OCP 충족** — 화폐 정책 변경 시 코어 무수정
- **테스트 용이** — `InMemoryCurrencyProvider` / `MockPayoutChannel`로 단위 테스트 가능
- **[[ADR-005]] Outbox 경계와 자연 정합** — `debit/credit`(내부) vs `payout`(외부)
- **[[ADR-009]]와 충돌 없음** — "현재 어떤 화폐를 쓸지"는 ADR-009, "어떻게 결합할지"는 본 ADR

### ⚠️ 트레이드오프

- **단기 구현 부담 증가** — 인터페이스 + DI 설정 + Mock 구현체 추가
- **러닝 커브** — 팀원이 Strategy/Adapter 패턴 숙지 필요
- **YAGNI 비판 가능성** — 학교 프로젝트에서 실제 화폐 교체 가능성은 낮음 → 발표 시 *"왜 추상화했는가"* 정당화 준비 필요

### 🛡️ 제약

- 인터페이스 메서드 시그니처는 **모든 구현체에 호환 가능한 *최소 공약수*** 여야 함
- 화폐 단위(`bigint`)는 모든 구현체에서 *동일 정밀도*를 보장해야 함 → [[NFR-2]]의 재무 정합성 공식이 화폐별로 분리되어야 할 수 있음
- 다중 화폐 운용 시 [[ADR-001]]의 에스크로 등식이 *통화별*로 분리 검증 필요

## 관련 문서

- [[ADR-001]] 에스크로 모델 — 정합성 공식이 본 추상화에서도 보장되어야 함
- [[ADR-005]] HR API 호출 시점 — `payout`은 Outbox 경유
- [[ADR-009]] 복지 콘 재활용 — 본 ADR과 분리된 *정책* 결정
- [[ADR-011]] 복지 콘 시스템 자체 보유 — `WelfarePointProvider`의 구현 근거
- [[ADR-012]] Hexagonal Architecture — 본 ADR의 상위 구조 결정
- [[SRS]] §2.1 외부 인터페이스 — 호출 시점이 본 ADR에 의해 어댑터 뒤로 격리됨
