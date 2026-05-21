# ② 클래스 다이어그램 (Class Diagram)

**대상 시스템**: 연차 경매 시스템
**팀**: 타임소프트콘 (김기철, 오지석)
**렌더링**: https://mermaid.live (하단 코드 블록 복사 → 붙여넣기 → PNG 다운로드)

> **시스템 정적 구조** — 13 클래스 · 4 열거형 · 정식 UML classDiagram 문법 · 모든 관계 유형 포함

---

## 🎯 설계 요소 커버리지

- ✅ **가시성** (`+` public, `-` private, `#` protected)
- ✅ **다중도** (`1`, `N`, `0..1`)
- ✅ **일반화** (Generalization, `<|--`): AbstractUser → Employee/Admin, LeaveBalance → 3종(Regular/Auction/Event)
- ✅ **실체화** (Realization, `<|..`): HRApiClient → HRApiClientImpl
- ✅ **컴포지션** (Composition, `*--`): Employee ◆— LeaveBalance
- ✅ **집합** (Aggregation, `o--`): Employee ◇— LedgerEntry
- ✅ **연관** (Association, `-->`): Auction → Winner
- ✅ **의존** (Dependency, `..>`): Auction ⤏ Escrow, HRApiClient
- ✅ **스테레오타입**: `<<abstract>>`, `<<interface>>`, `<<enumeration>>`, `<<service>>`, `<<Insert-Only>>`

---

## 📋 클래스 한영 대조표

클래스 식별자(영문)는 코드·DB 스키마와 1:1 매핑되며, 한글 도메인명은 이해 보조용입니다.

| 식별자 | 한글 도메인명 | 유형 |
|---|---|---|
| `AbstractUser` | 사용자(추상) | abstract class |
| `Employee` | 직원 | class |
| `Admin` | 관리자 | class |
| `LeaveBalance` | 연차 잔액(추상) | abstract class |
| `RegularLeave` | 법정 연차 | class |
| `AuctionLeave` | 경매 연차 | class |
| `EventLeave` | 이벤트 연차 | class |
| `Auction` | 경매 | class |
| `LedgerEntry` | 포인트 거래 대장 | class (Insert-Only) |
| `Stake` | 지분 | class |
| `Escrow` | 에스크로 (중앙 수익금 대장) | service |
| `HRApiClient` | HR 연동 인터페이스 | interface |
| `HRApiClientImpl` | HR 연동 구현체 | class |
| `LeaveType` | 연차 타입 | enumeration |
| `AuctionStatus` | 경매 상태 | enumeration |
| `ActionType` | 거래 타입 | enumeration |
| `UserRole` | 사용자 역할 | enumeration |

---

## 📊 다이어그램

