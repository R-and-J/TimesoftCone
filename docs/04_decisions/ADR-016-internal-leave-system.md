# ADR-016: 자체 휴가 관리 시스템 보유 (Internal Leave Management)

- **상태**: ✅ Accepted
- **결정일**: 2026-05-14
- **결정자**: 타임소프트콘
- **관련**: [[ADR-011]]의 *휴가* 버전. [[ADR-005]]의 분산 트랜잭션 문제를 내부화로 해소.

## 컨텍스트

[[ADR-002]]·[[ADR-003]]·[[SRS]] FR-2.3/FR-3.1은 본 시스템이 휴가를 *부여*(`AUCTION`)하고 *차감 우선순위*(`AUCTION→EVENT→REGULAR`)를 제어한다고 명시한다. 그러나 초기 설계는 이 휴가 부여를 *외부 HR 그룹웨어 API* (`POST /api/hr/leave`)에 위임하는 구조였다.

[[ADR-011]]에서 복지 콘 시스템을 검토하며 발견한 것과 동일한 문제가 휴가에도 있다:

- **대상 사내 환경에 소프트웨어 형태의 휴가 관리 시스템이 없음** — HR에서 수기·그룹웨어 기안으로 관리
- 따라서 `POST /api/hr/leave` API가 *존재하지 않음* → 호출할 대상이 없음
- [[ADR-005]]의 "외부 시스템은 롤백 안 됨" 난제는 *외부 시스템이 있다는 전제*에서만 성립

→ [[ADR-011]]과 동일한 결론: **본 시스템이 휴가 잔액의 마스터를 직접 보유**하고, 외부 그룹웨어 연동은 *추후 어댑터 교체*로 처리한다.

## 초기 아이디어 (Rejected)

### 옵션 X — 외부 HR 그룹웨어 API에 휴가 부여 위임
- `POST /api/hr/leave` 호출로 그룹웨어가 휴가 +1
- **거절 이유**: 대상 API 부재. [[ADR-005]]의 분산 트랜잭션 난제. 학교 프로젝트에서 실 그룹웨어 접근 불가.

### 옵션 Y — Mock HR 서버만 두고 "실 시스템 존재" 가정
- WireMock으로 HR 흉내, 실 연동은 다른 사람 몫
- **부분 채택**: Mock은 *테스트*용으로 유효. 그러나 *무엇을 만들지*가 모호 → 본 결정으로 명확화: Mock이 아니라 *실제 동작하는 내부 모듈*을 만든다.

## 회피한 리스크

💣 **[[ADR-005]] 분산 트랜잭션 난제**
- 외부 휴가 부여 API가 있다는 전제 자체가 깨짐
- 휴가 부여를 내부 INSERT로 만들면 Two Generals Problem 미발생

💣 **스코프 공중 분해**
- "그룹웨어가 알아서 해줄 것"이라는 모호한 위임
- 휴가 잔액의 마스터가 어디인지 불분명

## 결정

**본 시스템이 휴가 잔액의 *마스터*를 보유하되, 스코프를 명시적으로 한정한다.**

### 책임 범위 (In Scope)

| 책임 | 구현 |
|---|---|
| **휴가 잔액 보유** | `leave_balance(user_id, year, leave_type, allocated_days, used_days)` 테이블이 마스터 |
| **휴가 부여** | `LeaveGrantPort.grant()` — 낙찰 시 `AUCTION` +1, 관리자 포상 시 `EVENT` +1 |
| **차감 우선순위 제어** | `AUCTION → EVENT → REGULAR` 강제 ([[ADR-003]]) — `LeaveDeductionService` |
| **연말 소멸** | 12/31 배치로 `AUCTION`·`EVENT` 이전 연도 Soft Delete ([[ADR-004]]) |
| **잔액 조회** | 직원 본인 / 관리자 조회 API |

### 비책임 범위 (Out of Scope)

| 항목 | 처리 |
|---|---|
| 휴가 *기안/승인* 워크플로 UI | 본 프로젝트 스코프 외. 실 그룹웨어 또는 thin stub. 본 시스템은 "차감 연산"을 *API로 노출*만 함 |
| 법정 연차(`REGULAR`) *최초 부여* | 운영 시 마이그레이션 도구로 HR 데이터 → `leave_balance` 일괄 INSERT (시드). 자동 발생 로직은 범위 외 |
| 휴가 사용 *실적의 그룹웨어 반영* | 실 그룹웨어 연동 시 `GroupwareLeaveAdapter`가 양방향 sync — 별도 마일스톤 |

