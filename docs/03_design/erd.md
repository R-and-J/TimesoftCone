# ERD — 엔티티 관계도

**상태**: 🟡 v2 — wallet 분리 · LEDGER_ENTRY 개명 반영 (2026-05-14)
**관련 문서**: [SRS 3.4](../02_requirements/SRS.md#34-논리적-데이터베이스-요구사항) / [UML 클래스](UML.md) / [db-schema.sql](../06_tech/db-schema.sql) / [ADR-010](../04_decisions/ADR-010-currency-abstraction.md) / [ADR-011](../04_decisions/ADR-011-welfare-point-ownership.md)

---

## 1. 핵심 엔티티 관계도

```mermaid
erDiagram
    USER ||--o{ WALLET : "holds 1:N (currency별)"
    USER ||--o{ LEAVE_BALANCE : "owns 1:N"
    USER ||--o{ LEDGER_ENTRY : "records 1:N"
    USER ||--o{ AUCTION : "wins 1:N (optional)"
    USER ||--o{ STAKE : "contributes 1:N"
    AUCTION ||--o{ LEDGER_ENTRY : "logs 1:N"
    AUCTION_BATCH ||--o{ AUCTION : "generates 1:N"
    ESCROW ||--o{ LEDGER_ENTRY : "aggregates"

    USER {
        bigint id PK
        string emp_id UK "사번 (HR 연동 키)"
        string name
        enum role "EMPLOYEE, ADMIN"
        datetime created_at
    }

    WALLET {
        bigint user_id PK_FK "USER.id"
        string currency PK "WELFARE_POINT (ADR-009)"
        bigint balance "잔액 마스터 (ADR-011)"
        datetime updated_at
    }

    LEAVE_BALANCE {
        bigint id PK
        bigint user_id FK
        int year "귀속 연도"
        enum leave_type "REGULAR, AUCTION, EVENT"
        int allocated_days
        int used_days
        datetime deleted_at "Soft Delete (DB-RULE-2)"
    }

    AUCTION {
        bigint id PK
        enum status "CREATED, OPEN, CLOSED, AWARDED, UNSOLD, EXPIRED"
        datetime start_time
        datetime end_time
        bigint highest_bid
        bigint winner_id FK "nullable, USER.id"
        int year "귀속 연도"
    }

    LEDGER_ENTRY {
        bigint id PK
        bigint user_id FK
        bigint auction_id FK "nullable"
        string currency "WELFARE_POINT"
        enum action_type "BID, REFUND, WIN, DIVIDEND, CREDIT_ADMIN, EXPIRE"
        bigint amount "부호 포함"
        bigint escrow_balance_snapshot "기록 시점 에스크로 잔액"
        string reason "CREDIT_ADMIN 시 필수"
        datetime created_at
    }

    STAKE {
        bigint id PK
        bigint user_id FK
        int year
        int contributed_days "반납한 REGULAR 연차 수"
        decimal stake_ratio "해당 연도 내 지분 비율"
    }

    ESCROW {
        int year PK
        string currency PK "WELFARE_POINT"
        bigint balance "에스크로 누적 잔액 (집계)"
        datetime updated_at
    }
```

> **v2 변경 요약**: `USER.current_point` 컬럼 → `WALLET` 엔티티로 분리. `POINT_TRANSACTION_LOG` → `LEDGER_ENTRY` 개명 + `currency`·`reason` 컬럼 추가. `ESCROW` PK를 `(year, currency)` 복합키로. `AUCTION.status` 6상태 확장. 근거: [ADR-010](../04_decisions/ADR-010-currency-abstraction.md) · [ADR-011](../04_decisions/ADR-011-welfare-point-ownership.md) · [ADR-014](../04_decisions/ADR-014-auction-state-pattern.md).

## 2. 엔티티 상세

### 2.1 USER
사내 직원 정보. HR 시스템의 사번(`emp_id`)을 외부 키로 보유. **잔액 컬럼은 보유하지 않음** — `WALLET`로 분리.

| 컬럼 | 타입 | 제약 | 설명 |
|---|---|---|---|
| `id` | bigint | PK | 내부 키 |
| `emp_id` | varchar(20) | UK, NOT NULL | 사번, HR API 호출 시 사용 |
| `name` | varchar(100) | NOT NULL | 직원 이름 |
| `role` | enum | NOT NULL DEFAULT EMPLOYEE | EMPLOYEE / ADMIN (RBAC) |
| `created_at` | timestamp | NOT NULL | |

### 2.2 WALLET ✨ 신규 (ADR-010 / ADR-011)
사용자의 화폐별 잔액 마스터. 본 시스템이 단일 진실 공급원(Single Source of Truth).

| 컬럼 | 타입 | 제약 | 설명 |
|---|---|---|---|
| `user_id` | bigint | PK, FK → USER | |
| `currency` | varchar(30) | PK | 화폐 코드. 현재 `WELFARE_POINT` 단일 ([ADR-009](../04_decisions/ADR-009-point-reuse.md)) |
| `balance` | bigint | CHECK `>= 0` | 잔액. 입찰 시 즉시 차감, 환불·관리자 적립 시 증가 |
| `updated_at` | timestamp | NOT NULL | |

**복합 PK**: `(user_id, currency)` — 다중 화폐 대비
**구현 노트**: [ADR-010](../04_decisions/ADR-010-currency-abstraction.md)의 `BiddingCurrency` 인터페이스 구현체 `WelfarePointProvider`만 이 테이블을 조작한다. 코어 도메인은 직접 접근 금지.

### 2.3 LEAVE_BALANCE
사용자의 연도별·속성별 연차 잔액.

| 컬럼 | 타입 | 제약 | 설명 |
|---|---|---|---|
| `id` | bigint | PK | |
| `user_id` | bigint | FK → USER | |
| `year` | int | NOT NULL | 귀속 연도 (파티셔닝 기준) |
| `leave_type` | enum | NOT NULL | REGULAR / AUCTION / EVENT |
| `allocated_days` | int | CHECK `>= 0` | 부여된 일수 |
| `used_days` | int | CHECK `>= 0`, `<= allocated_days` | 사용한 일수 |
| `deleted_at` | timestamp | nullable | Soft Delete (DB-RULE-2) |

**UNIQUE**: `(user_id, year, leave_type)`
**파티셔닝**: `year` 기준 RANGE 파티션 ([ADR-004](../04_decisions/ADR-004-year-partitioning.md))

### 2.4 AUCTION
경매 매물 (연차 1일권).

| 컬럼 | 타입 | 제약 | 설명 |
|---|---|---|---|
| `id` | bigint | PK | |
| `status` | enum | NOT NULL | CREATED / OPEN / CLOSED / AWARDED / UNSOLD / EXPIRED |
| `start_time` | timestamp | NOT NULL | 경매 오픈 시각 |
| `end_time` | timestamp | NOT NULL, `> start_time` | 경매 마감 시각 |
| `highest_bid` | bigint | CHECK `>= 0` | 현재 최고가 |
| `winner_id` | bigint | FK → USER, nullable | 낙찰자 (마감 후 확정) |
| `year` | int | NOT NULL | 귀속 연도 |

**인덱스**: `(status, end_time)` — 활성 경매 조회 최적화
**제약**: 낙찰 시 `WALLET(winner, WELFARE_POINT).balance >= highest_bid` (DB-RULE-3)
**상태 모델**: 6개 상태는 [ADR-014](../04_decisions/ADR-014-auction-state-pattern.md) State 패턴으로 코드화. 상태 머신 상세는 [UML 상태 다이어그램](uml/04-state.md).

### 2.5 LEDGER_ENTRY ⚠️ Insert-Only (구 POINT_TRANSACTION_LOG)
모든 콘 변동의 불변 감사 대장.

| 컬럼 | 타입 | 제약 | 설명 |
|---|---|---|---|
| `id` | bigint | PK | |
| `user_id` | bigint | FK → USER | |
| `auction_id` | bigint | FK → AUCTION, nullable | 배당·관리자 적립 시 NULL 가능 |
| `currency` | varchar(30) | NOT NULL | 화폐 코드 |
| `action_type` | enum | NOT NULL | BID / REFUND / WIN / DIVIDEND / CREDIT_ADMIN / EXPIRE |
| `amount` | bigint | NOT NULL | (+) 입금 / (-) 출금 |
| `escrow_balance_snapshot` | bigint | NOT NULL | 기록 시점 에스크로 총액 (Memento 패턴) |
| `reason` | text | `CREDIT_ADMIN`일 때 NOT NULL | 적립·환불 사유 |
| `created_at` | timestamp | NOT NULL DEFAULT now() | |

**트리거 제약** ([DB-RULE-1](../02_requirements/SRS.md#342-데이터-무결성-제약조건)):
- UPDATE 금지 / DELETE 금지 — DB 트리거로 강제
- 잔액 수정이 필요하면 `REFUND` 또는 `CREDIT_ADMIN` INSERT로 처리

**CHECK 제약**: `action_type = 'CREDIT_ADMIN'`이면 `reason` 필수 ([ADR-011](../04_decisions/ADR-011-welfare-point-ownership.md))

### 2.6 STAKE
연도별 기여자 지분율. 연말 배당 재원 분배 기준.

| 컬럼 | 타입 | 제약 | 설명 |
|---|---|---|---|
| `id` | bigint | PK | |
| `user_id` | bigint | FK → USER | |
| `year` | int | NOT NULL | |
| `contributed_days` | int | CHECK `> 0` | 반납한 `REGULAR` 연차 일수 |
| `stake_ratio` | decimal(10,8) | CHECK `>= 0 AND <= 1` | 해당 연도 내 지분 비율 |

**UNIQUE**: `(user_id, year)`

### 2.7 ESCROW
에스크로 잔액 집계 테이블. **연도·화폐별** 단일 행.

| 컬럼 | 타입 | 제약 | 설명 |
|---|---|---|---|
| `year` | int | PK | |
| `currency` | varchar(30) | PK | 화폐 코드 |
| `balance` | bigint | CHECK `>= 0` | 집계 잔액 |
| `updated_at` | timestamp | NOT NULL | |

> **구현 노트**: `ESCROW.balance`는 `LEDGER_ENTRY`의 합계로 재계산 가능한 **파생 값**. 성능을 위한 캐시 테이블로 운영하되, 배치에서 `escrow_audit_view`와 정합성 재검증 필수.

## 3. 관계 요약

| 관계 | 다중도 | 의미 |
|---|---|---|
| USER → WALLET | 1 : N | 한 직원은 화폐별 다수 지갑 보유 (현재는 1개) |
| USER → LEAVE_BALANCE | 1 : N | 한 직원은 연도/속성별 다수 잔액 보유 |
| USER → LEDGER_ENTRY | 1 : N | 콘 이력 |
| USER → AUCTION (winner) | 1 : N (opt) | 한 사람이 여러 경매 낙찰 가능 |
| USER → STAKE | 1 : N | 연도별 지분 |
| AUCTION → LEDGER_ENTRY | 1 : N | 한 경매당 다수의 입찰 로그 |

## 4. 주요 제약 요약

| ID | 제약 | 구현 위치 |
|---|---|---|
| DB-RULE-1 | LEDGER_ENTRY Insert-Only | 트리거 |
| DB-RULE-2 | year별 파티셔닝 + AUCTION/EVENT Soft Delete | 테이블 DDL + 배치 |
| DB-RULE-3 | 낙찰 시 `WALLET.balance >= highest_bid` | CHECK / 애플리케이션 트랜잭션 (`BiddingCurrency.debit()`) |
| DB-RULE-4 | 화폐 단위 분리 — 에스크로 등식은 currency별 검증 | `escrow_audit_view` GROUP BY currency |
| 콘 음수 금지 | `WALLET.balance >= 0` | CHECK |
| 에스크로 음수 금지 | `ESCROW.balance >= 0` | CHECK |
| 관리자 적립 사유 필수 | `CREDIT_ADMIN` → `reason NOT NULL` | CHECK |

---

## 관련 문서

- [UML 클래스 다이어그램](UML.md#-클래스-다이어그램-class-diagram)
- [UML 상태 다이어그램](uml/04-state.md) — AUCTION 6상태
- [db-schema.sql (DDL v2)](../06_tech/db-schema.sql)
- [ADR-001 Escrow 모델](../04_decisions/ADR-001-escrow-model.md)
- [ADR-002 휴가 속성 플래그](../04_decisions/ADR-002-leave-type-flag.md)
- [ADR-004 Year 파티셔닝](../04_decisions/ADR-004-year-partitioning.md)
- [ADR-010 통화 추상화](../04_decisions/ADR-010-currency-abstraction.md)
- [ADR-011 복지 콘 시스템 자체 보유](../04_decisions/ADR-011-welfare-point-ownership.md)
- [ADR-014 Auction State 패턴](../04_decisions/ADR-014-auction-state-pattern.md)
