# WBS 및 일정 계획

**상태**: 🟡 v2 — 구조 ADR(010~015) 반영. 팀 확정 필요
**기준일**: 2026-04-23 (초안) → 2026-05-14 (개정)

---

## 1. 전체 일정 개괄

| Phase | 기간 | 목표 | 산출물 |
|---|---|---|---|
| **0. 설계 마감** | Week 0 (1주) | 미결 ADR 해소, 기술스택 확정, 구조 ADR 확정 | ADR-005 Accepted, tech-stack 확정, **ADR-010~017 적용**, 도메인 계산식 명세 |
| **1. 인프라 준비** | Week 1 (1주) | 개발환경, CI/CD 골격, Hexagonal 디렉토리 구조 | repo, docker-compose, Jenkinsfile, ESLint boundaries 규칙 |
| **2. 도메인 코어** | Week 2~3 (2주) | Value Object·State 패턴·이벤트 정의 | Auction/Bid/Wallet/Escrow 도메인 + 단위 테스트 |
| **3. 어댑터 + 경매 핵심** | Week 4~5 (2주) | Repository·CurrencyProvider 구현체, 입찰·낙찰 | 어댑터 + AuctionService, WebSocket |
| **4. HR 연동** | Week 6 (1주) | Outbox Worker, Mock/Real HR Client (Adapter) | ADR-005 구현 |
| **5. 배치·배당** | Week 7 (1주) | 12/31 연말 배치, 관리자 적립 API | 배치 스케줄러 + FR-5.1 API |
| **6. 프론트엔드** | Week 4~7 (4주, 병렬) | React UI, 실시간 입찰 화면 | 핵심 5개 화면 |
| **7. 통합·QA** | Week 8 (1주) | E2E 테스트, 부하 테스트 | 테스트 리포트 |
| **8. 발표 준비** | Week 9 (1주) | 발표자료, 시연 | PPT, 데모 영상 |

---

## 2. 마일스톤 (Milestones)

| 마일스톤 | 목표일 | 판단 기준 |
|---|---|---|
| M1: 설계 완료 | Week 0 End | ADR-005~017 모두 Accepted + 도메인 계산식 명세 완료 |
| M2: 개발 착수 준비 | Week 1 End | docker-compose up → API Hello World 확인, ESLint boundaries 통과 |
| M3: 도메인 코어 완성 | Week 3 End | Auction/Wallet 도메인 단위 테스트 ≥ 80% (외부 의존 없음) |
| M4: MVP 백엔드 | Week 5 End | 입찰·낙찰 흐름이 통합 테스트에서 통과 |
| M5: HR 연동 검증 | Week 6 End | Outbox Worker가 mock HR 서버에 재시도 성공 |
| M6: 연말 배치 시연 | Week 7 End | 시뮬레이션 데이터로 배당 완료, 관리자 적립 API 동작 |
| M7: 통합 릴리즈 | Week 8 End | v1.0.0 태그 생성 |
| M8: 발표 | Week 9 End | 최종 제출 |

---

## 3. WBS (Work Breakdown Structure)

### Level 1 / 2 트리

```
0. 프로젝트 관리
  0.1 일정 관리
  0.2 리스크 관리
  0.3 문서 관리

1. 요구사항 · 설계 (완료 및 미결)
  1.1 SRS (완료)
  1.2 UML (완료)
  1.3 ADR 마감 ← 🔥 진행 중
  1.4 API 명세 OpenAPI YAML 정식화
  1.5 ERD·DDL 리뷰

2. 인프라
  2.1 Git Repository 초기화
  2.2 docker-compose 개발환경
  2.3 Jenkins 파이프라인 구성
  2.4 DB 스키마 마이그레이션 도구 설정

3. 백엔드 개발 (Hexagonal — ADR-012)
  3.0 도메인 코어 (외부 의존 0)
    3.0.1 Value Objects (UserId, Cone, LeaveDays 등 — ADR-015 Phase 1)
    3.0.2 Domain Events 정의 (ADR-013)
    3.0.3 ESLint boundaries 규칙 설정
  3.1 인증 (SSO + JWT)
  3.2 Wallet 도메인 + Currency 추상화 (ADR-010/011)
    3.2.1 wallet 테이블 · LEDGER_ENTRY · 트리거
    3.2.2 BiddingCurrency 인터페이스 + WelfarePointProvider 구현
    3.2.3 PayoutChannel 인터페이스 + WelfareCardLimitChannel 구현
    3.2.4 관리자 적립 API (FR-5.1) + 잔액 조회 API (FR-5.2)
    3.2.5 HR → wallet 마이그레이션 도구 (운영 시드, ADR-011)
  3.3 Leave 도메인 — 자체 휴가 관리 (ADR-016)
    3.3.1 leave_balance 테이블 + 파티셔닝
    3.3.2 LeaveGrantPort 인터페이스 + InternalLeaveAdapter 구현
    3.3.3 차감 우선순위 Strategy (AUCTION→EVENT→REGULAR — ADR-003)
    3.3.4 휴가 잔액 조회 API
  3.4 Auction 도메인 (State 패턴 — ADR-014)
    3.4.1 6개 상태 객체 (CREATED/OPEN/CLOSED/AWARDED/UNSOLD/EXPIRED)
    3.4.2 경매 조회 API
    3.4.3 입찰 API (UnitOfWork.lockAuction — SQLite write 락)
    3.4.4 낙찰 배치 (경매 마감 처리 — wallet·escrow·ledger·leave 단일 트랜잭션)
  3.5 LeavePool 컨텍스트 — 연말 풀 수집 (ADR-017)
    3.5.1 12/31 풀 수집 배치 (REGULAR 미사용 → 매물 생성)
    3.5.2 Stake 산정·기록
    3.5.3 배치 재진입성(idempotent) 설계
  3.6 Outbox Worker + GroupwareLeaveAdapter (미래 그룹웨어 연동 대비 — dormant)
  3.7 Dividend 도메인 (연말 배치 — PayoutChannel)
  3.8 Admin API (유찰 재고 EVENT 수동 지급 + 관리자 적립 FR-5.1)
  3.9 WebSocket 실시간 알림 (Domain Event 핸들러 — ADR-013)

4. 프론트엔드 개발
  4.1 SSO 로그인 플로우
  4.2 경매 목록 / 상세
  4.3 실시간 입찰 화면 (WebSocket)
  4.4 내 콘 / 배당 대시보드
  4.5 관리자 페이지

5. 테스트
  5.1 단위 테스트 커버리지 ≥ 70%
  5.2 통합 테스트 (주요 시나리오)
  5.3 E2E (Playwright)
  5.4 부하 테스트 (k6 입찰 동시성)
  5.5 데이터 정합성 검증 (에스크로 공식)

6. 운영 준비
  6.1 배포 스크립트
  6.2 모니터링 설정 (Prometheus/Grafana)
  6.3 Runbook 작성
  6.4 보안 점검

7. 발표 준비
  7.1 발표자료 업데이트 (PPTX slide 4 포함)
  7.2 시연 시나리오 스크립트
  7.3 데모 환경 세팅
```

