# 용어집 (Glossary)

본 프로젝트에서 사용되는 주요 용어, 약어, 도메인 개념 정의.

---

## A. 비즈니스·법률 개념

| 용어 | 정의 |
|---|---|
| **B2E** (Business to Employee) | 회사가 매물을 발행·중개하는 거래 구조. P2P(직원 간 직접 거래)와 대비되는 개념으로, 근로기준법상 휴식권 매매 금지를 우회하기 위한 핵심 법적 프레임. |
| **근로기준법 제60조** | 연차 유급휴가 조항. 본 시스템이 준수해야 하는 핵심 근거 법령. |
| **근로기준법 제61조** | 연차 유급휴가의 사용 촉진 조항. |
| **연차 촉진제도** | 사용자가 직원에게 연차 사용을 독려하는 제도. 미사용 시 소멸될 수 있어 본 시스템의 매물 원천이 됨. |
| **휴식권 매매 금지** | 근로기준법상 연차를 현금이나 유가물로 직접 거래할 수 없다는 원칙. 본 시스템은 "복지 포인트 ↔ 연차 개수"로 우회. |

## B. 시스템 도메인 개념

| 용어 | 정의 |
|---|---|
| **연차 1일권** | 본 시스템의 단일 경매 매물 단위. 특정 날짜에 종속되지 않고 사내 그룹웨어에서 자유롭게 기안할 수 있는 **"연차 잔여 개수 1개"**를 의미. |
| **에스크로 (Escrow)** | 낙찰자들의 포인트를 임시 보관하는 중앙 수익금 대장. 연말 배당의 재원. `ESCROW` 테이블은 `(year, currency)`별 집계. |
| **지분 (Stake)** | **판매자**가 공용 풀에 기여한 연차 일수의 비율. 연말 배당금 정산의 기준. |
| **공용 풀** | 직원들이 반납한 미사용 연차를 취합하여 생성되는 경매 매물 전체. |
| **복지 포인트** | 본 시스템의 거래 재화. 사내 복지 시스템의 기존 포인트를 재활용 ([ADR-009](../04_decisions/ADR-009-point-reuse.md)). 현재 [ADR-010](../04_decisions/ADR-010-currency-abstraction.md)의 `CurrencyProvider` 추상화 뒤의 *유일 구현체*. |
| **Wallet (지갑)** | 직원의 화폐별 잔액 마스터. 본 시스템이 단일 진실 공급원으로 보유 ([ADR-011](../04_decisions/ADR-011-welfare-point-ownership.md)). `wallet(user_id, currency, balance)`. |
| **복지카드 한도** | 연말 배당금이 지급되는 최종 형태. 직원 개인 복지카드의 사용 가능 한도에 (+) 증액됨. 입찰 결제와 무관한 *출금* 채널. |
| **관리자 적립 (CREDIT_ADMIN)** | 관리자가 직원 wallet에 분기·이벤트 포인트를 적립하는 행위. `reason` 필수. 에스크로 등식과 분리 집계 ([ADR-011](../04_decisions/ADR-011-welfare-point-ownership.md), FR-5.1). |
| **3-Way Win Model** | 회사, 판매자(고연차), 구매자(저연차) 모두에게 이득인 구조. SRS 2.2 참조. |

## C. 휴가 속성 플래그 (Leave Type)

휴가는 반드시 다음 3가지 속성 중 하나로 분류되어 부여·차감된다. ([ADR-002](../04_decisions/ADR-002-leave-type-flag.md))

| Flag | 설명 | 연말 수당 | 차감 우선순위 | 이월 |
|---|---|---|---|---|
| **`REGULAR`** | 법정 연차 (근로기준법 제60조) | ✅ 대상 | 3순위 (최후) | ❌ (공용 풀로 전환) |
| **`AUCTION`** | 경매 낙찰로 획득한 연차 | ❌ 제외 | **1순위 (최우선)** | ❌ 소멸 |
| **`EVENT`** | 사내 포상·이벤트로 획득한 연차 | ❌ 제외 | 2순위 | ❌ 소멸 |

