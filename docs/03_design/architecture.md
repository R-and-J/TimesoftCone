# 시스템 아키텍처

**상태**: 🟡 v2 — Hexagonal Architecture(ADR-012), 구조 ADR(010·013·014·015), 휴가 내부화(ADR-005·016·017) 반영
**관련 문서**: [SRS 2.1 제품 관점](../02_requirements/SRS.md#21-제품-관점) / [tech-stack.md](../06_tech/tech-stack.md) / [ADR-012](../04_decisions/ADR-012-hexagonal-architecture.md)

> ### ⚠️ As-Built 차이 (2026-06-12 코드 기준)
> 아래 다이어그램·서술은 **설계 모델**이다. 실제 구현과 다음이 다르다(발표/평가 시 함께 설명):
> - **실시간**: "WebSocket Gateway/브로드캐스트"는 실제 **SSE**(`@Sse`, `AuctionStream`/`NotificationStream`) — CUT-6 대체.
> - **Escrow**: 별도 `Escrow` 테이블/`EscrowRepository`는 **없다.** 에스크로 잔액은 `ledger_entry`에서 통화별로 파생 집계(`Σ(BID+WIN)−Σ(REFUND+DIVIDEND)`).
> - **권한(RBAC)**: 2-role(EMPLOYEE/ADMIN)이 아니라 **5-role**(`ADMIN·EZPASS_ADMIN·EXAM_ADMIN·EZPASS·EXAM`) + 멀티테넌시(`company`). 인증은 ezpass 위임/local 모드(ADR-019~022).
> - **동시성/Redis**: Redis 분산 락 미사용 → SQLite write 락(`lockAuction` no-op UPDATE, CUT-1).
> - **State 패턴**: 미구현(CUT-3) → `AuctionStatus` enum + guard.
>
> 권위 있는 as-built 레퍼런스: [erd.md](erd.md) · [openapi.yaml](openapi.yaml) · [backend/README.md](../../backend/README.md) · [tech-stack.md As-Built 표](../06_tech/tech-stack.md).

---

## 1. 논리 아키텍처 (Logical Architecture)

```
┌───────────────────────────────────────────────────────────────────┐
│                        클라이언트 (Client)                          │
│   ┌─────────────────┐   ┌─────────────────┐   ┌────────────────┐  │
│   │  직원 웹 UI      │   │  관리자 UI       │   │ 모바일(선택)    │  │
│   └────────┬────────┘   └────────┬────────┘   └───────┬────────┘  │
└────────────┼──────────────────────┼────────────────────┼──────────┘
             │ HTTPS / WebSocket    │                    │
┌────────────▼──────────────────────▼────────────────────▼──────────┐
│                    API Gateway / Load Balancer                     │
└────────────┬───────────────────────────────────────────────────────┘
             │
┌────────────▼──────────────────────────────────────────────────────┐
│              애플리케이션 계층 (MSA — 내부는 Hexagonal)             │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────────────┐     │
│  │ AuthService  │  │AuctionService│  │  DividendService     │     │
│  │  (SSO)       │  │ (입찰/낙찰)   │  │  (연말 배당)          │     │
│  └──────┬───────┘  └──────┬───────┘  └──────────┬───────────┘     │
│         │                 │                     │                 │
│  ┌──────┴─────────────────┴─────────────────────┴──────────┐     │
│  │     공통: 인증 미들웨어 / 로깅 / 메트릭 / EventBus         │     │
│  └──────────────────────────────────────────────────────────┘     │
└──────┬─────────────────┬──────────────────┬────────────────────┘
       │                 │                  │
┌──────▼─────┐   ┌──────▼─────────┐   ┌──────▼─────┐
│ SQLite     │   │ Outbox / MQ    │   │ 외부: HR    │
│ (원장 +     │   │ (HR 호출 큐)    │   │  시스템 API │
│  wallet DB  │   │                │   │            │
│  + write 락)│   │                │   │            │
└────────────┘   └────────────────┘   └────────────┘
```

> **MSA 경계 주의**: 각 서비스는 *논리적으로* 분리되어 있으나, 입찰·정산·배당이 공유하는 `wallet`·`escrow`·`stake` 데이터로 인해 *물리적으로는* 단일 배포 단위로 시작한다. 진짜 마이크로서비스 분리는 Hexagonal 경계(ADR-012)가 자연 분리선을 제공한다.

## 2. Hexagonal 내부 구조 (ADR-012)

각 서비스 *내부*는 Ports & Adapters로 구성된다. 도메인 코어는 외부 라이브러리 의존 0.

```
       ┌─────────────  Inbound Adapters (interfaces/)  ──────────────┐
       │   REST Controller · WebSocket Gateway · Cron · Admin CLI    │
       └────────────────────────────┬───────────────────────────────┘
                                    ▼
               ┌────────  Inbound Ports (application/)  ────────┐
               │  PlaceBidUseCase · SettleAuctionUseCase        │
               │  DistributeDividendUseCase · CreditWalletUseCase│
               └────────────────────┬───────────────────────────┘
                                    ▼
                        ┌──────────────────────┐
                        │   Domain Core        │  ← 외부 라이브러리 0
                        │   (domain/)          │
                        │  Auction(State 패턴) │
                        │  Bid · Escrow · Stake│
                        │  Wallet · Ledger     │
                        │  Value Objects       │
                        │  Domain Events       │
                        └──────────┬───────────┘
                                   ▼
               ┌────────  Outbound Ports (ports/)  ─────────────┐
               │  WalletRepository · AuctionRepository          │
               │  BiddingCurrency · PayoutChannel              │
               │  HrClient · NotificationChannel · EventBus     │
               └────────────────────┬───────────────────────────┘
                                    ▼
       ┌─────────────  Outbound Adapters (adapters/)  ───────────────┐
       │   SQLite · WireMock/Real HR · Slack · Emitter               │
       └─────────────────────────────────────────────────────────────┘
```

의존성 규칙(`domain → 무의존`, `adapters → ports → domain`)은 `eslint-plugin-boundaries`로 컴파일 타임 강제.

## 3. 컴포넌트 책임

| 컴포넌트 | 책임 | 핵심 관심사 |
|---|---|---|
| **AuthService** | SSO 인증 / 세션 / 권한 | HR IdP 연동, JWT 발급 |
| **AuctionService** | 경매 목록·입찰·낙찰·실시간 알림 | State 패턴(ADR-014), SQLite write 락(lockAuction), Domain Event |
| **DividendService** | 지분 계산·연말 배당·배치 | 에스크로 정합성 검증, PayoutChannel |
| **AdminService** | 유찰 재고 수동 지급·관리자 적립·모니터링 | RBAC, 감사 로그 접근, FR-5.1 |
| **SQLite** | 영구 저장소 (User / Wallet / Auction / LeaveBalance / LedgerEntry) | 트랜잭션 무결성, Insert-Only 트리거, write 락(lockAuction) |
| **Outbox / MQ** | HR API 호출 신뢰성 발행 | At-least-once, 멱등 키 |
| **EventBus** | 프로세스 내부 도메인 이벤트 fan-out (ADR-013) | 횡단 관심사 분리 |

### 3.1 외부 자원 추상화 컴포넌트 (ADR-010 · ADR-016)

```
  AuctionService ──> BiddingCurrency (port) ──> WelfarePointProvider   ──> wallet 테이블
  AuctionService ──> LeaveGrantPort  (port) ──> InternalLeaveAdapter   ──> leave_balance 테이블
  DividendService ─> PayoutChannel   (port) ──> WelfareCardLimitChannel ─> Outbox ─> HR /welfare
```

- **입찰·낙찰 경로**: 외부 호출 0. `wallet`·`leave_balance` 테이블이 모두 본 시스템 마스터 ([ADR-011](../04_decisions/ADR-011-welfare-point-ownership.md) · [ADR-016](../04_decisions/ADR-016-internal-leave-system.md)). 낙찰 정산이 단일 DB 트랜잭션으로 닫힘.
- **배당 경로**: `PayoutChannel`만 외부(HR)와 결합. Outbox 경유로 트랜잭션 격리.
- **포트별 어댑터 교체 가능 (OCP)**:
  - `BiddingCurrency` → `WelfarePointProvider` (현재) / `LeaveCoinProvider` 등 (미래)
  - `LeaveGrantPort` → `InternalLeaveAdapter` (현재) / `GroupwareLeaveAdapter` (미래, Outbox 활성화)
  - 어느 경우든 코어 도메인 무수정.

## 4. 배포 아키텍처 (Deployment)

> **🟡 TODO**: 실제 인프라 결정 후 확정

### 후보 구성

**Option A — 매니지드 클라우드 (권장)**

```
[Cloudfront / CloudFlare] → [ALB] → [ECS / Cloud Run + Auto Scaling]
                                      ↓
                              [SQLite (파일 기반)] + [SQS]
```

**Option B — 온프레미스 K8s**

```
[Ingress] → [K8s Pods (Deployment)] → [StatefulSet: PG]
                                      ↓
                                   [RabbitMQ]
```

사용자 관심사(Jenkins/Docker/K8s)를 고려하면 **B안의 K8s 기반이 학습·포트폴리오 측면에서 유리**.

## 5. 데이터 흐름 (Data Flow)

### 5.1 입찰 → 낙찰 → HR 연동 (핵심 시나리오)

```
[입찰]
  PlaceBidUseCase
    ├─ UnitOfWork.lockAuction(id)                ← SQLite write 락(no-op UPDATE)
    └─ UnitOfWork.transaction:
         ├─ auction.placeBid(bidderId, amount)   ← State 패턴: OpenState만 허용
         ├─ BiddingCurrency.debit(...)           ← wallet 차감 (외부 호출 X)
         ├─ LedgerRepository.insert(BID)         ← Insert-Only 원장
         └─ COMMIT
    └─ EventBus.publish(BidPlacedEvent)          ← 커밋 후 발행
         ├─> WebSocket 브로드캐스트 핸들러
         ├─> 이전 최고가 입찰자 알림 핸들러
         └─> 메트릭 기록 핸들러

[낙찰 — 경매 마감 배치]
  SettleAuctionUseCase
    └─ UnitOfWork.transaction:
         ├─ auction.settle()                     ← ClosedState → AwardedState/UnsoldState
         ├─ EscrowRepository.credit(highestBid)
         ├─ LedgerRepository.insert(WIN)
         ├─ LeaveGrantPort.grant(winner, AUCTION) ← InternalLeaveAdapter: leave_balance INSERT (같은 트랜잭션!)
         └─ COMMIT                                ← 전부 원자적, 외부 호출 0 (ADR-005·ADR-016)
    └─ EventBus.publish(AuctionWonEvent)

[미래 — 실 그룹웨어 연동 시]
  SettleAuctionUseCase 의 LeaveGrantPort 구현체를 GroupwareLeaveAdapter로 교체
    → leave_balance INSERT 대신 outbox INSERT
    → OutboxWorker 가 폴링하여 그룹웨어 API 호출 (멱등 키, 지수 백오프, DLQ)
```

### 5.2 연말 배치 (배당금 지급)

```
[스케줄러: 12/31 23:59]
  ├─ 1단계: REGULAR 미사용 연차 → 내년 경매 매물 생성 (FR-1.1)
  ├─ 2단계: 기여자 지분(Stake) 계산 및 저장
  ├─ 3단계: 에스크로 총액 = Σ(낙찰 콘) 검증 (currency별 — DB-RULE-4)
  ├─ 4단계: Stake 비율에 따라 배당금 산정
  ├─ 5단계: PayoutChannel.payout(...) → Outbox → HR /welfare
  └─ 6단계: AUCTION/EVENT 이전 연도 Soft Delete
```

### 5.3 관리자 콘 적립 (FR-5.1 — 신규)

```
  CreditWalletUseCase  (RBAC: ADMIN만)
    └─ UnitOfWork.transaction:
         ├─ BiddingCurrency.credit(userId, amount, {actionType: CREDIT_ADMIN, reason})
         ├─ LedgerRepository.insert(CREDIT_ADMIN)   ← reason 필수
         └─ COMMIT
    └─ EventBus.publish(WalletCreditedEvent)
```

→ 관리자 적립은 에스크로와 무관. `escrow_audit_view`에서 `CREDIT_ADMIN`은 집계 제외.

## 6. 횡단 관심사 (Cross-cutting Concerns)

### 6.1 보안

- **인증**: SSO (사내 IdP) → JWT
- **권한 (RBAC)**: `EMPLOYEE` / `ADMIN` 분리. 관리자 API는 별도 라우터 격리. 관리자 적립은 `reason` 필수 감사.
- **통신 암호화**: 전구간 TLS 1.2+
- **감사 로그**: `LEDGER_ENTRY` Insert-Only로 불변 보관

### 6.2 관측성 (Observability)

- **메트릭**: Prometheus + Grafana (에스크로 잔고 실시간 대시보드)
- **로그**: 구조화 로깅(JSON) → ELK or Loki
- **트레이싱**: OpenTelemetry (경매 낙찰 흐름 추적)
- **알림**: Slack Webhook — Critical 트랜잭션 실패 즉시 통지 (FR-2.2). Domain Event 핸들러로 구현 (ADR-013).

### 6.3 동시성 (Concurrency)

- SQLite write 락: `lockAuction()`이 no-op `UPDATE auction SET id=id`로 트랜잭션 write 락 선점 — 같은 경매 입찰 직렬화, 커밋/롤백 시 자동 해제
- SQLite는 쓰기를 DB 전역 직렬화하며 행 락/`SELECT … FOR UPDATE`는 없음. 별도 인프라 없음
- 자세한 근거: [scope-cuts.md CUT-1](../06_tech/scope-cuts.md) (ADR-006 Superseded)

### 6.4 장애 대응

- DB 트랜잭션 실패 → 즉시 롤백 + Slack Critical 알림. 낙찰 정산은 단일 트랜잭션이라 부분 실패 없음.
- 배당 출금(HR `/welfare`) 5xx/Timeout → Outbox 재시도 + 지수 백오프 → DLQ + Slack Critical
- **✅ 해결됨**: HR 호출 시점 — [ADR-005](../04_decisions/ADR-005-hr-api-timing.md) Accepted. 휴가 부여는 `InternalLeaveAdapter`로 내부화([ADR-016](../04_decisions/ADR-016-internal-leave-system.md))되어 분산 트랜잭션 문제 회피. Outbox는 배당 출금 및 미래 그룹웨어 연동용으로 존재.

### 6.5 이벤트 흐름 (ADR-013)

- **EventBus** (NestJS EventEmitter): 프로세스 *내부* fan-out. WebSocket·메트릭·감사 등 부수효과.
- **Outbox**: 프로세스 *경계 이상*의 신뢰성 발행. HR API 호출 트리거 전용.
- 두 메커니즘의 역할은 엄격히 분리 — 외부 시스템 호출은 절대 EventBus로 트리거하지 않음.

## 7. 확장성 고려

- **수평 확장**: AuctionService는 stateless → Pod 증설로 입찰 TPS 확장
- **병목 지점**: 인기 경매 1건의 write 락 경합 — 락 보유 구간(트랜잭션)을 짧게 유지
- **DB 파티셔닝**: `LEAVE_BALANCE.year` 기준 파티셔닝 ([ADR-004](../04_decisions/ADR-004-year-partitioning.md))
- **MSA 분리 경로**: Hexagonal 경계가 자연 분리선 — `wallet`/`escrow`/`stake` 공유 데이터를 Bounded Context로 떼어낼 때 도메인 코어는 무수정

---

## 8. Bounded Context 경계 (ADR-017)

논리적 컨텍스트 5개 (현재는 단일 배포 단위, Hexagonal 경계가 미래 분리선):

| Context | 책임 | 마스터 데이터 | 다른 컨텍스트와의 관계 |
|---|---|---|---|
| **Auction** | 입찰·낙찰·정산·실시간 알림 | `auctions` | LeavePool로부터 매물 수신, `AuctionWonEvent` 발행 |
| **Wallet** | 콘 잔액 ([ADR-011](../04_decisions/ADR-011-welfare-point-ownership.md)) | `wallet`, `ledger_entry` | `BiddingCurrency`·`PayoutChannel` 포트 노출 |
| **Leave** | 휴가 잔액·부여·차감 우선순위 ([ADR-016](../04_decisions/ADR-016-internal-leave-system.md)) | `leave_balance` | `LeaveGrantPort` 포트 노출 |
| **LeavePool** | 연말 풀 수집·경매 인벤토리 생성·Stake 기록 ([ADR-017](../04_decisions/ADR-017-leave-pool-context.md)) | `stake` | Leave 조회 → Auction 매물 생성 (다리 역할) |
| **Dividend** | 지분 기반 연말 배당 | — (Stake·Escrow 조회) | LeavePool의 Stake, Wallet의 Escrow 소비 |

## TODO

- [ ] 실제 배포 옵션 확정 (A vs B)
- [ ] AuctionService 인스턴스 수 산정 (예상 동시 접속 수 기반)
- [ ] DR(재해복구) 전략 — 에스크로 DB 이중화
- [ ] 보안 점검 체크리스트 별도 문서화
- [ ] 패자 환불 플로우·Stake 산정식·배당 나머지 처리 등 도메인 계산식 명세
