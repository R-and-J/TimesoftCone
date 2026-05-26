# 비즈니스 규칙 · 운영 파라미터 · 계산식

**상태**: ✅ v1 — 기획 결정 16건 정식화 (2026-05-14)
**관련 문서**: [SRS](SRS.md) / [edge-cases.md](edge-cases.md) / [ADR-018](../04_decisions/ADR-018-auction-settlement-rules.md)

> 본 문서는 SRS의 FR/NFR을 *실행 가능한 수치·수식·규칙*으로 구체화한다. "무지성 개발"이 가능하려면 이 문서의 빈칸이 없어야 한다.

---

## 1. 운영 파라미터

개발 착수 시 *설정값*으로 주입되어야 하는 항목. ⚙️ 표시는 운영자가 런타임에 조정 가능.

| ID | 파라미터 | 결정값 | 비고 |
|---|---|---|---|
| OP-1 | 개별 경매 기간 | **3일** | 매물 1건이 OPEN → CLOSED까지. 마감 직전 트래픽 집중 → 행 락(`FOR UPDATE`)으로 직렬화 (CUT-1) |
| OP-2 | 매물 풀 크기 | **수집 전량 1:1** | 연말 수집된 `REGULAR` 미사용 연차 N일 = 1일권 N개 |
| OP-3 | 최소 입찰 증분 | **고정 금액** ⚙️ | 현재가 + 고정 포인트. 구체 금액은 운영자 설정 (초기 권장: 100 P) |
| OP-4 | 경매 오픈 방식 | **분산 오픈** | 1/1 전량 동시 아님. 매주 고정 개수씩 소진 시까지 |
| OP-5 | 분산 오픈 단위 | **매주 고정 개수** ⚙️ | 운영자가 주당 N개 지정, 풀 소진 시 종료. 주당 개수는 운영자 설정 |
| OP-6 | 경매 시작가 | **관리자 설정 (3모드)** ⚙️ | 모드 선택: ① 자유 입력 ② 고정 최소가 ③ 작년 평균 낙찰가 기반. 첫 해는 ①·② 중 선택 (작년 데이터 없음) |
| OP-7 | 입찰 동시성 제어 | MySQL 행 락(`FOR UPDATE`) | 트랜잭션 수명, 별도 TTL 없음 (CUT-1) |
| OP-8 | 연말 배치 시각 | 12/31 23:59 | [SRS](SRS.md) FR-1.1 / FR-4.1 |

> ⚠️ **개발 전 확정 필요**: OP-3(증분 금액), OP-5(주당 개수), OP-6(첫 해 모드·값)의 *구체 수치*. 본 표는 *구조*를 확정하고 수치는 운영자 설정값으로 위임 — 단 첫 배포 기본값은 팀이 정해야 함.

---

## 2. 핵심 계산식

### 2.1 Stake (지분율) 산정 — 단순 비례

```
stake_ratio(user, year) = contributed_days(user, year) / Σ contributed_days(*, year)
```

- `contributed_days` = 해당 직원이 연말에 공용 풀로 기여한 `REGULAR` 미사용 연차 일수
- 정밀도: `NUMERIC(10,8)` ([db-schema.sql](../06_tech/db-schema.sql))
- **유찰 리스크 반영**: 별도 가중치 없음. 유찰된 매물은 에스크로 적립이 0이므로 *배당 재원 자체가 줄어드는 것*으로 자연 반영 ([ADR-001](../04_decisions/ADR-001-escrow-model.md))
- 연중 입사자: 기여 불가 → `contributed_days = 0` → Stake 없음 ([edge-cases.md](edge-cases.md) EC-2)

### 2.2 배당금 산정 — 지분 비례 + 나머지 1위 몰아주기

```
1. raw_dividend(user)  = escrow_balance(year) × stake_ratio(user, year)
2. floor_dividend(user) = floor(raw_dividend(user))         # 정수 포인트로 내림
3. remainder = escrow_balance(year) − Σ floor_dividend(*)   # 나누어떨어지지 않는 잔여
4. 최종 배당: floor_dividend(user)
              + (user가 stake_ratio 1위면 remainder, 아니면 0)
```