### 이음새 — LeaveGrantPort (ADR-012 outbound port)

```typescript
// ports/leave-grant.port.ts
export interface LeaveGrantPort {
  // 낙찰·포상 시 휴가 부여
  grant(userId: UserId, leaveType: LeaveType, year: Year): Promise<void>;

  // 휴가 사용 승인 시 차감 (AUCTION → EVENT → REGULAR 우선순위)
  deduct(userId: UserId, days: LeaveDays, year: Year): Promise<DeductionResult>;

  // 잔액 조회
  getBalance(userId: UserId, year: Year): Promise<LeaveBalanceSnapshot>;
}
```

| 구현체 | 동작 | 사용 시점 |
|---|---|---|
| `InternalLeaveAdapter` (기본) | `leave_balance` 테이블 직접 조작. 호출 측 UnitOfWork 트랜잭션에 참여 | 학교 프로젝트 전 범위 |
| `GroupwareLeaveAdapter` (미래) | `outbox` INSERT → Worker가 실 그룹웨어 API 호출 ([[ADR-005]]) | 실 사내 도입 시 |

→ 화폐의 [[ADR-010]] `CurrencyProvider`와 *완전히 동일한 패턴*. 휴가 = 또 하나의 추상화된 외부 자원.

### [[ADR-005]]와의 관계

`InternalLeaveAdapter`는 휴가 부여를 *로컬 DB INSERT*로 처리하므로 낙찰 정산이 단일 트랜잭션으로 닫힌다. [[ADR-005]]의 Outbox는 `GroupwareLeaveAdapter` 도입 시점까지 dormant.

## 결과 및 트레이드오프

### ✅ 긍정적 결과

- **[[ADR-005]] 분산 트랜잭션 난제 해소** — 휴가 부여가 내부 INSERT
- **낙찰 정산이 단일 트랜잭션** — wallet 차감 + escrow 적립 + ledger + leave_balance 모두 원자적
- **외부 의존 0으로 시연 가능** — 학교 발표에 실 그룹웨어 불필요
- **단계적 전환** — `GroupwareLeaveAdapter` 추가만으로 실 연동, 코어 무수정 (OCP)
- **차감 우선순위를 본 시스템이 *진짜로* 강제** — 외부 위임 시 보장 불가했던 ADR-003이 확실히 성립

### ⚠️ 트레이드오프

- **스코프 증가** — 휴가 부여·차감·소멸·조회 로직을 본 프로젝트가 구현. WBS 갱신 필요
- **휴가 기안/승인과의 경계** — 실 운영 시 "차감은 우리, 기안은 그룹웨어"의 동기화 정책 필요 (현재는 스코프 외로 명시)
- **REGULAR 시드 의존** — 법정 연차 최초 부여는 마이그레이션/시드에 의존

### 🛡️ 제약

- `InternalLeaveAdapter`는 **반드시 호출 측 트랜잭션에 참여** — 별도 트랜잭션 금지 ([[ADR-005]] 제약과 동일)
- 휴가 차감 시 `used_days <= allocated_days` CHECK 제약 위반 불가
- `AUCTION`·`EVENT`는 연말 소멸 — 사용자 UI에 반드시 고지 ([[ADR-002]] 제약 계승)
- 휴가 *기안/승인* 워크플로를 본 시스템에 신설하지 않음 — 차감 연산 API만 노출

## 관련 문서

- [[ADR-002]] 휴가 속성 3-flag 분리 — 본 시스템이 소유하는 휴가의 속성 모델
- [[ADR-003]] 백엔드 강제 차감 우선순위 — 내부 소유로 *진짜* 강제 가능
- [[ADR-005]] HR API 호출 시점 — 본 ADR의 내부화로 분산 트랜잭션 회피
- [[ADR-011]] wallet 자체 보유 — 동일 패턴 (콘 버전)
- [[ADR-012]] Hexagonal Architecture — `LeaveGrantPort` 어댑터 교체
- [[ADR-017]] 휴가 풀/경매 인벤토리 분리 — 연말 풀 수집은 별도 컨텍스트
- [[SRS]] FR-2.3, FR-3.1 — 휴가 부여·차감 요구사항
