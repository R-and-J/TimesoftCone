# ADR-005: HR API 호출 시점 (Outbox vs Saga)

- **상태**: ✅ Accepted
- **결정일**: 2026-05-14
- **결정자**: 타임소프트콘
- **관련**: [[ADR-016]] (자체 휴가 관리 시스템 보유) — 본 ADR의 분산 트랜잭션 문제를 *내부화*로 해소

## 컨텍스트

UML 순차 다이어그램(UML.md)에 따르면 낙찰 처리 흐름은:

```
1. Redis LOCK
2. 포인트 차감 (DB)
3. 에스크로 적립 (DB)
4. POST /api/hr/leave  ← ⚠️ HR API 호출
5. COMMIT
6. Redis UNLOCK
```

**문제**: HR API 호출이 **DB COMMIT 전**에 있다. 외부 시스템은 DB처럼 자동 롤백되지 않는다.

### 치명적 시나리오

```
[시점 t]   HR API가 200 OK로 연차 +1 처리 (HR 시스템에 영구 반영)
[시점 t+10ms]  네트워크 단절 또는 DB 디스크 full
[시점 t+20ms]  COMMIT 실패 → 애플리케이션은 롤백 시도
[결과]
  ✅ HR 시스템: 직원 연차 +1 (AUCTION)
  ❌ 본 시스템 DB: 포인트 차감 취소됨, 로그 없음
  → 직원은 포인트 안 내고 연차 획득
  → 에스크로 정합성 붕괴: Σ(log) ≠ 실제 HR 부여
```

반대 방향:

```
[시점 t]   HR API 호출, 타임아웃 → 응답 없음
[시점 t+?]  실제로는 HR이 정상 처리했음 (그런데 우린 실패로 인식)
[시점 t+10ms]  롤백
[결과]
  ✅ HR 시스템: 직원 연차 +1
  ❌ 본 시스템: 포인트 차감 롤백
  → 동일 문제
```

이는 **분산 트랜잭션의 본질적 문제 (Two Generals Problem)**이며, DB 단일 트랜잭션으로는 해결 불가능.

## 초기 아이디어 (Rejected)

> **옵션 0**: "단일 DB 트랜잭션 안에 HR API를 호출하면 된다"

→ **작동하지 않음**. 외부 HTTP 호출은 DB 트랜잭션 롤백 시 자동 되돌려지지 않는다. 위 시나리오 참조.

## 후보 옵션

### 옵션 A — **Outbox Pattern (권장)**

**흐름**:
```
1. Redis LOCK
2. BEGIN TRANSACTION
3. 포인트 차감, 에스크로 적립, 로그 INSERT
4. outbox 테이블에 HR API 발행 요청 INSERT (같은 트랜잭션!)
5. COMMIT  ← 여기까지 원자적
6. Redis UNLOCK
---
(비동기 Worker)
7. outbox 폴링 → HR API 호출 → 성공 시 outbox 레코드 "sent" 마킹
8. 실패 시 지수 백오프 재시도 (최대 N회)
9. 최종 실패 시 DLQ + 관리자 알림
```

**장점**:
- DB 트랜잭션의 원자성 유지
- HR API 실패해도 DB 정합성 깨지지 않음
- Idempotency Key로 중복 호출 방지 (`auction-{id}-winner-{userId}`)

**단점**:
- Worker 컴포넌트 추가 필요 (별도 프로세스 또는 Scheduled Job)
- 낙찰 확정 ↔ HR 연차 부여 사이 **최대 N초 지연** (실시간성 손상)
- UI에서 "낙찰 완료" 알림 시 "연차 반영은 곧 처리됩니다" 문구 필요

### 옵션 B — **Saga Pattern with Compensation**

**흐름**:
```
1. BEGIN TRANSACTION
2. 포인트 차감, 에스크로 적립, 로그 INSERT
3. COMMIT
4. HR API POST /api/hr/leave (with idempotency key)
5a. 성공 → 완료
5b. 실패 → 보상 트랜잭션:
    - BEGIN TRANSACTION
    - 포인트 환불 INSERT (REFUND 로그)
    - 에스크로 차감 INSERT
    - COMMIT
    - HR API POST /api/hr/leave/revoke (혹시 모르는 부분 정리)
```

