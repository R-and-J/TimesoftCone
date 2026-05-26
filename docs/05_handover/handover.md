# 개발 인수인계서 (Handover Document)

- **작성자**: 김기철
- **문서 버전**: 1.2 (ADR 형식 + Action Item 통합)
- **관련 문서**: [SRS](../02_requirements/SRS.md), [UML](../03_design/UML.md), [ADR 인덱스](../04_decisions/README.md)

---

## 1. 프로젝트 개요: 왜 이 시스템을 만들었는가?

본 프로젝트는 고연차의 **"버려지는 연차"**와 저연차의 **"부족한 연차"** 문제를 해결하기 위해 시작되었습니다. 하지만 단순히 연차를 사고파는 기능을 넘어, **근로기준법을 준수하면서도 회사의 재무적 리스크를 0%로 통제하는 "B2E 에스크로 모델"**을 고안하여 적용한 시스템입니다.

> **단순한 CRUD 게시판이 아니며, 사내 복지 예산과 HR 정산이 직결된 "사내 금융 플랫폼"에 준하는 무결성이 요구됩니다.**

---

## 2. 3대 철학 (절대 훼손 금지)

| 원칙 | 의미 |
|---|---|
| **회사 예산 선투입 원천 차단** | 회사는 연차 매입에 돈을 쓰지 않으며, 오직 낙찰자들이 지불한 에스크로 수익금 내에서만 배당을 실행합니다. |
| **합법성 (P2P 금지)** | 근로기준법상 휴식권 매매를 방지하기 위해 개인 간 직접 거래는 시스템적으로 영구 차단되어야 합니다. |
| **인사(HR) 정산 사고 방지** | 경매로 낙찰받거나 이벤트로 받은 연차는 연말 "연차수당 지급 대상"에서 완벽하게 분리되어야 합니다. |

---

## 3. 핵심 설계 결정사항 (ADR 요약)

각 결정의 상세 근거·리스크·트레이드오프는 [ADR 문서](../04_decisions/README.md)를 반드시 정독할 것.

### 3.1 [ADR-001] Escrow 후 배당 모델
- ❌ "연차 반납자(판매자)에게 회사가 즉시 포인트 지급"
- ✅ "판매자에게 지분만 기록 → 구매자의 낙찰 수익을 에스크로에 적립 → 연말 지분율대로 N빵"
- 💣 회피: 회사 예산 손실 리스크

### 3.2 [ADR-002] 휴가 속성 3-flag 분리
- ❌ "낙찰받은 연차를 일반 연차와 동일하게 취급"
- ✅ `REGULAR`(수당 O) / `AUCTION`(수당 X) / `EVENT`(수당 X) 완벽 분리
- 💣 회피: **이중 보상 사고 (Double Dipping)**

### 3.3 [ADR-003] 백엔드 강제 차감 우선순위
- ❌ "사용자가 어떤 속성의 연차를 쓸지 선택"
- ✅ `AUCTION → EVENT → REGULAR` 자동 차감
- 💣 회피: 경매 연차 소멸 클레임

### 3.4 [ADR-004] Year 기준 파티셔닝
- ❌ "매 연차마다 expired_at 컬럼 + 매일 배치"
- ✅ `year` 컬럼 파티셔닝 + 12/31 일괄 Soft Delete
- 💣 회피: 불필요한 리소스 낭비 + 복잡도

### 3.5 [ADR-005] HR API 호출 시점 ✅ **확정**
- ✅ **Outbox Pattern을 구조적 답으로 채택**. 단, 휴가 부여를 *내부화*([ADR-016](../04_decisions/ADR-016-internal-leave-system.md))하여 분산 트랜잭션 문제 자체를 회피
- `InternalLeaveAdapter`가 `leave_balance`에 직접 INSERT → 낙찰 정산이 단일 DB 트랜잭션
- Outbox 기계는 *배당 출금* 및 *미래 그룹웨어 연동*용으로 dormant 상태로 존재
- 💣 회피: HR 200 OK + DB 롤백 시 에스크로 정합성 붕괴 → 내부화로 원천 차단

