# 시스템 아키텍처

**상태**: 🟡 초안 (기술 스택 확정 후 보완 필요)
**관련 문서**: [SRS 2.1 제품 관점](../02_requirements/SRS.md#21-제품-관점) / [tech-stack.md](../06_tech/tech-stack.md)

---

## 1. 논리 아키텍처 (Logical Architecture)

```
┌───────────────────────────────────────────────────────────────────┐
│                        클라이언트 (Client)                          │
│   ┌─────────────────┐   ┌─────────────────┐   ┌────────────────┐  │
│   │  직원 웹 UI      │   │  관리자 UI       │   │ 모바일(선택)    │  │
│   └────────┬────────┘   └────────┬────────┘   └───────┬────────┘  │
└────────────┼──────────────────────┼────────────────────┼──────────┘
             │ HTTPS / WebSocket    │                    │
┌────────────▼──────────────────────▼────────────────────▼──────────┐
│                    API Gateway / Load Balancer                     │
└────────────┬───────────────────────────────────────────────────────┘
             │
┌────────────▼──────────────────────────────────────────────────────┐
│                   애플리케이션 계층 (MSA)                           │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────────────┐     │
│  │ AuthService  │  │AuctionService│  │  DividendService     │     │
│  │  (SSO)       │  │ (입찰/낙찰)   │  │  (연말 배당)          │     │
│  └──────┬───────┘  └──────┬───────┘  └──────────┬───────────┘     │
│         │                 │                     │                 │
│  ┌──────┴─────────────────┴─────────────────────┴──────────┐     │
│  │        공통: 인증 미들웨어 / 로깅 / 메트릭                 │     │
│  └──────────────────────────────────────────────────────────┘     │
└──────┬─────────────────┬──────────────────┬──────────────────────┘
       │                 │                  │
       │                 │                  │
┌──────▼─────┐   ┌───────▼──────┐   ┌──────▼─────────┐   ┌────────────┐
│ PostgreSQL │   │ Redis         │   │ Message Queue  │   │ 외부: HR    │
│  (원장 DB)  │   │ (분산 락 +    │   │ (HR 재시도 큐)  │   │  시스템 API │
│            │   │  실시간 상태)  │   │                │   │            │
└────────────┘   └──────────────┘   └────────────────┘   └────────────┘
```

## 2. 컴포넌트 책임

| 컴포넌트 | 책임 | 핵심 관심사 |
|---|---|---|
| **AuthService** | SSO 인증 / 세션 / 권한 | HR IdP 연동, JWT 발급 |
| **AuctionService** | 경매 목록·입찰·낙찰·실시간 알림 | Redis 분산 락, WebSocket |
| **DividendService** | 지분 계산·연말 배당·배치 | 에스크로 정합성 검증 |
| **AdminService** | 유찰 재고 수동 지급·모니터링 | 감사 로그 접근 |
| **PostgreSQL** | 영구 저장소 (User / Auction / LeaveBalance / Log) | 트랜잭션 무결성, Insert-Only 트리거 |
| **Redis** | 분산 락 + 실시간 최고가 캐시 | TTL 기반 락 해제, Pub/Sub |
| **Message Queue** | HR API 장애 시 재시도 큐 | At-least-once 발행 |

## 3. 배포 아키텍처 (Deployment)

> **🟡 TODO**: 실제 인프라 결정 후 확정

### 후보 구성

**Option A — 매니지드 클라우드 (권장)**

```
[Cloudfront / CloudFlare] → [ALB] → [ECS / Cloud Run + Auto Scaling]
                                      ↓
                              [Aurora PG] + [ElastiCache Redis] + [SQS]
```

**Option B — 온프레미스 K8s**

```
[Ingress] → [K8s Pods (Deployment)] → [StatefulSet: PG / Redis]
                                      ↓
                                   [RabbitMQ]
```

사용자 관심사(Jenkins/Docker/K8s)를 고려하면 **B안의 K8s 기반이 학습·포트폴리오 측면에서 유리**.

## 4. 데이터 흐름 (Data Flow)

### 4.1 입찰 → 낙찰 → HR 연동 (핵심 시나리오)

UML 순차 다이어그램 참조: [UML.md](UML.md#-순차-다이어그램-sequence-diagram)

### 4.2 연말 배치 (배당금 지급)

```
[스케줄러: 12/31 23:59]
  ├─ 1단계: REGULAR 미사용 연차 → 내년 경매 매물 생성 (FR-1.1)
  ├─ 2단계: 기여자 지분(Stake) 계산 및 저장
  ├─ 3단계: 에스크로 총액 = Σ(낙찰 포인트) 검증
  ├─ 4단계: Stake 비율에 따라 배당금 산정
  ├─ 5단계: HR API /welfare 호출 (복지카드 한도 증액)
  └─ 6단계: AUCTION/EVENT 이전 연도 Soft Delete
```

## 5. 횡단 관심사 (Cross-cutting Concerns)

### 5.1 보안

- **인증**: SSO (사내 IdP) → JWT
- **권한 (RBAC)**: `EMPLOYEE` / `ADMIN` 분리. 관리자 API는 별도 라우터 격리
- **통신 암호화**: 전구간 TLS 1.2+
- **감사 로그**: `POINT_TRANSACTION_LOG` Insert-Only로 불변 보관

### 5.2 관측성 (Observability)

- **메트릭**: Prometheus + Grafana (에스크로 잔고 실시간 대시보드)
- **로그**: 구조화 로깅(JSON) → ELK or Loki
- **트레이싱**: OpenTelemetry (경매 낙찰 흐름 추적)
- **알림**: Slack Webhook — Critical 트랜잭션 실패 즉시 통지 (FR-2.2)

### 5.3 동시성 (Concurrency)

- Redis 분산 락: `LOCK auction:{id}` TTL 5초
- 실패 시 `lock_acquired: false` 리턴 → 클라이언트 즉시 에러 표시
- 자세한 근거: [ADR-006](../04_decisions/ADR-006-redis-lock.md)

### 5.4 장애 대응

- HR API 5xx/Timeout → Message Queue 적재 후 지수 백오프 재시도
- DB 트랜잭션 실패 → 즉시 롤백 + Slack Critical 알림
- **⚠️ 미해결**: HR 200 OK 후 DB COMMIT 실패 시 보상 로직 — [ADR-005](../04_decisions/ADR-005-hr-api-timing.md)에서 결정 필요

## 6. 확장성 고려

- **수평 확장**: AuctionService는 stateless → Pod 증설로 입찰 TPS 확장
- **병목 지점**: Redis 단일 노드. Replica 구성 필요 시 Redis Sentinel 또는 Cluster
- **DB 파티셔닝**: `LEAVE_BALANCE.year` 기준 파티셔닝 ([ADR-004](../04_decisions/ADR-004-year-partitioning.md))

---

## TODO

- [ ] 실제 배포 옵션 확정 (A vs B)
- [ ] AuctionService 인스턴스 수 산정 (예상 동시 접속 수 기반)
- [ ] DR(재해복구) 전략 — 에스크로 DB 이중화
- [ ] 보안 점검 체크리스트 별도 문서화