**장점**:
- 실시간성 유지 (낙찰 즉시 HR 반영)
- 명시적 보상 로직

**단점**:
- **HR API에 revoke(취소) 엔드포인트 필요** — HR팀과 추가 협의
- 보상 실패 시 더 복잡한 수동 복구 절차 필요
- 중간 상태 노출: 사용자가 "포인트 차감됨 + 연차 미반영" 순간을 볼 수 있음

### 옵션 C — **2-Phase Commit (XA)**

HR 시스템이 XA 트랜잭션을 지원해야 함 → **일반적으로 REST API 기반 사내 시스템에서는 불가**. 논의 제외.

## 비교표

| 기준 | 옵션 A (Outbox) | 옵션 B (Saga) |
|---|---|---|
| 구현 난이도 | 중 | 중~상 |
| HR팀 협업 요구 | Idempotency Key 합의만 | **Revoke API 신규 요구** |
| 실시간성 | 지연 있음 (초 단위) | 즉시 |
| 정합성 보장 | ✅ 강함 | ✅ 강함 (보상 전제) |
| 중간 상태 사용자 노출 | 없음 ("곧 반영" 메시지만) | 있음 (초 단위) |
| 운영 부담 | Worker 모니터링 | 보상 실패 대응 |
| 학교 프로젝트 적합성 | **높음** (HR 측 의존 최소) | 중간 |

## 권장 결정

**옵션 A (Outbox Pattern)** 채택 권장.

이유:
1. **HR팀 의존 최소화** — 학교 프로젝트 맥락에서 외부 API 스펙 추가 요구는 비현실적
2. **정합성 안전** — DB 트랜잭션이 원자적이므로 에스크로가 절대 깨지지 않음
3. **구현 표준화** — Outbox는 많은 프레임워크(Debezium/Kafka Connect)가 지원
4. **테스트 용이** — Worker가 별도 프로세스이므로 격리 테스트 가능

## 결정

**옵션 A (Outbox Pattern)을 *구조적 답*으로 채택. 단, 현재 구현은 휴가 부여를 *내부화*하여 분산 트랜잭션 문제 자체를 회피한다.**

### 채택한 옵션

**Outbox Pattern + Internal Adapter 우선 전략**

핵심 통찰: 본 ADR의 난제(Two Generals Problem)는 "HR이 *외부* 시스템"이라는 전제에서 비롯된다. 그런데 [[ADR-011]](wallet 자체 보유)과 동일한 논리로, **휴가 부여도 본 시스템이 내부 모듈로 소유**하면([[ADR-016]]) — 휴가 부여는 외부 HTTP 호출이 아니라 *같은 DB 트랜잭션 안의 INSERT*가 된다. 분산 트랜잭션 문제가 증발한다.

```
[현재 — InternalLeaveAdapter]
  SettleAuctionUseCase
    └─ UnitOfWork.transaction:
         ├─ wallet 차감
         ├─ escrow 적립
         ├─ ledger_entry INSERT (WIN)
         ├─ leave_balance INSERT (AUCTION +1)  ← 내부 INSERT, 같은 트랜잭션!
         └─ COMMIT                              ← 전부 원자적, Outbox 불필요

[미래 — GroupwareLeaveAdapter (실 그룹웨어 연동 시)]
  SettleAuctionUseCase
    └─ UnitOfWork.transaction:
         ├─ wallet 차감 / escrow 적립 / ledger_entry INSERT
         ├─ outbox INSERT (leave_grant payload)  ← 외부 호출은 Outbox 경유
         └─ COMMIT
  (비동기 Worker가 outbox 폴링 → GroupwareLeaveAdapter → 실 그룹웨어 API)
```

### 채택 이유

1. **분산 트랜잭션 회피** — 내부 어댑터에선 휴가 부여가 로컬 INSERT. Two Generals Problem 미발생
2. **구조는 미래 대비** — Outbox 테이블·Worker는 설계에 *그대로 존재*. 실 그룹웨어 어댑터를 붙이는 순간 활성화
3. **[[ADR-012]] Hexagonal과 정합** — `LeaveGrantPort` 인터페이스 뒤에서 어댑터만 교체 (OCP)
4. **학교 프로젝트 적합** — 외부 의존 0으로 시연·테스트 가능. 실 연동은 추후 별도 작업