---

## 4. 주차별 상세 (Sample - 수정 필요)

### Week 0 (May 14 ~ May 20) — 구조 ADR 적용

| 담당 | Task | 산출물 |
|---|---|---|
| 공동 | ~~ADR-005 결정 회의~~ ✅ 완료 (Outbox + InternalLeaveAdapter) | ADR-005 Accepted |
| 공동 | ADR-010~017 리뷰 + 합의 | 8개 ADR Accepted |
| 공동 | 도메인 계산식 명세 (패자 환불·Stake·배당 나머지) | SRS 보강 또는 신규 ADR |
| 김기철 | db-schema v2 검증 + Insert-Only 트리거 테스트 | 마이그레이션 스크립트 |
| 오지석 | Hexagonal 디렉토리 골격 + ESLint boundaries | 디렉토리 트리, 린트 규칙 |

### Week 1 (May 21 ~ May 27) — 인프라

| 담당 | Task | 산출물 |
|---|---|---|
| 김기철 | Repo 초기화 + Jenkins 파이프라인 초안 | `.github/`, Jenkinsfile |
| 오지석 | docker-compose 기동 확인 | docker-compose.yml |

### Week 2~3 — 도메인 코어 (외부 의존 0)

| 담당 | Task | 산출물 |
|---|---|---|
| 김기철 | Value Objects (UserId/Cone/LeaveDays/...) | `domain/shared/value-objects/` + 단위 테스트 |
| 오지석 | Auction State 객체 6종 + Domain Events | `domain/auction/` + 단위 테스트 |
| 공동 | Wallet 도메인 + BiddingCurrency 인터페이스 | `domain/wallet/`, `ports/bidding-currency.ts` |

### Week 4~5 — 어댑터 + 경매 핵심

| 담당 | Task | 산출물 |
|---|---|---|
| 김기철 | TypeORM/Prisma Repository 어댑터 | `adapters/persistence/` |
| 오지석 | WelfarePointProvider · UnitOfWork write 락(SQLite) | `adapters/wallet/`, `adapters/persistence/` |
| 공동 | PlaceBid / SettleAuction Use Case + WebSocket | `application/`, `interfaces/websocket/` |

(이하 매주 업데이트)

---

## 5. 리스크 대장

### 5.1 프로젝트 리스크 (일정·기술)

| ID | 리스크 | 발생 가능성 | 영향 | 대응 계획 |
|---|---|---|---|---|
| R1 | ~~ADR-005 결정 지연~~ ✅ 해소 (Outbox + 내부화 확정) | — | — | — |
| R2 | HR API Mock 환경 부재 | 높음 | 중 | WireMock 기반 Mock HR 서버 구축 + HrClient 어댑터 인터페이스 분리 |
| R3 | SQLite write 락 경합/`database is locked` | 중 | 높음 | k6 부하 테스트 조기 수행 |
| R4 | 프론트-백 API 스펙 불일치 | 중 | 중 | OpenAPI 기반 codegen 도입 |
| R5 | 2인 팀 병가/휴가로 병목 | 중 | 높음 | PR 크로스 리뷰 + 문서화 강화 |
| R6 | 일학습병행제 업무 일정과 충돌 | 높음 | 중 | 주간 가용 시간 사전 공유 |
| R7 | Hexagonal 보일러플레이트 일정 부담 | 중 | 중 | Value Object Phase 1만 우선 적용, Phase 2~3는 시간 여유 시 |
| R8 | wallet 마이그레이션 도구 미비 | 낮음 | 중 | 학교 발표는 시드 데이터로 시뮬레이션, 실 도입은 별도 프로젝트 |

