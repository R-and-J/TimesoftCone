# 기술 스택 결정서 (Tech Radar)

**상태**: ✅ 확정 — 구현으로 정착 (2026-06-12 코드 기준 갱신)
**결정자**: 타임소프트콘 (김기철, 오지석)

> 이 문서는 원래 "선택지 제시" 단계의 레이더였으나, 실제 구현이 스택을 확정했다.
> 아래 §2의 후보 비교는 *의사결정 근거*로 보존하고, §3을 **As-Built(실제 구축)** 표로 갱신했다.
> 코드가 진실의 원천(`backend/`, `frontend/`) — 충돌 시 코드를 따른다.

---

## 1. 결정 체크리스트 (전부 확정)

- [x] 백엔드 언어/프레임워크 → **NestJS (TypeScript, Node 20)**
- [x] 프론트엔드 프레임워크 → **React 18 + Vite 5 + TypeScript**
- [x] DB 제품/버전 → **SQLite (파일 기반, Prisma provider=sqlite)** (2026-05-26 MySQL→SQLite 전환)
- [x] 메시지 큐 제품 → **별도 MQ 미도입.** in-process 이벤트버스(`@nestjs/event-emitter`) + `outbox` 테이블(현재 dormant, 외부 연동 시 가동) — ADR-013/016
- [x] 컨테이너화 여부 → **불필요** (SQLite 파일 DB라 DB 컨테이너 0; Docker compose 미사용)
- [x] 배포 환경 → 학교 프로젝트 스코프: 로컬 단일 인스턴스(`backend` :3002 / `frontend` :5173)
- [x] CI/CD 도구 → 학교 프로젝트 스코프 외 (미구성)

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
| **SQLite** | ✅ **채택** | 파일 기반·외부 서버 0. 데모/MVP 단순화(2026-05-26). Prisma provider=sqlite. enum은 TEXT+CHECK로. |
| PostgreSQL 16 | 과거 권장(미채택) | 운영 확장 시 후보 |
| MySQL 8 | 과거 실제 사용(미채택) | 원격 서버 의존 제거 위해 SQLite로 전환 |

### 2.4 동시성 제어 (분산 락)

**SQLite write 락(`lockAuction` no-op UPDATE) 채택** — 단일 인스턴스 + SQLite 전역 직렬화라 별도 락 인프라 불필요 (scope-cuts CUT-1). Redis 미사용.

### 2.5 메시지 큐 (ADR-005 Outbox 채택 시)

| 후보 | 장점 | 단점 |
|---|---|---|
| **RabbitMQ** | 가볍고 설치 용이 | 처리량 한계 |
| **Kafka** | 대용량 / 순서 보장 | 운영 복잡 |
| **SQS (AWS)** | 매니지드 | AWS 종속 |
| **SQLite Outbox 테이블** | 별도 인프라 불필요 | 폴링 오버헤드 |

> **권장 (학교 프로젝트)**: **SQLite Outbox 테이블** — 인프라 단순화, 학습 부담 최소

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

## 3. As-Built 최종 스택 (실제 구축)

| 영역 | 선택 | 버전/비고 |
|---|---|---|
| **백엔드** | NestJS | Node 20 LTS |
| 언어 | TypeScript | 5.x |
| **ORM** | **Prisma** | `@prisma/client` ^5.22 (TypeORM 미채택) |
| **프론트** | React + Vite | React 18, Vite 5 |
| UI 라이브러리 | **Tailwind CSS + lucide-react** | Tailwind ^3.4 (Mantine/MUI 둘 다 미채택) |
| **DB** | SQLite | 파일 기반(`prisma/dev.db`), provider=sqlite |
| **동시성 제어** | SQLite write 락(`lockAuction` no-op UPDATE) | CUT-1, Redis 미사용 |
| **실시간** | **SSE (NestJS `@Sse`)** | `AuctionStream`/`NotificationStream` (Socket.IO/WebSocket 미채택, CUT-6 대체) |
| **MQ/Outbox** | in-process 이벤트버스 + `outbox` 테이블(dormant) | `@nestjs/event-emitter`; Kafka 미도입 |
| **인증** | JWT(`@nestjs/jwt`) + bcrypt, ezpass 위임/local 모드 | ADR-019~022 |
| **컨테이너/오케스트레이션** | 미사용 | SQLite라 DB 컨테이너 불필요 |
| **CI/CD / 모니터링** | 미구성 | 학교 프로젝트 스코프 외 |
| **테스트** | Jest (단위 + e2e) | Playwright/k6 미도입 |

> ℹ️ `mysql2`는 **여전히 쓰인다**(제거 금지). 우리 Prisma는 sqlite지만, 사내 ezpass/msaportal **MySQL DB를 직접 읽어야** 하는 어댑터(`adapters/hr/ezpass-hr-leave.client.ts`, `adapters/directory/msaportal-member-directory.adapter.ts`, `prisma/seed.ts`, `scripts/*`)가 `mysql2/promise`를 사용. 다만 런타임 의존인데 `devDependencies`에 있어 **분류상으로는 `dependencies`로 옮기는 게 맞다**(기능엔 영향 없음).

---

## 4. 대체안 (Spring 기반)

트랜잭션 복잡도와 엔터프라이즈 패턴을 우선시할 경우:

| 영역 | 선택 |
|---|---|
| 백엔드 | Spring Boot 3.x (Kotlin) |
| ORM | Spring Data JPA + QueryDSL |
| 동시성 | DB write 락(SQLite) |
| 나머지 | 위와 동일 |

---

## 5. 버전 핀 (결정 후 업데이트)

```yaml
# TODO: 실제 설치·고정 시 업데이트
node: 20.11.x
typescript: 5.3.x
# DB: SQLite (파일 기반, 별도 서버 버전 핀 불필요 — Prisma provider=sqlite)
```

---

## TODO (정리)

- [x] ~~NestJS vs Spring Boot 최종 투표~~ → **NestJS 채택** (코드로 정착)
- [x] ~~프론트 UI 라이브러리 선정~~ → **Tailwind CSS + lucide-react** 채택
- [x] ~~Docker Compose YAML 초안 작성~~ → SQLite 전환으로 **불필요**(DB 컨테이너 0)
- [ ] (선택) `mysql2`를 `devDependencies` → `dependencies`로 분류 정정 (런타임 사용 중이라 제거는 불가)
- [ ] (선택) `backend/.env.example`의 죽은 `LEAVEPOOL_WEEKLY_QTY` 줄 정리 (코드가 읽지 않음 — 실제 분산은 `release_policy` 테이블)
- [ ] (선택) 런타임 버전 락 파일(`.nvmrc`) 준비 — 학교 프로젝트 스코프상 낮은 우선순위

## 관련 문서
- [architecture.md](../03_design/architecture.md)
- [dev-setup.md](dev-setup.md)
- [ADR-005](../04_decisions/ADR-005-hr-api-timing.md)
- [ADR-006](../04_decisions/ADR-006-redis-lock.md) (Superseded — CUT-1)
