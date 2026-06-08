# ⑦ 객체 다이어그램 (Object Diagram) — 수익적립금 정합성 스냅샷

**대상**: 특정 시점(연말 배당 직전/직후)의 인스턴스 스냅샷
**팀**: 타임소프트콘 (김기철, 오지석)
**렌더링**: https://mermaid.live (→ `object-integrity.png`)

> NFR-2 등식 `Σ(BID+WIN) − Σ(REFUND+DIVIDEND) = 수익적립금 잔액`을 **실제 숫자가 박힌 인스턴스**로 증명한다. 클래스 다이어그램이 *타입*이라면, 이 다이어그램은 *값*이다.

---

## 🎯 시나리오 (구체 수치)

- 경매 A 낙찰 → 수익적립금 +6000 / 경매 B 낙찰 → +4000 ⇒ **수익적립금 잔액 = 10000**
- 기여자 지분: 박 2일(2/3 ≈ 0.6667), 최 1일(1/3 ≈ 0.3333)
- 배당 산정: 박 raw 6666.67 → floor 6666, 최 raw 3333.33 → floor 3333 (Σfloor = 9999)
- **나머지 1 → Stake 1위(박)에게 가산** ⇒ 박 6667, 최 3333 (Σ = 10000)

---

## 📊 다이어그램

```mermaid
classDiagram
    direction TB

    class escrow["escrow2026 : Escrow"]
    escrow : year = 2026
    escrow : currency = WELFARE_POINT
    escrow : balance_배당전 = 10000
    escrow : balance_배당후 = 0

    class win1["win1 : LedgerEntry"]
    win1 : action_type = WIN
    win1 : amount = +6000
    win1 : source = auctionA

    class win2["win2 : LedgerEntry"]
    win2 : action_type = WIN
    win2 : amount = +4000
    win2 : source = auctionB

    class stakePark["stakePark : Stake"]
    stakePark : user = 박
    stakePark : contributed_days = 2
    stakePark : ratio = 0.6667

    class stakeChoi["stakeChoi : Stake"]
    stakeChoi : user = 최
    stakeChoi : contributed_days = 1
    stakeChoi : ratio = 0.3333

    class div1["div1 : LedgerEntry"]
    div1 : action_type = DIVIDEND
    div1 : amount = -6667
    div1 : user = 박_Stake1위_나머지포함

    class div2["div2 : LedgerEntry"]
    div2 : action_type = DIVIDEND
    div2 : amount = -3333
    div2 : user = 최

    win1 --> escrow : 적립 +
    win2 --> escrow : 적립 +
    escrow --> div1 : 배당 −
    escrow --> div2 : 배당 −
    stakePark ..> div1 : 비율 적용
    stakeChoi ..> div2 : 비율 적용

    note "ΣWIN = 6000+4000 = 10000 = 잔액  ·  ΣDIVIDEND = 6667+3333 = 10000  →  총배당 = 잔액 (NFR-2). 나머지 1은 Stake 1위(박)에게 → 1콘도 초과/누락 없음"
```

### 🖼️ 렌더링 결과
![Object Diagram](object-integrity.png)

> 📸 mermaid.live에서 렌더링 후 `object-integrity.png`로 저장.

---

## 📝 무엇을 증명하나

| 불변식 | 이 스냅샷에서의 확인 |
|---|---|
| 적립 정합성 | `ΣWIN(6000+4000) = escrow.balance(10000)` |
| **배당 = 잔액 (NFR-2)** | `ΣDIVIDEND(6667+3333) = 10000` → 배당 후 잔액 0 |
| 나머지 처리 (business-rules §2.2) | floor 합 9999, 나머지 1 → Stake 1위(박) → 6667 |
| 원장 불변 (DB-RULE-1) | 모든 변동이 `LedgerEntry` INSERT로 기록 (WIN/DIVIDEND) |

> 통화별로 분리 집계되며(DB-RULE-4), `CREDIT_ADMIN`은 이 등식에서 제외된다.

---

## 🧭 내비게이션

| | 문서 |
|---|---|
| ↩️ 인덱스 | [UML 인덱스](../UML.md) |
| 📚 근거 | [SRS NFR-2](../../02_requirements/SRS.md) · [business-rules §2.2](../../02_requirements/business-rules.md) · [② 클래스](02-class.md) |