### 3.6 [ADR-006~009]
- ADR-006: (Superseded) NFR-1 동시성은 CUT-1 MySQL 행 락으로
- ADR-007: 경매 단위 "1일권" 고정
- ADR-008: 연말 일괄 배당 (즉시 분배 불가)
- ADR-009: 기존 복지 포인트 재활용 (신규 화폐 미발행)

---

## 4. 백엔드 개발 필수 준수 사항 (Technical Safeguards)

### 4.1 원장 불변의 법칙 (Insert-Only Ledger)

- `LEDGER_ENTRY` 테이블(구 `POINT_TRANSACTION_LOG`)은 **절대 UPDATE, DELETE 쿼리를 사용하지 않음**
- 관리자라도 잔액 수정이 필요하면 **사유를 적은 INSERT(REFUND/환불 또는 CREDIT_ADMIN) 트랜잭션**을 새로 발생시킴
- DB 레벨 트리거로 UPDATE/DELETE 차단 (db-schema.sql 참조)

### 4.2 동시성 제어 (Concurrency Control)

- 경매 마감 직전 트래픽 몰림 → 같은 경매 입찰을 직렬화해야 **입찰가 꼬임** 방지
- **MySQL InnoDB 행 락**(`SELECT … FOR UPDATE`)으로 같은 경매 입찰 직렬화. 트랜잭션 커밋/롤백 시 자동 해제. 별도 인프라 없음 (scope-cuts CUT-1)

### 4.3 API 트랜잭션 무결성 보장

- 에스크로 정산과 HR API 연차 부여는 **단일 트랜잭션 원칙**
- **⚠️ 중요**: [ADR-005](../04_decisions/ADR-005-hr-api-timing.md) 결정 이후 실제 구현 방식 확정 (Outbox or Saga)
- HR API 호출은 반드시 **Idempotency Key**(`auction-{id}-winner-{userId}`) 동반

### 4.4 감사 로그 기록

- 모든 포인트 변동은 `LEDGER_ENTRY`에 `escrow_balance_snapshot` 포함 INSERT
- 정합성 검증 공식 (currency별): `Σ(BID + WIN) − Σ(REFUND + DIVIDEND) = ESCROW.balance`
- `CREDIT_ADMIN`(관리자 적립)은 외부 적립이므로 위 등식과 **분리** 집계

---

## 5. 인수인계자 Action Item (향후 마일스톤)

### 🔥 Week 1 — 블로커 해결

- [x] ~~**[ADR-005] HR API 타이밍 결정**~~ ✅ 확정 — Outbox + InternalLeaveAdapter ([ADR-005](../04_decisions/ADR-005-hr-api-timing.md), [ADR-016](../04_decisions/ADR-016-internal-leave-system.md))
- [ ] **[tech-stack.md] 기술 스택 확정** (백엔드 프레임워크 / DB 버전 / MQ 선택)
- [ ] **[db-schema.sql] DDL 리뷰 + Insert-Only 트리거 구현·테스트**
- [ ] **도메인 계산식 명세** — 패자 환불 플로우 / Stake 산정식·반올림 / 배당 나머지 처리 (무지성 개발의 전제)

### Week 2 — 설계 문서 마감

- [ ] RESTful API 명세서 정식화 — [api-spec.md](../03_design/api-spec.md) → OpenAPI 3.0 YAML
- [ ] 배치 스케줄러 설계 — 12/31 연말 정산·배당 배치의 재진입성(idempotent) 설계
- [ ] 프론트엔드 UI/UX 와이어프레임 (최소 5개 화면)

### Week 3~4 — 개발 착수

- [ ] 도메인 모델 구현 (User / Auction / LeaveBalance / PointTransactionLog)
- [ ] SSO 인증 연동 + JWT 발급
- [ ] 입찰 API 구현 + 행 락 동시성 테스트
- [ ] WebSocket 실시간 브로드캐스트 채널

### 이후 Sprint