### 5.2 비즈니스 / 제품 리스크

> 일정·기술이 아닌 *제품이 의도대로 작동하지 않을* 리스크. 기획자 관점에서 인지·수용·대응을 기록한다.

| ID | 리스크 | 발생 가능성 | 영향 | 대응 계획 |
|---|---|---|---|---|
| BR-1 | **관리자 이해상충(COI)** — 관리자가 경매 오픈·유찰 EVENT 지급 권한을 가진 채 본인도 입찰 참여 ([business-rules](../02_requirements/business-rules.md) GOV-1) | 중 | 높음 | **수용된 결정** (관리자 완전 허용). 완화책: 관리자 입찰은 `LEDGER_ENTRY` 별도 플래그로 표시, 경매 오픈·EVENT 지급 권한과 입찰 행위를 감사 로그에서 분리 추적. 실 도입 시 재검토 |
| BR-2 | **참여 저조** — 아무도 입찰 안 하거나 기여 안 함 → 시장 미형성 | 중 | 높음 | 베타 단계에서 KPI(참여율) 조기 측정, 미달 시 인센티브·홍보 강화. 풀 규모를 작게 시작 |
| BR-3 | **담합·가격 조작** — 고연차 집단이 입찰가를 의도적으로 낮게 유지 | 낮음 | 중 | 최소 시작가 설정(OP-6), 낙찰가 통계 모니터링. 이상 패턴 시 관리자 알림 |
| BR-4 | **베타 풀 규모 부족** — 소수 지원자만으로는 경매 자체가 성립 안 함 | 중 | 중 | 베타 지원자 모집 시 최소 인원 기준 설정, 미달 시 부서 단위로 전환 |
| BR-5 | **노조·직원 반발** — 휴식권을 시장 논리로 다룬다는 정서적 거부감 | 낮음 | 높음 | 근로기준법 준수 구조([ADR-001](../04_decisions/ADR-001-escrow-model.md)) 명확히 커뮤니케이션, 베타 피드백 수렴 |
| BR-6 | **KPI 측정 불가** — baseline·설문 미준비로 성공 여부 판단 불가 | 중 | 중 | 도입 전 직전 연도 소멸 연차 baseline 측정, 만족도 설문 문항 사전 설계 ([business-rules](../02_requirements/business-rules.md) §4) |

---

## 6. 롤아웃 전략

**채택: 베타 (소수 지원자) → 단계적 확대**

| 단계 | 대상 | 목표 | 게이트 (다음 단계 조건) |
|---|---|---|---|
| **베타** | 자발적 지원자 (부서 무관, 최소 인원 기준 충족 시) | 정합성·UX 검증, 초기 KPI 측정 | 에스크로 정합성 사고 0건 + 만족도 설문 통과 |
| **파일럿 확대** | 1~2개 부서 전체 | 부서 단위 풀 규모에서의 동작 검증 | 참여율·유찰률 목표 달성 |
| **전사** | 전 직원 | 정식 운영 | 파일럿 KPI 충족 + 노조·법무 최종 확인 |

- 베타 전 **baseline 측정 필수** — 직전 연도 `REGULAR` 소멸 연차 집계 ([business-rules](../02_requirements/business-rules.md) §4)
- 각 단계 종료 시 만족도 설문 + KPI 리뷰
- 금융급 무결성 요구([handover](../05_handover/handover.md))상 "전사 일괄"은 배제 — 정합성 버그가 전사 재무 사고로 직결되는 고위험

---

## 7. 진행 관리 방식

- **주간 동기화**: 매주 월요일 30분 짧은 스탠드업 (온/오프 무관)
- **GitHub Issues**로 WBS 항목 추적
- **GitHub Projects** 칸반 보드 (`Backlog` / `In Progress` / `Review` / `Done`)
- **PR 기반 커뮤니케이션**: 모든 기술 논의는 PR 코멘트 우선

---

## TODO

- [ ] 실제 팀원 가용시간 기반 주차별 상세 Task 재조정
- [ ] GitHub Issues에 Task 등록
- [ ] 간트차트 도구 선택 (GitHub Projects 또는 외부)
- [ ] 리스크 R2~R8 · BR-1~BR-6 대응 담당자 지정
- [ ] 베타 지원자 모집 최소 인원 기준 확정

## 관련 문서
- [roles.md](roles.md)
- [business-rules.md](../02_requirements/business-rules.md) — 운영 파라미터·KPI
- [edge-cases.md](../02_requirements/edge-cases.md) — 엣지 케이스 카탈로그
- [handover.md § 5 Action Item](../05_handover/handover.md#5-인수인계자-action-item-향후-마일스톤)