- **불변식 보장**: `Σ 최종배당 = escrow_balance(year)` — [NFR-2](SRS.md#nfr-2-재무-정합성-및-감사-추적성-auditability) "총 배당 = 에스크로 총액" 등식이 정확히 성립
- 에스크로 잔액을 **1포인트도 초과하지 않음** — floor + 잔여 분배 구조상 초과 불가능
- Stake 1위 동률 시: `user_id` 오름차순 등 결정적 타이브레이크 1명 ([edge-cases.md](edge-cases.md) EC-7)
- 통화별로 분리 계산 ([db-schema.sql](../06_tech/db-schema.sql) DB-RULE-4)

### 2.3 패자 환불 — 밀리는 즉시 환불

상위 입찰이 접수되면 *직전 최고가 입찰자*에게 즉시 환불. 상세 흐름·트레이드오프는 [ADR-018](../04_decisions/ADR-018-auction-settlement-rules.md).

```
입찰 접수 (낙찰 트랜잭션 내):
  ├─ 신규 입찰자: wallet 차감 + LEDGER_ENTRY(BID, -amount)
  ├─ 직전 최고가 입찰자 존재 시:
  │    wallet 환급 + LEDGER_ENTRY(REFUND, +직전금액)
  └─ auctions.highest_bid / winner 갱신
```

- 최종 낙찰자만 차감 상태 유지 → 경매 마감 시 `WIN` 확정, 에스크로로 귀속
- 에스크로 정합성: `Σ(BID + WIN) − Σ(REFUND + DIVIDEND) = ESCROW.balance` (currency별)

---

## 3. 거버넌스 규칙

| ID | 규칙 | 결정 | 리스크 |
|---|---|---|---|
| GOV-1 | 관리자(ADMIN)의 경매 참여 | **완전 허용** — 입찰·연차 기여 모두 가능, 일반 직원과 구분 없음 | ⚠️ 이해상충(COI) — 관리자는 경매 오픈·유찰 EVENT 지급 권한 보유. [wbs 리스크 대장](../07_plan/wbs.md) BR-1에 등재 |
| GOV-2 | 자기 기여분 되사기 | **허용** — 행위 기반 역할 ([proposal](../01_planning/proposal.md)) | 자기 연차를 `REGULAR → AUCTION` 전환(수당 자격 상실)이라 대체로 자기-손해 |
| GOV-3 | 입찰 취소 | **불가** — 한번 입찰하면 되돌릴 수 없음 | [ADR-018](../04_decisions/ADR-018-auction-settlement-rules.md) |

---

## 4. 성공 지표 (KPI)

| KPI | 정의 | 측정 메커니즘 | ⚠️ 선결 |
|---|---|---|---|
| **연차 활용률 개선폭** | 제도 도입 전후 *소멸 연차 감소량* | 도입 전 **baseline 측정 필수** — 직전 연도 `REGULAR` 소멸 일수 집계. 도입 후 동일 지표와 비교 | baseline 데이터 확보 |
| **직원 만족도** | 제도 만족도 설문 점수 | **설문 도구 필요** — 베타 종료 후 + 연 1회 정기 설문. 문항 설계 필요 | 설문 문항·도구 미정 |

> 두 KPI 모두 *시스템 외부 측정 활동*을 요구한다. 코드만으로는 안 나옴 — 운영 계획에 baseline 측정·설문 일정을 포함해야 함.

---

## 5. 미결 항목 (개발 전 팀 확정)

- [ ] OP-3 최소 입찰 증분의 구체 금액 (초기 권장: 100 P)
- [ ] OP-5 분산 오픈 주당 개수
- [ ] OP-6 첫 해 시작가 모드 및 값
- [ ] KPI baseline 측정 방법 + 만족도 설문 문항
- [ ] 최소 입찰 증분을 통화별로 다르게 둘지 (현재는 단일 통화라 보류)

## 관련 문서

- [SRS](SRS.md) — FR/NFR 원본
- [edge-cases.md](edge-cases.md) — 엣지 케이스 카탈로그
- [ADR-018](../04_decisions/ADR-018-auction-settlement-rules.md) — 경매 정산 규칙의 "왜"
- [ADR-001](../04_decisions/ADR-001-escrow-model.md) · [ADR-008](../04_decisions/ADR-008-year-end-dividend.md) — 에스크로·배당 모델