**차감 순서**: `AUCTION → EVENT → REGULAR` (백엔드에서 강제, 사용자 선택 불가 — [ADR-003](../04_decisions/ADR-003-forced-priority.md))

## D. 기술·아키텍처 용어

| 용어 | 정의 |
|---|---|
| **MSA** (Microservices Architecture) | 마이크로서비스 아키텍처. 본 시스템은 HR 시스템과 독립적인 MSA로 동작. |
| **분산 락** (Distributed Lock) | 여러 서버 인스턴스에서 공유 자원 접근을 직렬화하는 메커니즘. 본 시스템은 Redis 기반 구현 채택 ([ADR-006](../04_decisions/ADR-006-redis-lock.md)). |
| **Race Condition** | 경쟁 상태. 다수 사용자의 동시 입찰 시 발생할 수 있는 데이터 꼬임. NFR-1의 대응 대상. |
| **Insert-Only Ledger** | 삽입만 허용되는 대장. 수정·삭제 불가. 금융 시스템의 감사 추적성 확보를 위한 패턴. `LEDGER_ENTRY` 테이블(구 `POINT_TRANSACTION_LOG`)에 적용. |
| **Outbox Pattern** | DB 트랜잭션 커밋 후 외부 메시지 발행을 보장하는 패턴. ADR-005 후보. |
| **Saga Pattern** | 분산 트랜잭션을 보상 트랜잭션으로 처리하는 패턴. ADR-005 후보. |
| **Hexagonal Architecture** (Ports & Adapters) | 도메인 코어를 외부 의존(인프라·외부 API)으로부터 격리하는 구조. `domain → ports → adapters` 의존 방향 ([ADR-012](../04_decisions/ADR-012-hexagonal-architecture.md)). |
| **Port / Adapter** | Port는 도메인이 외부에 요구하는 *인터페이스*, Adapter는 그 *구현체*. 예: `LockProvider`(port) ↔ `RedisLockProvider`(adapter). |
| **CurrencyProvider** | 화폐를 추상화한 outbound port. `BiddingCurrency`(입찰 차감)와 `PayoutChannel`(배당 출금)로 ISP 분리 ([ADR-010](../04_decisions/ADR-010-currency-abstraction.md)). |
| **Domain Event** | 도메인에서 발생한 사실(`BidPlacedEvent` 등). EventBus로 fan-out하여 횡단 관심사를 분리 ([ADR-013](../04_decisions/ADR-013-domain-event.md)). |
| **State 패턴** | 객체의 상태별 행위를 상태 객체로 분리하는 GoF 패턴. Auction의 6개 상태에 적용 ([ADR-014](../04_decisions/ADR-014-auction-state-pattern.md)). |
| **Value Object (VO)** | 식별자가 아닌 *값*으로 동등성을 판단하는 불변 객체. `UserId`/`Point`/`LeaveDays` 등 ([ADR-015](../04_decisions/ADR-015-value-object.md)). |
| **WebSocket** | 실시간 양방향 통신 프로토콜. 경매 타이머·최고가 갱신 알림에 사용. |
| **Message Queue** (MQ) | 비동기 메시지 전달 미들웨어. "지금 당장 처리 못 하는 작업을 줄 세워두고 나중에 순서대로 처리"하는 대기열. 실물 예: RabbitMQ, Kafka, AWS SQS, Redis Streams. 본 시스템은 HR API 장애 시 재시도 처리에 활용. |
| **MQ재시도** | 외부 API 호출 실패 시 해당 요청을 MQ에 다시 넣어 일정 시간 후 재처리하는 상태. 지수 백오프와 함께 사용. 상태 다이어그램 `AWARDED` 내부 참조. |
| **지수 백오프** (Exponential Backoff) | 재시도 간격을 2배씩 늘리는 기법(예: 5s → 10s → 20s → 40s). 외부 시스템 과부하 방지 + 일시적 장애 회복 시간 확보가 목적. |
| **DLQ** (Dead Letter Queue) | "죽은 편지 보관함". 최대 재시도 횟수를 초과해도 실패한 메시지를 격리하는 별도 큐. **관리자 수동 개입 필요 신호**. 본 시스템에서는 HR API 장기 장애·영구 오류(잘못된 사번 등) 시 사용 — Slack Critical 알림 동반. |
| **Idempotency Key** | 멱등성 키. 동일 요청이 여러 번 도달해도 결과가 한 번만 적용되도록 보장하는 고유 식별자. 본 시스템은 `auction-{id}-winner-{userId}` 형식 사용 ([ADR-005](../04_decisions/ADR-005-hr-api-timing.md)). |
| **RBAC** (Role-Based Access Control) | **역할 기반 권한**. 사용자의 *역할(role)* 컬럼 값으로 허용·거부 결정. 예: "ADMIN만 wallet 적립 가능" ([permission-matrix.md](permission-matrix.md)). |
| **ABAC** (Attribute-Based Access Control) | **속성 기반 권한**. 리소스의 *속성*(소유자·상태 등)으로 허용·거부 결정. 본 시스템에선 주로 "자기 vs 타인" 소유자 검증에 사용. 예: "본인 wallet만 조회 가능" ([permission-matrix.md](permission-matrix.md)). |

