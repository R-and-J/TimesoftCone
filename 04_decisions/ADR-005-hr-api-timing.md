# ADR-005: HR API 호출 시점 🔴 (Outbox vs Saga)

- **상태**: 🔴 **Proposed — 시작 전 반드시 결정**
- **결정일**: _미결_
- **결정자**: _대기 중_
- **선결 필요**: 이 ADR이 확정되어야 AuctionService 구현 착수 가능

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

## 결정 (팀 확정 후 작성)

> _**TODO**: 김기철/오지석 논의 후 확정. 확정 시 상태를 Accepted로 변경하고 아래 섹션 채우기._

### 채택한 옵션
### 채택 이유
### 구현 계획
### Idempotency 전략
### 장애 시나리오별 대응

## 결과 및 트레이드오프 (확정 후)

_TODO_

## 관련 문서
- [SRS FR-2.3](../02_requirements/SRS.md#32-기능적-요구사항-명세표)
- [UML 순차 다이어그램](../03_design/UML.md#-순차-다이어그램-sequence-diagram)
- [API 명세서 7.1](../03_design/api-spec.md#71-연차-권한-부여)
