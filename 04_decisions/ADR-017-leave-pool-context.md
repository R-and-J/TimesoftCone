# ADR-017: 휴가 풀 / 경매 인벤토리를 별도 Bounded Context로 분리

- **상태**: ✅ Accepted
- **결정일**: 2026-05-14
- **결정자**: 타임소프트콘

## 컨텍스트

[[SRS]] FR-1.1은 "매년 12월 31일 23:59 스케줄러가 `REGULAR` 미사용 연차를 취합하여 익년도 경매 매물(연차 1일권)을 생성하고 기여자 지분(Stake)을 기록"한다고 정의한다.

이 "풀 수집" 로직을 어디에 둘 것인가:

- **일상 휴가 관리** ([[ADR-016]] `InternalLeaveAdapter`) 안에? — 연 1회 배치 로직이 일상 모듈을 오염
- **경매 모듈** 안에? — 경매는 *입찰·낙찰*이 본질. 인벤토리 *생성*은 다른 관심사
- **배당 모듈** 안에? — 배당은 *연말 정산*이 본질. 풀 생성은 *연초* 사건

→ 풀 수집은 **Leave 컨텍스트와 Auction 컨텍스트 사이의 *다리*** 역할을 하는 독립 관심사다. 별도 Bounded Context로 분리한다.

## 초기 아이디어 (Rejected)

### 옵션 X — `InternalLeaveAdapter`에 풀 수집 메서드 추가
- **거절 이유**: 일상 휴가 부여/차감(트랜잭션성, 실시간)과 연말 배치(대량, 1회성)는 라이프사이클·성능 특성·실패 대응이 완전히 다름. SRP 위반.

### 옵션 Y — 경매 모듈에 흡수
- **거절 이유**: 경매 모듈은 `Auction`/`Bid` 도메인이 본질. 인벤토리 *생성*은 입력이지 책임이 아님. "어디서 매물이 오는가"를 경매가 알 필요 없음.

## 회피한 리스크

💣 **God Module — 일상 로직과 배치 로직의 혼재**
- 연말 배치 버그가 일상 휴가 차감을 마비시킬 위험
- 테스트·배포 단위가 불필요하게 결합

💣 **컨텍스트 경계 모호**
- "REGULAR 잔액을 읽어 경매 매물로 바꾸는" 변환 책임의 주인이 불분명

## 결정

**`LeavePool` (휴가 풀 / 경매 인벤토리)을 독립 Bounded Context로 분리한다.**

### 컨텍스트 책임

| 책임 | 설명 |
|---|---|
| **풀 수집** (12/31 배치) | Leave 컨텍스트에서 `REGULAR` 미사용 잔액을 읽어 취합 |
| **경매 인벤토리 생성** | 취합한 일수만큼 익년도 `Auction` 매물(1일권) 생성 → Auction 컨텍스트로 전달 |
| **Stake 기록** | 기여자별 `contributed_days` → `stake_ratio` 산정 → `stake` 테이블 INSERT |
| **재고 청산** | 유찰분의 연말 영구 삭제 ([[SRS]] FR-4.2) |

### 컨텍스트 관계 (Context Map)

```
┌──────────────┐   REGULAR 미사용 잔액 조회    ┌──────────────────┐
│   Leave      │ ◄──────────────────────────  │   LeavePool      │
│  Context     │                              │   Context        │
│ (ADR-016)    │                              │  (본 ADR)         │
└──────────────┘                              └────────┬─────────┘
                                                        │ 매물·Stake 생성
                                          ┌─────────────┴──────────────┐
                                          ▼                            ▼
                                  ┌──────────────┐            ┌──────────────┐
                                  │   Auction    │            │   Dividend   │
                                  │   Context    │            │   Context    │
                                  │  (입찰·낙찰)  │            │  (Stake 기반  │
                                  │              │            │   연말 배당)  │
                                  └──────────────┘            └──────────────┘
```

- **Leave → LeavePool**: `LeavePool`이 Leave 컨텍스트의 조회 포트(`LeaveBalanceQueryPort`)를 *소비*. Leave는 LeavePool을 모름 (단방향)
- **LeavePool → Auction**: `Auction` 매물 생성. 도메인 이벤트 `AuctionInventoryCreatedEvent` 발행 ([[ADR-013]])
- **LeavePool → Dividend**: `stake` 테이블 기록 → Dividend가 연말에 조회

### 배치 재진입성 (Idempotency)

연말 배치는 **재실행 가능(idempotent)** 해야 한다 ([[handover]] Action Item):

- 동일 `year`에 대한 중복 실행 시 매물·Stake 중복 생성 금지
- `auctions` 생성 시 `(year, source_user_id, sequence)` 기준 UNIQUE, `stake`는 `(user_id, year)` UNIQUE로 차단
- 배치 진행 상태를 `batch_run` 테이블에 기록 (PENDING/DONE/FAILED) — 중단 지점부터 재개

## 결과 및 트레이드오프

### ✅ 긍정적 결과

- **SRP 회복** — 일상 휴가 관리와 연말 배치가 분리. 배치 버그가 일상 기능에 영향 없음
- **컨텍스트 경계 명확** — "REGULAR → 경매 매물" 변환 책임의 주인이 명확
- **독립 테스트·배포** — 연말 배치를 별도로 시뮬레이션·검증 가능
- **[[ADR-012]] Hexagonal과 정합** — `LeavePool`도 자체 도메인 코어 + 포트 보유

### ⚠️ 트레이드오프

- **컨텍스트 수 증가** — Auction / Wallet / Leave / LeavePool / Dividend 5개로 늘어남
- **컨텍스트 간 조회 포트 추가** — `LeaveBalanceQueryPort` 등 인터페이스 보일러플레이트
- **물리적 배포는 여전히 단일** — 학교 프로젝트 범위에선 모놀리스. 컨텍스트는 *논리* 경계

### 🛡️ 제약

- `LeavePool`은 Leave 컨텍스트의 데이터를 **조회만** — 직접 수정 금지 (Leave가 마스터)
- 연말 배치는 **반드시 재진입 가능** — 중복 실행이 매물·Stake를 중복 생성하면 안 됨
- 매물 생성과 Stake 기록은 **단일 트랜잭션** — 둘 중 하나만 성공하는 상태 금지
- 풀 수집 대상은 `REGULAR`만 — `AUCTION`·`EVENT`는 절대 풀에 재투입 금지 ([[ADR-002]] 무한 순환 방지)

## 관련 문서

- [[ADR-002]] 휴가 속성 3-flag 분리 — `REGULAR`만 풀 전환 대상
- [[ADR-004]] Year 파티셔닝 — 연말 배치의 데이터 경계
- [[ADR-008]] 연말 일괄 배당 — Dividend 컨텍스트가 본 컨텍스트의 Stake를 소비
- [[ADR-013]] Domain Event — `AuctionInventoryCreatedEvent`
- [[ADR-016]] 자체 휴가 관리 시스템 — Leave 컨텍스트 (본 컨텍스트의 데이터 소스)
- [[SRS]] FR-1.1, FR-4.2 — 풀 생성·재고 청산 요구사항
