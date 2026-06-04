# ADR-012: Hexagonal Architecture (Ports & Adapters) 채택

- **상태**: ✅ Accepted
- **결정일**: 2026-05-14
- **결정자**: 타임소프트콘

## 컨텍스트

본 시스템은 다수의 외부 시스템·인프라와 결합된다:

- **외부 시스템**: HR API (`/leave`, `/welfare`), SSO IdP
- **인프라**: SQLite, Redis, Outbox/MQ, WebSocket, Slack
- **변화 축**: 화폐 종류 ([[ADR-010]]), HR 클라이언트(Mock vs Real), 락 구현, 알림 채널

이들이 코어 도메인(`Auction`, `Bid`, `Escrow`, `Stake`, `Wallet`)에 *직접 침투*하면:

- 단위 테스트 시 모든 외부 의존을 모킹해야 함
- 인프라 교체 시 도메인 코드 수정 필요 (OCP 위반)
- 도메인 모델이 ORM·HTTP DTO·Redis 키 스킴 등에 *오염*

→ Alistair Cockburn의 **Ports & Adapters (Hexagonal)** 패턴을 채택하여 *도메인을 중심에 격리*한다.

## 초기 아이디어 (Rejected)

### 옵션 X — 전통적 N-Tier (Controller → Service → Repository → DB)
- NestJS 기본 구조
- **거절 이유**: Service가 인프라(Redis, HR Client)와 직접 결합. 도메인 로직과 인프라 호출이 한 클래스에 섞임. Mock 분리·교체 어려움.

### 옵션 Y — Clean Architecture (Robert Martin)
- 4겹 동심원 (Entities / Use Cases / Adapters / Frameworks)
- **부분 채택**: Hexagonal과 본질적으로 동일. 본 ADR의 *용어*는 Hexagonal 사용 (Port·Adapter가 더 직관적).

## 회피한 리스크

💣 **인프라 침투 (Infrastructure Leakage)**
- 도메인 객체가 `@Entity` 데코레이터, `Redis` 키 포맷, HR JSON DTO를 알게 됨
- 결과: 인프라 교체 시 도메인까지 수정

💣 **테스트 불가능한 코어**
- 도메인 로직의 단위 테스트가 항상 DB·Redis 모킹을 요구
- 결과: 빠른 피드백 루프 상실

💣 **MSA 분리 시 비용 폭발**
- 미래에 AuctionService를 독립 마이크로서비스로 분리할 때 도메인 코어가 인프라와 얽혀 있으면 분리 불가

## 결정

**6각형 (Hexagonal) 구조 — 도메인 코어를 중앙에, 외부 의존은 모두 어댑터로**

```
       ┌─────────────────  Inbound Adapters (Driving) ──────────────────┐
       │                                                                 │
       │   REST Controller · WebSocket Gateway · Admin CLI · Cron Job   │
       │                                                                 │
       └──────────────────────────┬─────────────────────────────────────┘
                                  │ calls
                                  ▼
                  ┌──────────  Inbound Ports  ──────────┐
                  │  PlaceBidUseCase                    │
                  │  SettleAuctionUseCase               │
                  │  DistributeDividendUseCase          │
                  │  CreditWalletUseCase                │
                  └──────────────┬──────────────────────┘
                                 │ implemented by
                                 ▼
                      ┌────────────────────┐
                      │   Domain Core      │  ← 외부 라이브러리 0 의존
                      │                    │
                      │  Auction · Bid     │
                      │  Escrow · Stake    │
                      │  Wallet · Ledger   │
                      │  Policies          │
                      │  Domain Events     │
                      └─────────┬──────────┘
                                │ depends on
                                ▼
                  ┌──────────  Outbound Ports  ─────────┐
                  │  WalletRepository                   │
                  │  AuctionRepository                  │
                  │  LedgerRepository                   │
                  │  BiddingCurrency / PayoutChannel    │
                  │  HrClient · NotificationChannel     │
                  │  EventBus                           │
                  └──────────────┬──────────────────────┘
                                 │ implemented by
                                 ▼
       ┌─────────────────  Outbound Adapters (Driven) ──────────────────┐
       │                                                                 │
       │   SQLite · Redis · WireMock HR · Slack · NestEventEmitter  │
       │                                                                 │
       └─────────────────────────────────────────────────────────────────┘
```

