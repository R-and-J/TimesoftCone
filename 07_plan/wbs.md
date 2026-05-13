# WBS 및 일정 계획

**상태**: ⚪ TODO — 팀 확정 필요
**기준일**: 2026-04-23

---

## 1. 전체 일정 개괄

| Phase | 기간 | 목표 | 산출물 |
|---|---|---|---|
| **0. 설계 마감** | Week 0 (1주) | 미결 ADR 해소, 기술스택 확정 | ADR-005 Accepted, tech-stack 확정 |
| **1. 인프라 준비** | Week 1 (1주) | 개발환경, CI/CD 골격 | repo, docker-compose, Jenkinsfile |
| **2. 도메인 모델** | Week 2~3 (2주) | 엔티티/DB/기본 CRUD | User/Auction/LeaveBalance 모델 |
| **3. 경매 핵심** | Week 4~5 (2주) | 입찰·낙찰·Redis 락 | AuctionService, WebSocket |
| **4. HR 연동** | Week 6 (1주) | Outbox Worker, HR API 클라이언트 | ADR-005 구현 |
| **5. 배치·배당** | Week 7 (1주) | 12/31 연말 배치 | 배치 스케줄러 |
| **6. 프론트엔드** | Week 4~7 (4주, 병렬) | React UI, 실시간 입찰 화면 | 핵심 5개 화면 |
| **7. 통합·QA** | Week 8 (1주) | E2E 테스트, 부하 테스트 | 테스트 리포트 |
| **8. 발표 준비** | Week 9 (1주) | 발표자료, 시연 | PPT, 데모 영상 |

---

## 2. 마일스톤 (Milestones)

| 마일스톤 | 목표일 | 판단 기준 |
|---|---|---|
| M1: 설계 완료 | Week 0 End | ADR-005~009 모두 Accepted |
| M2: 개발 착수 준비 | Week 1 End | docker-compose up → API Hello World 확인 |
| M3: MVP 백엔드 | Week 5 End | 입찰·낙찰 흐름이 통합 테스트에서 통과 |
| M4: HR 연동 검증 | Week 6 End | Outbox Worker가 mock HR 서버에 재시도 성공 |
| M5: 연말 배치 시연 | Week 7 End | 시뮬레이션 데이터로 배당 완료 |
| M6: 통합 릴리즈 | Week 8 End | v1.0.0 태그 생성 |
| M7: 발표 | Week 9 End | 최종 제출 |

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

3. 백엔드 개발
  3.1 인증 (SSO + JWT)
  3.2 User / Point 도메인
  3.3 LeaveBalance 도메인
  3.4 Auction 도메인
    3.4.1 경매 조회 API
    3.4.2 입찰 API (Redis 락)
    3.4.3 낙찰 배치 (경매 마감 처리)
  3.5 HR 연동 (Outbox Worker)
  3.6 Dividend 도메인 (연말 배치)
  3.7 Admin API (유찰 재고)
  3.8 WebSocket 실시간 알림

4. 프론트엔드 개발
  4.1 SSO 로그인 플로우
  4.2 경매 목록 / 상세
  4.3 실시간 입찰 화면 (WebSocket)
  4.4 내 포인트 / 배당 대시보드
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

### Week 1 (Apr 24 ~ Apr 30)

| 담당 | Task | 산출물 |
|---|---|---|
| 김기철 | Repo 초기화 + Jenkins 파이프라인 초안 | `.github/`, Jenkinsfile |
| 오지석 | docker-compose 기동 확인 | docker-compose.yml |
| 공동 | ADR-005 결정 회의 | ADR-005 Accepted |

### Week 2 (May 1 ~ May 7)

| 담당 | Task | 산출물 |
|---|---|---|
| 김기철 | User / SSO 인증 | `/auth/*` API |
| 오지석 | LeaveBalance 모델 + 마이그레이션 | DB 테이블 + 테스트 |

(이하 매주 업데이트)

---

## 5. 리스크 대장

| ID | 리스크 | 발생 가능성 | 영향 | 대응 계획 |
|---|---|---|---|---|
| R1 | ADR-005 결정 지연 | 중 | 높음 | 2인 회의 즉시 소집, 외부 레퍼런스 검토 |
| R2 | HR API Mock 환경 부재 | 높음 | 중 | WireMock 기반 Mock HR 서버 구축 |
| R3 | Redis 분산 락 동시성 버그 | 중 | 높음 | k6 부하 테스트 조기 수행 |
| R4 | 프론트-백 API 스펙 불일치 | 중 | 중 | OpenAPI 기반 codegen 도입 |
| R5 | 2인 팀 병가/휴가로 병목 | 중 | 높음 | PR 크로스 리뷰 + 문서화 강화 |
| R6 | 일학습병행제 업무 일정과 충돌 | 높음 | 중 | 주간 가용 시간 사전 공유 |

---

## 6. 진행 관리 방식

- **주간 동기화**: 매주 월요일 30분 짧은 스탠드업 (온/오프 무관)
- **GitHub Issues**로 WBS 항목 추적
- **GitHub Projects** 칸반 보드 (`Backlog` / `In Progress` / `Review` / `Done`)
- **PR 기반 커뮤니케이션**: 모든 기술 논의는 PR 코멘트 우선

---

## TODO

- [ ] 실제 팀원 가용시간 기반 주차별 상세 Task 재조정
- [ ] GitHub Issues에 Task 등록
- [ ] 간트차트 도구 선택 (GitHub Projects 또는 외부)
- [ ] 리스크 R1~R6 대응 담당자 지정

## 관련 문서
- [roles.md](roles.md)
- [handover.md § 5 Action Item](../05_handover/handover.md#5-인수인계자-action-item-향후-마일스톤)