- [ ] HR API 연동 모듈 (Outbox Worker 포함)
- [ ] 연말 배치 스케줄러 구현
- [ ] 관리자 API (유찰 재고 수동 지급)
- [ ] 모니터링 대시보드 (에스크로 잔고 실시간)

---

## 6. 인수인계 시 "반드시 읽어야 할 문서" 순서

1. [proposal.md](../01_planning/proposal.md) — 왜 이 시스템이 존재하는가
2. [SRS.md](../02_requirements/SRS.md) — 정식 요구사항 (특히 3.4 DB-RULE)
3. [glossary.md](../02_requirements/glossary.md) — 용어 정의 (특히 Leave Type 3종)
4. [ADR 인덱스](../04_decisions/README.md) + **001~005까지는 필수 정독**
5. [UML.md](../03_design/UML.md) — 정적/동적 설계 시각화
6. [erd.md](../03_design/erd.md) — DB 관계도
7. [api-spec.md](../03_design/api-spec.md) — API 스펙 초안
8. 본 문서 — 통합 철학 및 Action Item

---

## 7. 맺음말

이 시스템은 기획 단계부터 **"어떻게 하면 편하게 휴가를 나눌까"**보다 **"어떻게 하면 회사 시스템의 허점을 이용한 어뷰징과 재무 사고를 완벽히 막아낼까"**에 80% 이상의 리소스를 쏟아부은 깐깐한 아키텍처입니다.

새로운 기능을 추가하거나 플로우를 변경할 때, 이 문서 및 ADR에 적힌 **"회피하고자 했던 리스크"**들이 다시 부활하지 않는지 반드시 크로스체크해 주시기 바랍니다.

### 🚨 절대 건드리지 말아야 할 것

1. `LEDGER_ENTRY`의 Insert-Only 제약 (트리거 포함)
2. 3-flag 분리 (`REGULAR`/`AUCTION`/`EVENT`)
3. 차감 우선순위 (`AUCTION → EVENT → REGULAR`)
4. 에스크로 잔액 초과 배당 금지
5. P2P 직거래 경로 (API든 UI든) 신설 금지

### 🧱 구조 ADR 요약 (2026-05-14 추가)

정책 ADR과 별개로, *구조* 측면에서 다음이 확정됨 (상세는 [ADR 인덱스](../04_decisions/README.md)):

- **[ADR-012] Hexagonal Architecture** — `domain/`은 외부 라이브러리 의존 0. `ports/` 인터페이스 → `adapters/` 구현.
- **[ADR-010] 통화 추상화** — 화폐는 `BiddingCurrency`/`PayoutChannel` 인터페이스 뒤로. `WelfarePointProvider`가 현재 유일 구현체.
- **[ADR-011] wallet 자체 보유** — 복지 포인트 잔액 마스터는 본 시스템. 입찰 결제 경로에서 외부 호출 0.
- **[ADR-013] Domain Event** — 횡단 관심사(알림·메트릭·감사)는 이벤트 핸들러로 분리. Use Case는 부수효과를 직접 알지 못함.
- **[ADR-014] Auction State 패턴** — 6개 상태 객체. 도메인 메서드에 `if (status === ...)` 금지.
- **[ADR-015] Value Object** — `UserId`/`Point`/`LeaveDays` 등은 원시 타입 대신 VO. 생성 시점 불변식 강제.
- **[ADR-016] 자체 휴가 관리 보유** — `leave_balance` 마스터도 본 시스템. `LeaveGrantPort` → `InternalLeaveAdapter`(기본). 휴가 기안/승인 워크플로는 스코프 외.
- **[ADR-017] 휴가 풀 분리 컨텍스트** — 연말 풀 수집(FR-1.1)은 별도 Bounded Context `LeavePool`. 일상 휴가 관리와 분리.

> **3대 외부 자원의 일관된 처리**: 화폐(ADR-010/011) · 휴가(ADR-016) · HR 타이밍(ADR-005)은 전부 동일 패턴 — "포트 뒤로 추상화, 내부 어댑터를 기본 구현체로, 실 외부 연동은 추후 어댑터 교체". 새 기능 추가 시 이 패턴을 깨지 않도록 주의.