```mermaid
classDiagram
    direction TB

    %% ============================================================
    %% ② Class Diagram — 연차 경매 시스템
    %% ※ 클래스 라벨: "식별자 · 한글도메인명"  (식별자는 코드와 1:1 매핑)
    %% ============================================================

    %% ---------- Abstract Base Classes ----------
    class AbstractUser["AbstractUser · 사용자(추상)"] {
        <<abstract>>
        #id: bigint
        #emp_id: String
        #name: String
        #role: UserRole
        +login() JwtToken
        +logout() void
    }

    class Employee["Employee · 직원"] {
        +getWallet(currency: Currency) Wallet
        +getBidableBalance(currency: Currency) Point
    }

    class Wallet["Wallet · 지갑(잔액 마스터)"] {
        -user_id: bigint
        -currency: Currency
        -balance: bigint
        +debit(amt: Point) void
        +credit(amt: Point) void
        +getBalance() Point
    }

    class Admin["Admin · 관리자"] {
        -permissionLevel: int
        +grantEventLeave(empId: String) void
        +viewAuditLog(filter: LogFilter) List~LedgerEntry~
        +triggerManualBatch() void
    }

    AbstractUser <|-- Employee
    AbstractUser <|-- Admin

    %% ---------- Leave Balance Hierarchy ----------
    class LeaveBalance["LeaveBalance · 연차 잔액(추상)"] {
        <<abstract>>
        #id: bigint
        #user_id: bigint
        #year: int
        #allocated_days: int
        #used_days: int
        #deleted_at: datetime
        +getRemaining() int
        +deduct(days: int) void
        +expireAtYearEnd()* void
    }

    class RegularLeave["RegularLeave · 법정 연차"] {
        +canEntitleToCashPayment() bool
        +convertToAuctionPool() int
        +expireAtYearEnd() void
    }

    class AuctionLeave["AuctionLeave · 경매 연차"] {
        -source_auction_id: bigint
        +expireAtYearEnd() void
    }

    class EventLeave["EventLeave · 이벤트 연차"] {
        -granted_by_admin_id: bigint
        -reason: String
        +expireAtYearEnd() void
    }

    LeaveBalance <|-- RegularLeave
    LeaveBalance <|-- AuctionLeave
    LeaveBalance <|-- EventLeave

    %% ---------- Core Entities ----------
    class Auction["Auction · 경매"] {
        -id: bigint
        -status: AuctionStatus
        -year: int
        -start_time: datetime
        -end_time: datetime
        -highest_bid: int
        -winner_id: bigint
        +placeBid(user: Employee, amt: int) BidResult
        +close() void
        +isExpired() bool
        +isAwarded() bool
    }

    class LedgerEntry["LedgerEntry · 통합 거래 원장"] {
        <<Insert-Only>>
        -id: bigint
        -user_id: bigint
        -auction_id: bigint
        -currency: Currency
        -action_type: ActionType
        -amount: bigint
        -escrow_balance_snapshot: bigint
        -reason: String
        -created_at: datetime
        +record()$ void
    }

    class Stake["Stake · 지분"] {
        -id: bigint
        -user_id: bigint
        -year: int
        -contributed_days: int
        -stake_ratio: decimal
        +calculateDividend(total: int) int
    }

    %% ---------- Service ----------
    class Escrow["Escrow · 에스크로(중앙 수익금 대장)"] {
        <<service>>
        -year: int
        -currency: Currency
        -balance: bigint
        +accumulate(amt: Point) void
        +distribute(stakes: List~Stake~) Map
        +getBalance() Point
        +verifyIntegrity() bool
    }

    %% ---------- Interface & Realization ----------
    class HRApiClient["HRApiClient · HR 연동 인터페이스"] {
        <<interface>>
        +grantLeave(empId: String, type: LeaveType) void
        +addWelfareLimit(empId: String, amt: int) void
    }

    class HRApiClientImpl["HRApiClientImpl · HR 연동 구현체"] {
        -baseUrl: String
        -apiToken: String
        -httpClient: HttpClient
        +grantLeave(empId: String, type: LeaveType) void
        +addWelfareLimit(empId: String, amt: int) void
        -retryWithBackoff(req: HttpRequest) HttpResponse
    }

    HRApiClient <|.. HRApiClientImpl

    %% ---------- Enumerations ----------
    class LeaveType["LeaveType · 연차 타입"] {
        <<enumeration>>
        REGULAR
        AUCTION
        EVENT
    }

    class AuctionStatus["AuctionStatus · 경매 상태"] {
        <<enumeration>>
        CREATED
        OPEN
        CLOSED
        AWARDED
        UNSOLD
        EXPIRED
    }

    class ActionType["ActionType · 거래 타입"] {
        <<enumeration>>
        BID
        REFUND
        WIN
        DIVIDEND
        CREDIT_ADMIN
        EXPIRE
    }

    class UserRole["UserRole · 사용자 역할"] {
        <<enumeration>>
        EMPLOYEE
        ADMIN
    }

    class Currency["Currency · 화폐 코드"] {
        <<enumeration>>
        WELFARE_POINT
    }

    %% ---------- Relationships ----------
    Employee "1" *-- "N" Wallet : owns ◆
    Employee "1" *-- "N" LeaveBalance : owns ◆
    Employee "1" o-- "N" LedgerEntry : records ◇
    Employee "1" o-- "N" Stake : contributes ◇
    Employee "0..1" <-- "N" Auction : winner

    Auction "1" -- "N" LedgerEntry : logs
    Auction "N" ..> "1" Escrow : accumulates
    Auction "N" ..> "1" HRApiClient : uses

    LeaveBalance ..> LeaveType : uses
    Auction ..> AuctionStatus : uses
    LedgerEntry ..> ActionType : uses
    LedgerEntry ..> Currency : uses
    Wallet ..> Currency : uses
    Escrow ..> Currency : uses
    AbstractUser ..> UserRole : uses

    Stake ..> Escrow : calculates share of
```

