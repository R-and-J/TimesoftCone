# 기술 스택 결정서 (Tech Radar)

**상태**: 🟡 선택지 제시, 팀 확정 전
**결정자**: 타임소프트콘 (김기철, 오지석)

---

## 1. 결정 체크리스트

프로젝트 시작 전 반드시 확정해야 할 항목:

- [ ] 백엔드 언어/프레임워크
- [ ] 프론트엔드 프레임워크
- [ ] DB 제품/버전
- [ ] Redis 버전 및 클라이언트 라이브러리
- [ ] 메시지 큐 제품 (ADR-005 결과에 따라 필요)
- [ ] 컨테이너화 여부 (Docker 기본 전제)
- [ ] 배포 환경 (K8s / ECS / Cloud Run / VM)
- [ ] CI/CD 도구

---

## 2. 권장 후보 (영역별)

### 2.1 백엔드

| 후보 | 장점 | 단점 | 적합도 |
|---|---|---|---|
| **Spring Boot (Java/Kotlin)** | 트랜잭션 관리 강력, Redisson 잘 지원, 엔터프라이즈 표준 | 러닝 커브, 빌드 시간 | ⭐⭐⭐⭐⭐ |
| **NestJS (TypeScript)** | 사용자 JS 관심사와 부합, 개발 속도 빠름 | 엔터프라이즈 트랜잭션 패턴 덜 성숙 | ⭐⭐⭐⭐ |
| **Django (Python)** | ORM 강력, 관리자 UI 무료 제공 | 동시성/비동기 모델 약함 | ⭐⭐⭐ |

> **권장**: 사용자의 JavaScript 관심사 + 2인 팀 개발 속도 관점에서 **NestJS** 선호.
> 단, 트랜잭션 복잡도(ADR-005) 고려 시 **Spring Boot**가 더 안전.

### 2.2 프론트엔드

| 후보 | 장점 | 단점 |
|---|---|---|
| **React + Vite** | 생태계 풍부, TypeScript 친화 | 상태관리 결정 필요 |
| **Next.js** | SSR/라우팅 통합 | 학교 프로젝트엔 과할 수 있음 |
| **Vue 3** | 진입 장벽 낮음 | HR 테마 디자인 라이브러리 빈약 |

> **권장**: React + Vite + TypeScript (SSR 불필요, 내부 툴 성격)

### 2.3 데이터베이스

| 후보 | 결정 | 근거 |
|---|---|---|
| **PostgreSQL 16** | ✅ **권장** | SRS 3.4에서 명시 권장. 파티셔닝·JSON·트리거 모두 강력. |
| MySQL 8 | 대안 | 가능하지만 파티셔닝·CHECK 제약이 PG보다 약함 |
| Oracle/MSSQL | 비권장 | 라이선스 부담 |

### 2.4 분산 락 / 캐시

| 후보 | 결정 | 근거 |
|---|---|---|
| **Redis 7.x** | ✅ **권장** | SRS NFR-1, ADR-006. Lua 스크립트 지원. |
| 클라이언트 | **Redisson (Java)** 또는 **ioredis + redlock (Node)** | |

### 2.5 메시지 큐 (ADR-005 Outbox 채택 시)

| 후보 | 장점 | 단점 |
|---|---|---|
| **RabbitMQ** | 가볍고 설치 용이 | 처리량 한계 |
| **Kafka** | 대용량 / 순서 보장 | 운영 복잡 |
| **SQS (AWS)** | 매니지드 | AWS 종속 |
| **PostgreSQL Outbox 테이블** | 별도 인프라 불필요 | 폴링 오버헤드 |

> **권장 (학교 프로젝트)**: **PostgreSQL Outbox 테이블** — 인프라 단순화, 학습 부담 최소

### 2.6 컨테이너 / 오케스트레이션

| 후보 | 결정 | 근거 |
|---|---|---|
| **Docker + docker-compose (개발)** | ✅ 필수 | 환경 일관성 |
| **Kubernetes (K3s or Minikube)** | ✅ 권장 (포트폴리오 관점) | 사용자 인프라 관심사 부합 |
| 단순 VM 배포 | 대안 | 학습 효과 낮음 |

### 2.7 CI/CD

| 후보 | 결정 | 근거 |
|---|---|---|
| **GitHub Actions** | ✅ 기본 후보 | 무료, 연동 간편 |
| **Jenkins** | ✅ 학습 목적 권장 | 사용자 관심사 (Jenkins/Docker/K8s) |
| GitLab CI | 대안 | |

> **권장**: Jenkins + Docker 조합으로 구성 (사용자 학습 목표 달성 + 기업형 파이프라인 경험)

---

## 3. 권장 최종 스택 (제안)

| 영역 | 선택 | 버전 |
|---|---|---|
| **백엔드** | NestJS | Node 20 LTS |
| 언어 | TypeScript | 5.x |
| **ORM** | Prisma or TypeORM | |
| **프론트** | React + Vite | React 18, Vite 5 |
| UI 라이브러리 | Mantine or MUI | |
| **DB** | PostgreSQL | 16 |
| **캐시/락** | Redis | 7.2 |
| Redis 클라이언트 | ioredis + redlock | |
| **실시간** | Socket.IO | |
| **MQ/Outbox** | PostgreSQL Outbox 테이블 (Phase 1), Kafka (Phase 2) | |
| **컨테이너** | Docker | |
| **오케스트레이션** | Docker Compose (개발) / K8s (운영 선택) | |
| **CI/CD** | Jenkins + Docker Registry | |
| **모니터링** | Prometheus + Grafana + Loki | |
| **테스트** | Jest (단위), Playwright (E2E), k6 (부하) | |

---

## 4. 대체안 (Spring 기반)

트랜잭션 복잡도와 엔터프라이즈 패턴을 우선시할 경우:

| 영역 | 선택 |
|---|---|
| 백엔드 | Spring Boot 3.x (Kotlin) |
| ORM | Spring Data JPA + QueryDSL |
| Redis | Redisson |
| 나머지 | 위와 동일 |

---

## 5. 버전 핀 (결정 후 업데이트)

```yaml
# TODO: 실제 설치·고정 시 업데이트
node: 20.11.x
typescript: 5.3.x
postgres: 16.2
redis: 7.2.4
```

---

## TODO

- [ ] NestJS vs Spring Boot 최종 투표
- [ ] 프론트 UI 라이브러리 선정
- [ ] Docker Compose YAML 초안 작성
- [ ] `.nvmrc` / `.tool-versions` 같은 런타임 버전 락 파일 준비

## 관련 문서
- [architecture.md](../03_design/architecture.md)
- [dev-setup.md](dev-setup.md)
- [ADR-005](../04_decisions/ADR-005-hr-api-timing.md)
- [ADR-006](../04_decisions/ADR-006-redis-lock.md)
