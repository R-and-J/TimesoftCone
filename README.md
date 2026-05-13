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
- [소프트웨어 요구사항 명세서 (SRS)](02_requirements/SRS.md) — FR 7건 / NFR 2건 / DB-RULE 3건
- [용어집 (Glossary)](02_requirements/glossary.md) — B2E, Stake, Leave Type, Escrow 등

### 03. 설계 (Design)
- [UML 다이어그램 인덱스](03_design/UML.md) — 4종 네비게이션 + 렌더링 이미지 갤러리 🖼️
  - [① 유스케이스](03_design/uml/01-use-case.md) · [PNG](03_design/uml/usecase.png)
  - [② 클래스](03_design/uml/02-class.md) · [PNG](03_design/uml/class.png)
  - [③ 순차](03_design/uml/03-sequence.md) · [PNG](03_design/uml/sequence.png)
  - [④ 상태](03_design/uml/04-state.md) · [PNG](03_design/uml/state.png)
- [시스템 아키텍처](03_design/architecture.md) — 컴포넌트/배포 구성
- [ERD (논리·물리)](03_design/erd.md) — 핵심 엔티티 관계도
- [API 명세서 (OpenAPI)](03_design/api-spec.md) — REST 엔드포인트 스펙

### 04. 아키텍처 결정 기록 (ADR)
- [ADR 인덱스](04_decisions/README.md)
- [ADR-001 Escrow 후 배당 모델](04_decisions/ADR-001-escrow-model.md)
- [ADR-002 휴가 속성 플래그 분리](04_decisions/ADR-002-leave-type-flag.md)
- [ADR-003 백엔드 강제 차감 우선순위](04_decisions/ADR-003-forced-priority.md)
- [ADR-004 Year 기준 파티셔닝](04_decisions/ADR-004-year-partitioning.md)
- [ADR-005 HR API 호출 시점 🔥](04_decisions/ADR-005-hr-api-timing.md) **(최우선 미결)**
- [ADR-006 Redis 분산 락 선택](04_decisions/ADR-006-redis-lock.md)
- [ADR-007 경매 단위 "1일권" 고정](04_decisions/ADR-007-one-day-unit.md)
- [ADR-008 연말 일괄 배당](04_decisions/ADR-008-year-end-dividend.md)
- [ADR-009 복지 포인트 재활용](04_decisions/ADR-009-point-reuse.md)

### 05. 인수인계 (Handover)
- [개발 인수인계서](05_handover/handover.md) — 철학 + ADR 요약 + Action Item

### 06. 기술/운영 (Tech)
- [기술 스택 결정서](06_tech/tech-stack.md)
- [DB 스키마 DDL](06_tech/db-schema.sql)
- [Git 워크플로우](06_tech/git-workflow.md)
- [개발 환경 설정](06_tech/dev-setup.md)

### 07. 프로젝트 관리 (Plan)
- [WBS 및 일정](07_plan/wbs.md)
- [역할 분담](07_plan/roles.md)

### 99. 아카이브
- [UML 모델링 명세서 제출본 (PDF)](99_archive/UML모델링명세서_제출본.pdf)

---

## 🎯 문서별 상태

| 카테고리 | 문서 | 상태 |
|---|---|---|
| 기획 | proposal.md | ✅ 완성 |
| 요구사항 | SRS.md | ✅ 완성 |
| 요구사항 | glossary.md | ✅ 완성 |
| 설계 | UML.md | ✅ 완성 |
| 설계 | architecture.md | 🟡 스켈레톤 (기술스택 확정 후) |
| 설계 | erd.md | ✅ 완성 |
| 설계 | api-spec.md | 🟡 스켈레톤 (기본 엔드포인트) |
| ADR | 001~004 | ✅ 확정 |
| ADR | 005 | 🔴 **미결 — 구현 전 반드시 결정** |
| ADR | 006~009 | 🟡 Proposed |
| 인수인계 | handover.md | ✅ v1.1 베이스 + Action 복원 |
| 기술 | tech-stack.md | 🟡 선택지 제시, 미결정 |
| 기술 | db-schema.sql | 🟡 초안 (팀 리뷰 필요) |
| 기술 | git-workflow.md | 🟡 제안 |
| 기술 | dev-setup.md | ⚪ TODO |
| 계획 | wbs.md | ⚪ TODO |
| 계획 | roles.md | ⚪ TODO |

**범례**: ✅ 완성 | 🟡 초안/부분 완성 | 🔴 중요 미결 | ⚪ TODO (팀 협의 필요)

---

## 🚨 프로젝트 시작 전 반드시 해결할 3가지

1. **[ADR-005] HR API 호출 시점 재설계** — Outbox 패턴 또는 Saga 보상 결정 필요
2. **[tech-stack.md] 백엔드 프레임워크·DB·MQ 확정** — 나머지 모든 개발의 전제
3. **[db-schema.sql] Insert-Only 트리거 검증** — NFR-2 재무 정합성의 최종 방어선

## 📐 핵심 설계 원칙 (요약)

1. **회사 예산 0원 선투입** — 에스크로 잔액 내에서만 배당
2. **P2P 직거래 영구 차단** — 근로기준법 준수
3. **휴가 속성 3-flag 분리** — REGULAR / AUCTION / EVENT
4. **차감 우선순위 강제** — AUCTION → EVENT → REGULAR
5. **원장 불변(Insert-Only)** — POINT_TRANSACTION_LOG UPDATE/DELETE 금지
6. **단일 트랜잭션** — 낙찰·에스크로·HR API를 All-or-Nothing 처리
