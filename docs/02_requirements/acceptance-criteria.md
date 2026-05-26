# FR별 인수 조건 (Acceptance Criteria)

**상태**: ✅ v1 — FR-1.1 ~ FR-5.2 정식화 (2026-05-14)
**관련 문서**: [SRS](SRS.md) FR/NFR · [business-rules.md](business-rules.md) · [edge-cases.md](edge-cases.md) · [permission-matrix.md](permission-matrix.md) · [api-spec.md](../03_design/api-spec.md)

> 본 문서는 각 FR이 *무엇을 충족해야 done인지*를 테스트 가능한 형태로 정의한다. 개발자는 본 문서를 그대로 통합 테스트 시나리오로 변환할 수 있어야 한다.

### 표기 규약 (Given / When / Then)

- **Given** — 사전 조건 / 시스템 상태
- **When** — 트리거되는 행위
- **Then** — 기대되는 결과 (단언 가능한 형태)
- **AC-N.x** — 인수 조건 번호 (Acceptance Criterion). 테스트 케이스 ID로 그대로 사용

---

## FR-1.1 · 연말 정산 및 공용 풀 생성

**목적**: 매년 12월 31일 23:59 스케줄러가 직원의 `REGULAR` 미사용 연차를 취합하여 익년도 경매 매물(연차 1일권)과 기여자 지분(Stake)을 생성. ([SRS](SRS.md) §3.2, [ADR-017](../04_decisions/ADR-017-leave-pool-context.md))

### 정상 시나리오

| ID | Given | When | Then |
|---|---|---|---|
| AC-1.1.1 | 직원 A가 2026년 말 시점 `REGULAR` 미사용 5일 보유 | 12/31 23:59 풀 수집 배치 실행 | 2027년 경매 매물 5개 생성 (A 기여) · `stake.contributed_days = 5` · `stake.stake_ratio = 5/Σ` |
| AC-1.1.2 | 전사 미사용 합계 100일, A=5일/B=15일/C=80일 | 배치 실행 | 매물 100개 생성 · A.stake_ratio≈0.05 / B≈0.15 / C≈0.80 (NUMERIC(10,8)) |
| AC-1.1.3 | 직원 D가 `REGULAR` 미사용 0일 | 배치 실행 | D에 대한 `stake` row 미생성 — 0 기여자는 스킵 |
| AC-1.1.4 | 동일 연도(2026)에 배치 1회 이미 실행 후 재실행 | 배치 재실행 | 매물·Stake 중복 생성 없음 — 재진입 가능(idempotent), [edge-cases](edge-cases.md) EC-10 |

### 검증 포인트

- `Σ contributed_days = Σ REGULAR 미사용 일수` (정합성)
- `Σ stake_ratio ≈ 1.0` (오차는 정밀도 한계 내, NUMERIC(10,8))
- 매물의 `year` 컬럼은 *익년도*
- 매물 초기 상태 `CREATED` (오픈은 분산 오픈 배치가 별도로 처리)

### 예외 시나리오

- `AUCTION`·`EVENT` 잔액은 **풀 수집 대상 아님** ([ADR-002](../04_decisions/ADR-002-leave-type-flag.md))
- 배치 중단 시 `batch_run` 상태 보존, 중단 지점부터 재개 ([ADR-017](../04_decisions/ADR-017-leave-pool-context.md))

---

## FR-2.1 · 실시간 입찰 진행

**목적**: 직원이 활성 경매에 입찰. 상위 입찰 시 직전 최고가 입찰자에게 *즉시 환불* + WebSocket 브로드캐스트. ([SRS](SRS.md) §3.2, [ADR-018](../04_decisions/ADR-018-auction-settlement-rules.md))

### 정상 시나리오