### 구현 계획

- `LeaveGrantPort` (outbound port) — `grant(empId, leaveType, year)` 시그니처
- `InternalLeaveAdapter` (기본 구현체) — `leave_balance` 테이블에 직접 INSERT/UPSERT. UnitOfWork 트랜잭션에 참여
- `GroupwareLeaveAdapter` (미래 구현체) — `outbox` INSERT만 수행. 실제 호출은 Worker가 담당
- `OutboxWorker` — 폴링 + 지수 백오프 + DLQ. **`GroupwareLeaveAdapter` 도입 전까지는 dormant** (배당 payout 경로에서 먼저 사용될 수 있음 — [[ADR-010]] `PayoutChannel`)

### Idempotency 전략

- 멱등 키: `auction-{auctionId}-winner-{userId}` (기존안 유지)
- `InternalLeaveAdapter`: `leave_balance`의 `(user_id, year, leave_type)` UNIQUE 제약으로 중복 부여 차단 + `outbox.idempotency_key` UNIQUE
- `GroupwareLeaveAdapter`: 멱등 키를 HTTP 헤더로 전달, 외부 시스템이 중복 무시

### 장애 시나리오별 대응

| 시나리오 | InternalLeaveAdapter | GroupwareLeaveAdapter (미래) |
|---|---|---|
| 휴가 부여 중 실패 | DB 트랜잭션 롤백 — 전체 원자적 무효화 | COMMIT은 성공(outbox까지), Worker가 재시도 |
| 부분 커밋 | 불가능 (단일 트랜잭션) | Worker 지수 백오프 → 최대 N회 → DLQ + Slack |
| 중복 호출 | UNIQUE 제약으로 차단 | 멱등 키로 외부 시스템이 무시 |

## 결과 및 트레이드오프

### ✅ 긍정적 결과

- **분산 트랜잭션 난제 해소** — 본 ADR의 원래 위험 시나리오가 내부 어댑터에선 발생 불가
- **단계적 전환 가능** — 학교 프로젝트(내부) → 실 그룹웨어(Outbox)로 *코어 무수정* 전환
- **테스트 단순화** — 낙찰 정산이 단일 트랜잭션이라 통합 테스트가 명확

### ⚠️ 트레이드오프

- **휴가 관리 스코프 증가** — 본 시스템이 `leave_balance`를 직접 소유·운영해야 함 ([[ADR-016]]에서 상세)
- **Outbox 코드가 당분간 dormant** — 만들어두지만 즉시 안 쓰는 코드 (단, 배당 `PayoutChannel`에서 먼저 활용 가능)
- **실 그룹웨어 전환 시 재검증 필요** — `GroupwareLeaveAdapter` 도입 시점에 본 ADR의 원래 시나리오(Two Generals)가 *부활* → Outbox 경로 통합 테스트 필수

### 🛡️ 제약

- `InternalLeaveAdapter`는 **반드시 호출 측 UnitOfWork 트랜잭션에 참여** — 별도 트랜잭션 생성 금지
- `LeaveGrantPort` 인터페이스는 두 어댑터 모두 만족하는 *최소 공약수* 유지 — 내부 전용 메서드 노출 금지
- 실 그룹웨어 연동은 **별도 마일스톤** — 학교 프로젝트 범위는 `InternalLeaveAdapter`까지

## 관련 문서
- [SRS FR-2.3](../02_requirements/SRS.md#32-기능적-요구사항-명세표)
- [UML 순차 다이어그램](../03_design/UML.md#-순차-다이어그램-sequence-diagram)
- [API 명세서 7.1](../03_design/api-spec.md#71-연차-권한-부여)
- [[ADR-016]] 자체 휴가 관리 시스템 보유 — 본 ADR의 내부화 결정의 상세
- [[ADR-011]] wallet 자체 보유 — 동일 패턴 (포인트 버전)
- [[ADR-012]] Hexagonal Architecture — `LeaveGrantPort` 어댑터 교체
- [[ADR-010]] 통화 추상화 — `PayoutChannel`이 Outbox를 먼저 활용
