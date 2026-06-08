# 사내 연차 경매 시스템

**팀명**: 타임소프트콘 | **팀원**: 김기철, 오지석
**소속**: 공학대 2학년 1학기 소프트웨어 공학
**SRS 제출**: 2026-04-10 | **UML 제출**: 2026-04-24

> 사내 휴가 사용의 양극화 문제(고연차 잉여 ↔ 저연차 부족)를 **B2E Escrow & Dividend 아키텍처**로 해결하는 사내 금융 수준 정합성의 연차 거래 플랫폼.

---

## 📚 문서 네비게이션

### 01. 기획 (Planning)
- [프로젝트 기획안](01_planning/proposal.md) — 배경, 문제, 해결 방안(Escrow 모델)

### 02. 요구사항 (Requirements)
- [소프트웨어 요구사항 명세서 (SRS)](02_requirements/SRS.md) — FR / NFR / DB-RULE
- [용어집 (Glossary)](02_requirements/glossary.md) — B2E, Stake, Leave Type, Escrow 등
- [비즈니스 규칙·운영 파라미터·계산식](02_requirements/business-rules.md) — 경매 기간·증분·Stake/배당 수식·KPI
- [엣지 케이스 카탈로그](02_requirements/edge-cases.md) — 퇴사자·연중 입사자·유찰·동점 등 경계 상황
- [권한 매트릭스 (RBAC + ABAC)](02_requirements/permission-matrix.md) — 기능별 EMPLOYEE/ADMIN 권한, 관리자 COI 감사 분리
- [FR별 인수 조건 (Acceptance Criteria)](02_requirements/acceptance-criteria.md) — FR-1.1 ~ FR-5.2 Given/When/Then

### 03. 설계 (Design)
- [UML 다이어그램 인덱스](03_design/UML.md) — 4종 네비게이션 + 렌더링 이미지 갤러리 🖼️
  - [① 유스케이스](03_design/uml/01-use-case.md) · [PNG](03_design/uml/usecase.png)
  - [② 클래스](03_design/uml/02-class.md) · [PNG](03_design/uml/class.png)
  - [③ 순차](03_design/uml/03-sequence.md) · [PNG](03_design/uml/sequence.png)
  - [④ 상태](03_design/uml/04-state.md) · [PNG](03_design/uml/state.png)
- [시스템 아키텍처](03_design/architecture.md) — 컴포넌트/배포 구성
- [ERD (논리·물리)](03_design/erd.md) — 핵심 엔티티 관계도
- [API 명세서 (Narrative)](03_design/api-spec.md) — 사람이 읽기 쉬운 요약
- [openapi.yaml (정식 spec)](03_design/openapi.yaml) — OpenAPI 3.0.3, codegen·Swagger UI 기준

### 04. 아키텍처 결정 기록 (ADR)
- [ADR 인덱스](04_decisions/README.md)
- **정책 결정**
  - [ADR-001 Escrow 후 배당 모델](04_decisions/ADR-001-escrow-model.md)
  - [ADR-002 휴가 속성 플래그 분리](04_decisions/ADR-002-leave-type-flag.md)
  - [ADR-003 백엔드 강제 차감 우선순위](04_decisions/ADR-003-forced-priority.md)
  - [ADR-004 Year 기준 파티셔닝](04_decisions/ADR-004-year-partitioning.md)
  - [ADR-005 HR API 호출 시점](04_decisions/ADR-005-hr-api-timing.md) ✅ (Outbox + 내부화)
  - [ADR-006 Redis 분산 락 선택](04_decisions/ADR-006-redis-lock.md) ⛔ (Superseded — CUT-1 SQLite write 락)
  - [ADR-007 경매 단위 "1일권" 고정](04_decisions/ADR-007-one-day-unit.md)
  - [ADR-008 연말 일괄 배당](04_decisions/ADR-008-year-end-dividend.md)
  - [ADR-009 복지 포인트 재활용 (v2)](04_decisions/ADR-009-point-reuse.md)
  - [ADR-011 복지 포인트 시스템 자체 보유](04_decisions/ADR-011-welfare-point-ownership.md)
  - [ADR-016 자체 휴가 관리 시스템 보유](04_decisions/ADR-016-internal-leave-system.md)
  - [ADR-017 휴가 풀/경매 인벤토리 분리 컨텍스트](04_decisions/ADR-017-leave-pool-context.md)
  - [ADR-018 경매 정산 규칙 (패자 환불·입찰 취소)](04_decisions/ADR-018-auction-settlement-rules.md)
- **구조 결정 (정책에 직교)**
  - [ADR-012 Hexagonal Architecture](04_decisions/ADR-012-hexagonal-architecture.md)
  - [ADR-010 통화 추상화 (CurrencyProvider)](04_decisions/ADR-010-currency-abstraction.md)
  - [ADR-013 Domain Event 기반 처리](04_decisions/ADR-013-domain-event.md)
  - [ADR-014 Auction State 패턴](04_decisions/ADR-014-auction-state-pattern.md)
  - [ADR-015 Value Object 도입 정책](04_decisions/ADR-015-value-object.md)

### 05. 인수인계 (Handover)
- [개발 인수인계서](05_handover/handover.md) — 철학 + ADR 요약 + Action Item
- [시연 시나리오 문서](05_handover/demo-scenario.md) — 시연 순서·예상 입력값·기대 결과 + 실패 시 대체 자료