| ID | Given | When | Then |
|---|---|---|---|
| AC-2.1.1 | 경매 X `OPEN`, 현재 최고가 0, 직원 A wallet 10000P | A가 5000P 입찰 (최소 증분 + 시작가 만족) | wallet 5000P 차감 · `auctions.highest_bid=5000` · `winner_id=A.id` · `LEDGER_ENTRY(BID,-5000,A)` INSERT · WebSocket `BID_UPDATED` 발행 |
| AC-2.1.2 | AC-2.1.1 직후 + 직원 B wallet 10000P | B가 6000P 입찰 | B wallet 6000P 차감 + A wallet 5000P **즉시 환불** · `auctions.highest_bid=6000` · `winner_id=B.id` · `LEDGER_ENTRY(BID,-6000,B)` + `LEDGER_ENTRY(REFUND,+5000,A)` · WebSocket 양쪽 알림 |
| AC-2.1.3 | 경매 X 마감 시각 1초 전 | A가 입찰 | 정상 수락 (마감 시각 이전이므로) |

### 검증 포인트

- 입찰 트랜잭션은 **단일 DB 트랜잭션** ([ADR-005](../04_decisions/ADR-005-hr-api-timing.md))
- 에스크로 등식: `Σ(BID + WIN) − Σ(REFUND + DIVIDEND) = ESCROW.balance` 진행 중에도 일관 ([DB-RULE-4](SRS.md#342-데이터-무결성-제약조건))
- 행 락(`SELECT … FOR UPDATE`) — 트랜잭션 수명 동안 보유 (CUT-1, [ADR-006](../04_decisions/ADR-006-redis-lock.md)은 Superseded)
- 동시 입찰 시 락으로 직렬화 — 둘 다 성공하는 일 없음

### 예외 시나리오

| ID | Given | When | Then |
|---|---|---|---|
| AC-2.1.E1 | wallet 잔액 부족 (`balance < amount`) | 입찰 시도 | `400 POINT_INSUFFICIENT` · 차감 없음 ([edge-cases](edge-cases.md) EC-9) |
| AC-2.1.E2 | 현재가 5000, 최소 증분 100 | 5050P 입찰 | `400 BID_TOO_LOW` (5000+100=5100 미만) ([edge-cases](edge-cases.md) EC-6) |
| AC-2.1.E3 | 경매 마감 시각 경과 | 입찰 시도 | `409 AUCTION_CLOSED` |
| AC-2.1.E4 | 동시 입찰(같은 경매) | 두 입찰 동시 도착 | 행 락으로 직렬화 — 뒤 입찰은 앞 입찰 커밋 후 갱신된 현재가로 재검증(`BID_TOO_LOW` 가능) |
| AC-2.1.E5 | 입찰자 = 현재 최고가 입찰자 (자기 자신에 재입찰) | 더 높은 가격 재입찰 | 정상 수락, 단 자기에게 환불-자기 차감 — ledger에 REFUND+BID 동시 |

---

## FR-2.2 · 낙찰 및 에스크로 적립

**목적**: 경매 마감 시 최종 낙찰자 확정, 차감분이 에스크로로 귀속. ([SRS](SRS.md) §3.2)

### 정상 시나리오

| ID | Given | When | Then |
|---|---|---|---|
| AC-2.2.1 | 경매 X 마감 시각 도달, 최고가 6000P (B 낙찰) | 마감 스케줄러 실행 | `auctions.status='CLOSED'` → 즉시 `AWARDED` 전이 · `LEDGER_ENTRY(WIN, 0, B, escrow_snapshot)` 기록 · `ESCROW.balance += 6000` · B에게 `AUCTION` 휴가 +1 ([FR-2.3](#fr-23--휴가-권한-부여)) · WebSocket `AWARDED` 발행 |
| AC-2.2.2 | 경매 X 마감, 입찰자 없음 (highest_bid=0, winner_id=null) | 마감 스케줄러 실행 | `auctions.status='CLOSED'` → `UNSOLD` 전이 · 에스크로 변동 없음 · WebSocket `UNSOLD` 발행 |

### 검증 포인트

- 차감·적립·휴가 부여가 **단일 트랜잭션** ([ADR-005](../04_decisions/ADR-005-hr-api-timing.md) 내부화 — Outbox 불요)
- 트랜잭션 실패 시 *전체 롤백* + Slack Critical 알림

### 예외 시나리오

- AC-2.2.E1: 낙찰자가 마감 직전 퇴사 → `AUCTION` 휴가 부여 불가 → **유찰(UNSOLD) 처리** ([edge-cases](edge-cases.md) EC-1)
- AC-2.2.E2: DB 트랜잭션 실패 → 롤백 + 관리자 Slack 알림 + 수동 감사 대기

---

## FR-2.3 · 휴가 권한 부여

**목적**: 낙찰 확정 시 낙찰자에게 `AUCTION` 속성 연차 +1. 현재 `InternalLeaveAdapter`로 내부 INSERT. ([SRS](SRS.md) FR-2.3, [ADR-016](../04_decisions/ADR-016-internal-leave-system.md))

### 정상 시나리오

| ID | Given | When | Then |
|---|---|---|---|
| AC-2.3.1 | B가 경매 X 낙찰 (2027년 매물) | FR-2.2 트랜잭션 내 휴가 부여 | `leave_balance(B, 2027, AUCTION).allocated_days += 1` · 같은 트랜잭션 |
| AC-2.3.2 | B가 이미 2027년 `AUCTION` 휴가 2일 보유, 추가 낙찰 | 휴가 부여 | `allocated_days: 2 → 3` (UPSERT) |

### 검증 포인트

- FR-2.2와 **반드시 동일 트랜잭션** — 부분 커밋 시 정합성 붕괴
- 멱등 키 `auction-{auctionId}-winner-{userId}` — 중복 호출 시 무효
- 미래 `GroupwareLeaveAdapter` 전환 시 Outbox 경유로 자동 전환 ([ADR-005](../04_decisions/ADR-005-hr-api-timing.md))

---

## FR-3.1 · 휴가 차감 우선순위

**목적**: 휴가 사용 승인 시 `AUCTION → EVENT → REGULAR` 순으로 강제 차감. ([SRS](SRS.md) FR-3.1, [ADR-003](../04_decisions/ADR-003-forced-priority.md))

### 정상 시나리오

| ID | Given (잔액: AUCTION/EVENT/REGULAR) | When | Then |
|---|---|---|---|
| AC-3.1.1 | 2/1/15 (총 18일) | 1일 차감 | AUCTION 2→1, 나머지 그대로 |
| AC-3.1.2 | 0/1/15 | 1일 차감 | EVENT 1→0 (AUCTION 0이므로 폴백) |
| AC-3.1.3 | 0/0/15 | 1일 차감 | REGULAR 15→14 |
| AC-3.1.4 | 1/2/15 | 4일 차감 | AUCTION 1→0, EVENT 2→0, REGULAR 15→14 (순차 소진) |

### 검증 포인트

- 사용자는 *순서를 선택할 수 없음* — API에 type 인자 받지 않음
- 트랜잭션 단위로 처리 — 부분 차감 후 실패 시 전체 롤백

### 예외 시나리오

- AC-3.1.E1: 총 잔액 < 요청 일수 → `400 INSUFFICIENT_LEAVE` · 차감 없음
- AC-3.1.E2: 요청 일수 ≤ 0 → `400 INVALID_AMOUNT`

---

## FR-4.1 · 연말 배당금 정산

**목적**: 12/31 에스크로 총수익을 Stake 비율로 분배, 복지카드 한도 증액 API 호출. ([SRS](SRS.md) FR-4.1, [ADR-008](../04_decisions/ADR-008-year-end-dividend.md), [business-rules](business-rules.md) §2.2)

### 정상 시나리오

| ID | Given | When | Then |
|---|---|---|---|
| AC-4.1.1 | escrow=1000P, A.stake=0.3 / B.stake=0.7 | 배당 배치 실행 | A 배당 300P / B 배당 700P · `LEDGER_ENTRY(DIVIDEND,...)` 각각 INSERT · `PayoutChannel.payout()` Outbox 발행 |
| AC-4.1.2 | escrow=1000P, A=0.333 / B=0.333 / C=0.334 (합1.0, 동률 1위) | 배당 배치 | floor: A 333 / B 333 / C 334 → 합 1000 (잔여 0) — *완전 분배* |
| AC-4.1.3 | escrow=1001P, A=0.5 / B=0.5 (Stake 1위 동률) | 배당 배치 | floor: A 500 / B 500 (합 1000), 잔여 1P → user_id 오름차순 → A에게 +1 · 최종 A 501 / B 500 ([edge-cases](edge-cases.md) EC-7) |
| AC-4.1.4 | escrow=1000P, A=1.0 (혼자) | 배당 배치 | A 배당 1000P |

### 검증 포인트

- **불변식**: `Σ 최종배당 = ESCROW.balance` (currency별)
- 에스크로 잔액을 *1포인트도 초과하지 않음*
- 산정액 불일치 시 *배치 중단 + 수동 감사 대기*
- `CREDIT_ADMIN` 항목은 집계에서 제외

### 예외 시나리오

- AC-4.1.E1: 퇴사자 Stake 보유 → 배당 산정 *포함* (Stake 유지 정책), 실제 payout은 wallet 소멸 후라 회사 환수 처리 ([edge-cases](edge-cases.md) EC-1)
- AC-4.1.E2: 배치 중간 실패 → `batch_run` 상태 보존, 멱등 키로 중복 INSERT 방지

---

## FR-4.2 · 잔여 재고 활용 및 청산

**목적**: 유찰 매물을 관리자가 EVENT로 수동 지급, 연말에 남은 재고는 영구 삭제. ([SRS](SRS.md) FR-4.2)

### 정상 시나리오

| ID | Given | When | Then |
|---|---|---|---|
| AC-4.2.1 | 경매 X `UNSOLD` 상태, 직원 D 존재 | ADMIN이 `POST /admin/auctions/{X}/event-grant {empId: D, reason: '...'}` | `leave_balance(D, year, EVENT).allocated_days += 1` · `auctions.status='AWARDED'` · 에스크로 변동 없음 |
| AC-4.2.2 | 경매 X `UNSOLD` 상태, 연말 도래 | 12/31 청산 배치 | `auctions.status='EXPIRED'` · 매물 영구 삭제 (Soft Delete) · 익년 이월 0 |

### 검증 포인트

- 수동 지급 시 에스크로 *변동 없음* (구매자 없음)
- `reason` 필수 (감사)
- 익년 이월 금지

### 예외 시나리오

- AC-4.2.E1: 비-관리자가 호출 → `403 FORBIDDEN`
- AC-4.2.E2: 이미 `AWARDED`된 경매에 EVENT 지급 시도 → `409 INVALID_STATE_TRANSITION`

---

## FR-5.1 · 관리자 포인트 적립

**목적**: 관리자가 직원 wallet에 분기·이벤트 포인트 적립. `LEDGER_ENTRY` `CREDIT_ADMIN` 기록. ([SRS](SRS.md) FR-5.1, [ADR-011](../04_decisions/ADR-011-welfare-point-ownership.md))

### 정상 시나리오

| ID | Given | When | Then |
|---|---|---|---|
| AC-5.1.1 | ADMIN K, 직원 D wallet 50000P | K가 `POST /admin/wallet/credit {userId: D, amount: 30000, reason: 'Q2 분기 지급'}` | D wallet 80000P · `LEDGER_ENTRY(CREDIT_ADMIN, +30000, D, reason='Q2...')` INSERT · `WalletCreditedEvent` 발행 |
| AC-5.1.2 | ADMIN K, 직원 D 신규 (wallet row 없음) | 적립 호출 | wallet row UPSERT (balance=amount) · LEDGER_ENTRY 동일 |

### 검증 포인트

- `CREDIT_ADMIN` 항목은 **에스크로 등식과 무관** — 감사 뷰에서 분리 집계
- `reason` 필드 NOT NULL, 빈 문자열도 거부 (DB CHECK 제약)
- 권한: ADMIN만 ([permission-matrix](permission-matrix.md) WA-5)

### 예외 시나리오

| ID | Given | When | Then |
|---|---|---|---|
| AC-5.1.E1 | EMPLOYEE가 호출 | API 호출 | `403 FORBIDDEN` |
| AC-5.1.E2 | reason 누락/공백 | API 호출 | `400 REASON_REQUIRED` |
| AC-5.1.E3 | amount ≤ 0 | API 호출 | `400 INVALID_AMOUNT` |
| AC-5.1.E4 | 존재하지 않는 userId | API 호출 | `404 USER_NOT_FOUND` |

---

## FR-5.2 · 잔액 조회

**목적**: 직원이 본인 wallet/거래내역/휴가/배당/Stake 조회. 관리자는 타인도 조회 가능. ([SRS](SRS.md) FR-5.2)

### 정상 시나리오

| ID | Given | When | Then |
|---|---|---|---|
| AC-5.2.1 | 직원 D, wallet 80000P | D가 `GET /users/me/wallet?currency=WELFARE_POINT` | `200 OK { balance: 80000, currency: 'WELFARE_POINT' }` |
| AC-5.2.2 | 직원 D, 거래 50건 | D가 `GET /users/me/ledger?page=1&size=20` | `200 OK { items: [...20], total: 50, page: 1 }` |
| AC-5.2.3 | ADMIN K가 직원 D 조회 | `GET /admin/wallet?userId=D&currency=WELFARE_POINT` | `200 OK` 정상 응답 |

### 검증 포인트

- **ABAC (소유자 검사)**: `/users/me/*`는 토큰 user_id와 일치 검증, 불일치 시 403 ([permission-matrix](permission-matrix.md) §4.2)
- 거래 내역 페이지네이션: 기본 20건, 최대 100건
- 최신순 정렬 기본

### 예외 시나리오

- AC-5.2.E1: EMPLOYEE가 `/admin/*` 호출 → `403 FORBIDDEN`
- AC-5.2.E2: 토큰의 user_id ≠ path의 `/users/{id}` → `403 FORBIDDEN`
- AC-5.2.E3: 토큰 만료 → `401 UNAUTHORIZED`

---

## 횡단 인수 조건 (NFR · 보안)

### NFR-1 동시성 (MySQL 행 락)

| ID | Given | When | Then |
|---|---|---|---|
| AC-N1.1 | 경매 X에 1000명이 동시 입찰 시도 | 동시 입찰 | 한 번에 1명만 통과 (행 락 직렬화) · 나머지는 락 해제 후 순차 진입하여 갱신된 현재가로 재검증 · 입찰가 꼬임 0건 |

### NFR-2 재무 정합성

| ID | Given | When | Then |
|---|---|---|---|
| AC-N2.1 | 어떤 시점에서든 | `escrow_audit_view.computed_balance` vs `escrow.balance` 비교 | **일치** (currency별). 불일치 시 Critical 알림 |

### 보안 / 감사

| ID | Given | When | Then |
|---|---|---|---|
| AC-S.1 | ADMIN이 입찰 (AC-3) | 입찰 트랜잭션 | `LEDGER_ENTRY.actor_role = 'ADMIN'` 플래그 기록 ([wbs](../07_plan/wbs.md) BR-1 완화) |
| AC-S.2 | LEDGER_ENTRY에 UPDATE/DELETE 시도 | SQL 실행 | DB 트리거가 예외 발생 ([DB-RULE-1](SRS.md#342-데이터-무결성-제약조건)) |

---

## 미결 / 추가 검토

- [ ] FR-1.1 분산 오픈 — 풀 수집 후 `CREATED` → `OPEN`은 별도 주차별 배치 (FR-1.x로 신규 추가 여부 검토)
- [ ] Stake 1위 동률 시 `user_id` 오름차순 외 다른 규칙(가입일자, 알파벳) 검토
- [ ] AC-2.1.E5 자기 자신 재입찰의 회계 처리 명시 (LEDGER 정합성 검증 필요)
- [ ] 인증·SSO 흐름의 인수 조건은 별도 절로 분리 (현재 본 문서엔 미포함)

## 관련 문서

- [SRS](SRS.md) — FR/NFR 원본
- [business-rules.md](business-rules.md) — 운영 파라미터·계산식
- [edge-cases.md](edge-cases.md) — 경계 상황
- [permission-matrix.md](permission-matrix.md) — 권한 검증
- [api-spec.md](../03_design/api-spec.md) · [openapi.yaml](../03_design/openapi.yaml) — API 스펙
- 핵심 ADR: [005](../04_decisions/ADR-005-hr-api-timing.md) · [008](../04_decisions/ADR-008-year-end-dividend.md) · [016](../04_decisions/ADR-016-internal-leave-system.md) · [017](../04_decisions/ADR-017-leave-pool-context.md) · [018](../04_decisions/ADR-018-auction-settlement-rules.md)