### 디렉토리 구조 (NestJS 기준)

```
src/
├── domain/                    ← 도메인 코어 (외부 라이브러리 의존 0)
│   ├── auction/
│   │   ├── auction.ts         ← Entity (행위 포함, Anemic 금지)
│   │   ├── bid.ts
│   │   ├── auction-state.ts   ← State 패턴 ([[ADR-014]])
│   │   └── events.ts          ← Domain Events ([[ADR-013]])
│   ├── wallet/
│   ├── escrow/
│   └── shared/
│       └── value-objects.ts   ← [[ADR-015]]
│
├── application/               ← Use Cases (Inbound Ports)
│   ├── place-bid.usecase.ts
│   ├── settle-auction.usecase.ts
│   ├── distribute-dividend.usecase.ts
│   └── credit-wallet.usecase.ts
│
├── ports/                     ← Outbound Ports (인터페이스만)
│   ├── wallet.repository.ts
│   ├── auction.repository.ts
│   ├── bidding-currency.ts
│   ├── payout-channel.ts
│   ├── hr-client.ts
│   └── event-bus.ts
│
├── adapters/                  ← Outbound Adapters (구현체)
│   ├── persistence/           ← TypeORM/Prisma
│   ├── hr/                    ← Real/Mock HR
│   ├── notification/          ← Slack/WebSocket
│   └── event-emitter/         ← Domain Event Bus
│
└── interfaces/                ← Inbound Adapters
    ├── http/                  ← REST Controllers
    ├── websocket/             ← Realtime Gateway
    └── cli/                   ← Admin commands
```

### 의존성 규칙 (불변)

```
interfaces  → application → domain    ✅
adapters    → ports       → domain    ✅
domain      → 그 무엇도 의존 안 함     ✅ (외부 라이브러리 포함)
domain      → application             ❌ 금지
domain      → adapters                ❌ 금지
domain      → interfaces              ❌ 금지
```

이 규칙은 ESLint 규칙(`eslint-plugin-boundaries` 또는 `dependency-cruiser`)으로 *컴파일 타임에 강제*한다.

## 결과 및 트레이드오프

### ✅ 긍정적 결과

- **도메인 단위 테스트 가속** — Mock·DB 없이 도메인 객체만으로 테스트 가능
- **인프라 교체 비용 0** — Redis → ZooKeeper, REST → gRPC 등 어댑터만 교체
- **MSA 분리 용이** — 도메인 경계가 명확해서 미래 마이크로서비스 분리 시 자연 매핑
- **포트폴리오 가치 크기** — 학부 산출물 중 Hexagonal 적용은 흔치 않은 어필 콘
- **[[ADR-010]]·[[ADR-013]]과 자연 정합** — Currency Provider·Event Bus가 모두 outbound port

### ⚠️ 트레이드오프

- **단기 보일러플레이트 증가** — 인터페이스·구현체 분리, DI 설정, 디렉토리 깊이 ↑
- **러닝 커브** — 팀원이 Ports/Adapters 개념 숙지 필요
- **NestJS 기본 가이드와 약간의 충돌** — NestJS 공식 예제는 Service-centric. 본 ADR은 Service를 *Use Case*로 명명하고 도메인을 분리

### 🛡️ 제약

- 도메인 코어에 **NestJS 데코레이터(`@Injectable` 등) 사용 금지** — 순수 TypeScript 클래스만
- 도메인 코어에 **ORM 데코레이터(`@Entity` 등) 사용 금지** — 영속성 매핑은 어댑터 계층에서
- **의존성 방향 위반 시 빌드 실패**로 강제 (린트 규칙)
- DTO ↔ 도메인 변환은 Use Case 또는 Adapter에서 수행 (Anti-Corruption Layer)

## 관련 문서

- [[ADR-010]] 통화 추상화 — outbound port의 대표 예시
- [[ADR-013]] Domain Event — 도메인 코어 내부 이벤트 발행, 어댑터가 구독
- [[ADR-014]] Auction State 패턴 — 도메인 코어 안의 State 객체
- [[ADR-015]] Value Object 정책 — 도메인 코어의 원시 타입 wrap 규칙
- [[architecture]] — 본 ADR 채택 후 컴포넌트 다이어그램 개정
