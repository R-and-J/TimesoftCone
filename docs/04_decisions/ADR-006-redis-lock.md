# ADR-006: Redis 분산 락 선택 (vs PostgreSQL Advisory Lock)

> **상태**: ⛔ Superseded — [scope-cuts.md CUT-1](../06_tech/scope-cuts.md)으로 대체. 입찰 동시성은 SQLite write 락(`lockAuction`의 no-op UPDATE)으로 처리하며 Redis는 프로젝트에서 영구 제거됨(2026-05-26). 아래 내용은 역사적 기록으로 보존.

- **상태**: ⛔ Superseded (← 🟡 Proposed)
- **결정일**: _미결_
- **결정자**: 타임소프트콘

## 컨텍스트

[NFR-1]에 따라 동시 입찰 Race Condition을 제어해야 한다. 다수 서버 인스턴스에서 동일 경매(`auction:{id}`)에 대한 입찰을 직렬화할 필요가 있다.

## 후보 옵션

### 옵션 A — Redis 분산 락 (Redisson / ioredis 기반)

```redis
SET auction:lock:101 <session_id> NX PX 5000
```

### 옵션 B — PostgreSQL Advisory Lock

```sql
SELECT pg_advisory_xact_lock(101);
-- 트랜잭션 내에서만 유효, 커밋/롤백 시 자동 해제
```

### 옵션 C — DB row lock (`SELECT ... FOR UPDATE`)

AUCTION 행을 직접 FOR UPDATE 걸기.

## 비교

| 기준 | Redis Lock | PG Advisory | Row FOR UPDATE |
|---|---|---|---|
| 성능 (TPS) | 매우 높음 (~10만) | 높음 | 중간 (DB 병목) |
| 락 해제 누수 | TTL로 자동 해제 | 트랜잭션 종료 시 자동 | 트랜잭션 종료 시 자동 |
| 별도 인프라 | Redis 필요 | **불필요** | 불필요 |
| 멀티 DC 대응 | Redis Cluster | PG 복제 따라감 | 동일 |
| 데드락 리스크 | 낮음 (TTL) | 낮음 | **높음** (여러 행 락 시) |
| 구현 난이도 | 중간 (라이브러리) | 낮음 | 낮음 |
| SRS 반영 상태 | ✅ NFR-1에 명시 | — | — |

## 회피한 리스크

💣 **DB 단일 락만 의존 시**:
- 경매 마감 직전 수백 명 동시 입찰 → DB 커넥션 풀 고갈
- Row FOR UPDATE 대기 중인 트랜잭션이 쌓여 **타임아웃 도미노** 발생
- 다른 도메인(배당 배치 등)도 영향받는 **시스템 전역 병목**

## 권장 결정

**옵션 A (Redis 분산 락)** — SRS NFR-1에 이미 명시되어 있고, 입찰 API는 짧고 독립적이어서 Redis 락 패턴에 적합.

### 구현 상세 (예정)

```python
# 의사 코드
lock_key = f"auction:lock:{auction_id}"
session_id = uuid4()

acquired = redis.set(lock_key, session_id, nx=True, px=5000)
if not acquired:
    raise LockConflictError("LOCK_CONFLICT")

try:
    # 입찰 처리 로직
    with db.transaction():
        ...
finally:
    # Lua 스크립트로 atomic 해제 (본인 락만 해제)
    redis.eval("""
        if redis.call('get', KEYS[1]) == ARGV[1] then
            return redis.call('del', KEYS[1])
        else return 0 end
    """, 1, lock_key, session_id)
```

### 라이브러리 후보
- **Spring Boot**: Redisson `RLock` (Redlock 알고리즘 지원)
- **Node/NestJS**: ioredis + `redlock` 패키지

## 결과 및 트레이드오프

### ✅ 긍정적 결과
- 입찰 TPS 수평 확장 가능
- DB 커넥션 풀 보호
- TTL 기반 자동 해제로 장애 복원력 확보

### ⚠️ 트레이드오프
- **Redis 단일 장애점** → Sentinel 또는 Cluster 구성 권장
- **TTL 튜닝** 필요 (너무 짧으면 긴 트랜잭션 중 해제, 너무 길면 장애 시 정체)
- **네트워크 RTT** 추가 (입찰당 Redis 왕복)

### 🛡️ 제약
- 락 키는 반드시 `auction:lock:{id}` 네임스페이스 사용
- Lua 스크립트 기반 해제 (본인 락만 해제 보장)
- **Redis 장애 시 fallback 없음** → 대안: 장애 시 입찰 API 전체 `503` 리턴 (부분 작동보다 안전)

## 관련 문서
- [SRS NFR-1](../02_requirements/SRS.md#nfr-1-동시성-제어-concurrency)
- [UML 순차 2-3단계](../03_design/UML.md#-순차-다이어그램-sequence-diagram)
- [아키텍처 5.3 동시성](../03_design/architecture.md#53-동시성-concurrency)