### 06. 기술/운영 (Tech)
- [기술 스택 결정서](06_tech/tech-stack.md)
- [DB 스키마 DDL](06_tech/db-schema.sql)
- [Git 워크플로우](06_tech/git-workflow.md)
- [개발 환경 설정](06_tech/dev-setup.md)
- [이벤트 버스(Observer) 사용 가이드](06_tech/event-bus-guide.md)

### 07. 프로젝트 관리 (Plan)
- [WBS 및 일정](07_plan/wbs.md)
- [역할 분담](07_plan/roles.md)

### 08. 발표 (Presentation)
- [13주차 발표 슬라이드 (Marp)](../presentation/slides.md) — 6대 항목 + 채점기준 매핑, UML·아키텍처·GoF 패턴
- [13주차 발표 대본·예상질문](../presentation/script.md) — 슬라이드별 멘트, 발표 전 체크리스트, Q&A

### 99. 아카이브
- [UML 모델링 명세서 제출본 (PDF)](99_archive/UML모델링명세서_제출본.pdf)

---

## 🎯 문서별 상태

| 카테고리 | 문서 | 상태 |
|---|---|---|
| 기획 | proposal.md | ✅ 완성 |
| 요구사항 | SRS.md | ✅ v1.2 (ADR-005·010~018 반영) |
| 요구사항 | glossary.md | ✅ 완성 |
| 요구사항 | business-rules.md | ✅ v1 (운영 파라미터·계산식·KPI) |
| 요구사항 | edge-cases.md | ✅ v1 (엣지 케이스 카탈로그) |
| 요구사항 | permission-matrix.md | ✅ v1 (RBAC + ABAC) |
| 요구사항 | acceptance-criteria.md | ✅ v1 (FR별 인수 조건) |
| 설계 | UML.md | ✅ 완성 |
| 설계 | architecture.md | ✅ v2 (Hexagonal·구조 ADR 반영) |
| 설계 | erd.md | ✅ v2 (wallet 분리·LEDGER_ENTRY 반영) |
| 설계 | api-spec.md | ✅ v3 (narrative summary) |
| 설계 | openapi.yaml | ✅ v0.1 (OpenAPI 3.0 정식 spec) |
| ADR | 001~005 | ✅ 확정 (005 = Outbox + 내부화) |
| ADR | 006~008 | 🟡 Proposed |
| ADR | 009 | ✅ Accepted (v2 개정) |
| ADR | 010~018 | ✅ Accepted (구조·휴가 내부화·정산 규칙) |
| 인수인계 | handover.md | ✅ v1.1 베이스 + Action 복원 |
| 인수인계 | demo-scenario.md | ✅ v1 (시연 순서·입력값·기대결과·대체자료) |
| 기술 | tech-stack.md | 🟡 선택지 제시, 미결정 |
| 기술 | db-schema.sql | ✅ v2 (wallet/ledger_entry 분리) |
| 기술 | git-workflow.md | 🟡 제안 |
| 기술 | dev-setup.md | ⚪ TODO |
| 계획 | wbs.md | 🟡 v3 (비즈니스 리스크 대장·롤아웃 전략 추가) |
| 계획 | roles.md | ⚪ TODO |

**범례**: ✅ 완성 | 🟡 초안/부분 완성 | 🔴 중요 미결 | ⚪ TODO (팀 협의 필요)

---

## 🚨 프로젝트 시작 전 반드시 해결할 것

1. ~~**[ADR-005] HR API 호출 시점 재설계**~~ — ✅ 해결 (Outbox + InternalLeaveAdapter)
2. ~~**도메인 계산식 명세**~~ — ✅ 해결 (business-rules.md + ADR-018: 패자 환불·Stake·배당 나머지)
3. **[tech-stack.md] 백엔드 프레임워크·DB·MQ 확정** — 나머지 모든 개발의 전제 (미결)
4. **[db-schema.sql] Insert-Only 트리거 검증** — NFR-2 재무 정합성의 최종 방어선
5. **운영 파라미터 구체 수치 확정** — 최소 증분 금액, 분산 오픈 주당 개수, 첫 해 시작가 (business-rules.md §5)

## 📐 핵심 설계 원칙 (요약)

### 정책 원칙
1. **회사 예산 0원 선투입** — 에스크로 잔액 내에서만 배당
2. **P2P 직거래 영구 차단** — 근로기준법 준수
3. **휴가 속성 3-flag 분리** — REGULAR / AUCTION / EVENT
4. **차감 우선순위 강제** — AUCTION → EVENT → REGULAR
5. **원장 불변(Insert-Only)** — LEDGER_ENTRY UPDATE/DELETE 금지
6. **단일 트랜잭션** — 낙찰·에스크로·HR Outbox를 All-or-Nothing 처리

### 구조 원칙 (ADR-010~015)
7. **Hexagonal Architecture** — 도메인 코어와 외부 의존(인프라·외부 API) 격리
8. **통화 추상화 (OCP)** — 화폐 종류는 `CurrencyProvider` 인터페이스 뒤로 격리
9. **Wallet 마스터 본 시스템 보유** — 입찰 결제 경로에서 외부 호출 0
10. **Domain Event 기반 횡단 관심사 처리** — Use Case가 부수효과를 직접 알지 못함
11. **State 패턴 + Value Object** — 도메인 표현력과 컴파일 타임 안전성 동시 확보