### 🖼️ 렌더링 결과

![Class Diagram](class.png)

> 📸 mermaid.live에서 렌더링한 이미지. 소스 변경 시 재렌더링하여 `class.png`로 덮어쓰기.
> ⚠️ **재렌더링 필요** (2026-05-14): `current_point` → `Wallet` 분리, `PointTransactionLog` → `LedgerEntry`, `AuctionStatus` 6상태, `Currency` enum 추가 반영됨. PNG는 아직 구버전.

---

## 📝 관계 유형별 카운트

| 관계 유형 | 기호 | 건수 | 예시 |
|---|---|---|---|
| 일반화 (Generalization) | `<\|--` ▷ | **5** | AbstractUser ← Employee/Admin, LeaveBalance ← 3종 |
| 실체화 (Realization) | `<\|..` ▷(점선) | **1** | HRApiClient ← HRApiClientImpl |
| 컴포지션 (Composition) | `*--` ◆ | **2** | Employee ◆— Wallet, Employee ◆— LeaveBalance (생명주기 종속) |
| 집합 (Aggregation) | `o--` ◇ | **2** | Employee ◇— LedgerEntry, Stake |
| 연관 (Association) | `--` 또는 `-->` | **2** | Auction → Winner, Auction — Log |
| 의존 (Dependency) | `..>` | **10** | Auction→Escrow, Auction→HRApiClient, Stake→Escrow, LeaveBalance→LeaveType, Auction→AuctionStatus, LedgerEntry→ActionType/Currency, Wallet→Currency, Escrow→Currency, AbstractUser→UserRole |

## 🏷️ 스테레오타입 사용

| 스테레오타입 | 적용 클래스 | 의미 |
|---|---|---|
| `<<abstract>>` | AbstractUser, LeaveBalance | 인스턴스화 불가, 하위 클래스 강제 |
| `<<interface>>` | HRApiClient | 구현체 교체 가능 (Mock/실제) |
| `<<service>>` | Escrow | 도메인 서비스 (상태는 집계만) |
| `<<enumeration>>` | LeaveType, AuctionStatus, ActionType, UserRole, Currency | 열거형 |
| `<<Insert-Only>>` | LedgerEntry | UPDATE/DELETE 금지 (DB-RULE-1) |

## 🔑 주요 설계 근거

- **AbstractUser 일반화** → [ADR-002](../../04_decisions/ADR-002-leave-type-flag.md) 역할 분리, Admin 권한 격리
- **LeaveBalance 3종 일반화** → [ADR-002](../../04_decisions/ADR-002-leave-type-flag.md) 이중 보상 방지, 각 서브타입의 `expireAtYearEnd()` 다형성
- **HRApiClient 인터페이스** → [ADR-005](../../04_decisions/ADR-005-hr-api-timing.md) 구현체 교체 가능 (테스트용 Mock / Outbox Worker)
- **Escrow `<<service>>`** → [ADR-001](../../04_decisions/ADR-001-escrow-model.md) 상태 없는 도메인 서비스
- **Wallet 분리 + Currency enum** → [ADR-010](../../04_decisions/ADR-010-currency-abstraction.md) 통화 추상화, [ADR-011](../../04_decisions/ADR-011-welfare-point-ownership.md) 잔액 마스터 본 시스템 보유
- **LedgerEntry 통합 원장** → [ADR-010](../../04_decisions/ADR-010-currency-abstraction.md)·[ADR-011](../../04_decisions/ADR-011-welfare-point-ownership.md) `currency`/`reason` 컬럼 추가, `CREDIT_ADMIN` 액션
- **AuctionStatus 6상태** → [ADR-014](../../04_decisions/ADR-014-auction-state-pattern.md) State 패턴

---

## 🧭 내비게이션

| | 문서 |
|---|---|
| ⬅️ 이전 | [① 유스케이스 다이어그램](01-use-case.md) |
| ↩️ 인덱스 | [UML 인덱스](../UML.md) |
| ➡️ 다음 | [③ 순차 다이어그램](03-sequence.md) |
| 📚 관련 | [ERD](../erd.md) · [db-schema.sql](../../06_tech/db-schema.sql) |