## E. 요구사항 ID 체계

| 접두어 | 의미 | 예시 |
|---|---|---|
| **FR-x.x** | 기능적 요구사항 (Functional Requirement) | FR-2.1 (실시간 입찰) |
| **NFR-x** | 비기능적 요구사항 (Non-Functional Requirement) | NFR-1 (동시성 제어) |
| **DB-RULE-x** | 데이터베이스 무결성 제약 | DB-RULE-1 (대장 불변의 법칙) |
| **ADR-xxx** | 아키텍처 결정 기록 (Architecture Decision Record) | ADR-005 (HR API 타이밍) |

## F. 참여자 (Actor)

### F-1. 시스템 역할 (UML 액터)

**행위 기반 역할**. 동일 직원이 시점별로 여러 역할 동시 보유 가능 — 근속연수·소속과 무관.

| 액터 | 유형 | 설명 |
|---|---|---|
| **직원 (Employee)** | Primary (base) | 모든 사용자의 기본 역할. SSO 로그인, 포인트/연차 조회, 연차 사용 |
| **판매자 (Seller)** ▷ is-a 직원 | Primary | 공용 풀에 `REGULAR` 연차를 기여한 직원. Stake 보유 → 연말 배당금 수령 자격 |
| **구매자 (Buyer)** ▷ is-a 직원 | Primary | 경매에 입찰하는 역할. 포인트 소비 + 낙찰 시 `AUCTION` 속성 연차 획득 |
| **관리자 (Admin)** ▷ is-a 직원 | Primary | 유찰 재고 `EVENT` 수동 지급, 연말 배치 트리거, 감사 로그 열람 |
| **스케줄러 (Batch)** | System | 12/31 자동 정산·배당 배치 실행 |
| **HR 시스템** | **Secondary** | 외부 액터. 본 시스템이 호출하는 API 제공자 (연차 부여, 복지 한도 증액) |

### F-2. 기획 배경 용어 (≠ 시스템 액터)

아래 용어는 **초기 문제 인식용**이며 UML 액터와 무관. 연차 경매의 해결 대상이 되는 인구통계적 집단 지칭.

| 용어 | 설명 |
|---|---|
| 고연차 직원 | 업무 과다로 연차를 다 쓰지 못해 **잉여 연차가 발생**하는 집단 → 판매자 역할의 주요 예비군 |
| 저연차 직원 | 법정 연차가 적어 **휴가 부족**을 호소하는 집단 → 구매자 역할의 주요 예비군 |

> ⚠️ **주의**: 고연차가 반드시 판매자, 저연차가 반드시 구매자인 것은 **아니다**. 시스템은 근속연수로 권한을 구분하지 않으며, 동일 직원이 동일 연도 내에 판매자·구매자·관리자 역할을 동시에 수행할 수 있다.
>
> 예) 김 대리가 3월에 구매자로 2일권 낙찰 → 11월에 본인이 남긴 연차가 공용 풀에 기여되어 이듬해 판매자로 배당 수령.
