# API 명세서 (Narrative Summary)

**상태**: ✅ v3 — narrative 요약. **정식 spec은 [openapi.yaml](openapi.yaml)** (OpenAPI 3.0.3)
**관련 문서**: [openapi.yaml](openapi.yaml) · [acceptance-criteria.md](../02_requirements/acceptance-criteria.md) · [permission-matrix.md](../02_requirements/permission-matrix.md) · [SRS 3.1](../02_requirements/SRS.md#31-외부-인터페이스-요구사항) · [UML 순차](UML.md#-순차-다이어그램-sequence-diagram)

> 본 문서는 *사람이 읽기 쉬운 요약*이다. 실제 구현·codegen·테스트의 기준은 [openapi.yaml](openapi.yaml). 둘 사이 충돌 시 openapi.yaml이 우선한다.

---

## 1. 공통 규약

### 1.1 베이스 URL

```
https://auction.company.internal/api/v1
```

### 1.2 인증

- **방식**: Bearer Token (JWT) — SSO 로그인 후 발급
- **헤더**: `Authorization: Bearer <token>`
- **만료**: Access 1h / Refresh 7d

### 1.3 공통 응답 포맷

```json
{
  "success": true,
  "data": { ... },
  "error": null,
  "timestamp": "2026-04-23T10:00:00+09:00"
}
```

실패 시:

```json
{
  "success": false,
  "data": null,
  "error": {
    "code": "POINT_INSUFFICIENT",
    "message": "잔여 콘이 입찰액보다 부족합니다.",
    "details": { "current": 500, "required": 1000 }
  },
  "timestamp": "..."
}
```

### 1.4 에러 코드 표준

| Code | HTTP | 설명 |
|---|---|---|
| `UNAUTHORIZED` | 401 | 토큰 없음/만료 |
| `FORBIDDEN` | 403 | 권한 부족 (관리자 API 등) |
| `NOT_FOUND` | 404 | 리소스 없음 |
| `POINT_INSUFFICIENT` | 400 | 콘 부족 (wallet 잔액 < 입찰액) |
| `BID_TOO_LOW` | 400 | 현재 최고가보다 낮거나 같음 |
| `INVALID_STATE_TRANSITION` | 409 | 허용되지 않는 경매 상태 전이 (ADR-014) |
| `AUCTION_CLOSED` | 409 | 마감된 경매에 입찰 시도 |
| `REASON_REQUIRED` | 400 | 관리자 적립 시 사유 누락 (FR-5.1) |
| `HR_API_TIMEOUT` | 502 | HR API 응답 지연 (Outbox 재시도 처리 중) |
| `ESCROW_MISMATCH` | 500 | 에스크로 정합성 오류 (Critical) |

---

## 2. 인증 API

### 2.1 SSO 로그인 콜백

```
GET /auth/sso/callback?code=<sso_code>
```

**Response**
```json
{
  "data": {
    "accessToken": "eyJ...",
    "refreshToken": "eyJ...",
    "user": { "empId": "E12345", "name": "김기철", "role": "EMPLOYEE" }
  }
}
```

### 2.2 토큰 갱신

```
POST /auth/refresh
Body: { "refreshToken": "..." }
```

---

## 3. 사용자 / 지갑 API

### 3.1 내 지갑 잔액 조회 (FR-5.2)

```
GET /users/me/wallet?currency=WELFARE_POINT
```

**Response**
```json
{
  "data": {
    "currency": "WELFARE_POINT",
    "balance": 50000
  }
}
```

> 입찰 시 콘은 **홀드 없이 즉시 차감**되므로([ADR-009](../04_decisions/ADR-009-point-reuse.md) §6), 별도의 `heldInBids` 개념은 없다. `balance`가 곧 입찰 가능 잔액.

### 3.1a 내 거래 내역 조회 (FR-5.2)

```
GET /users/me/ledger?currency=WELFARE_POINT&actionType=&from=&to=&page=1
```

**Response**
```json
{
  "data": {
    "items": [
      { "actionType": "BID",          "amount": -9000,  "auctionId": 101, "createdAt": "..." },
      { "actionType": "REFUND",       "amount":  9000,  "auctionId": 101, "createdAt": "..." },
      { "actionType": "CREDIT_ADMIN", "amount":  50000, "reason": "2026 Q2 분기 지급", "createdAt": "..." }
    ],
    "total": 12, "page": 1
  }
}
```

### 3.2 내 연차 잔액 조회

```
GET /users/me/leave-balance?year=2026
```

**Response**
```json
{
  "data": [
    { "leaveType": "REGULAR", "allocated": 15, "used": 3, "remaining": 12 },
    { "leaveType": "AUCTION", "allocated": 2,  "used": 0, "remaining": 2 },
    { "leaveType": "EVENT",   "allocated": 1,  "used": 0, "remaining": 1 }
  ]
}
```

### 3.3 예상/확정 배당금 조회

```
GET /users/me/dividend?year=2026
```

**Response**
```json
{
  "data": {
    "year": 2026,
    "stakeRatio": 0.0342,
    "estimatedDividend": 17500,
    "finalDividend": null,
    "status": "PENDING"
  }
}
```

---

## 4. 경매 API

### 4.1 경매 목록 조회 (FR-2.1)

```
GET /auctions?status=OPEN&page=1&size=20
```

**Response**
```json
{
  "data": {
    "items": [
      {
        "id": 101,
        "status": "OPEN",
        "startTime": "2026-04-23T09:00:00+09:00",
        "endTime": "2026-04-23T18:00:00+09:00",
        "highestBid": 8000,
        "myCurrentBid": 7500,
        "timeRemainingSec": 3600
      }
    ],
    "total": 45,
    "page": 1,
    "size": 20
  }
}
```

### 4.2 경매 상세 조회

```
GET /auctions/{id}
```

### 4.3 입찰 제출 (FR-2.1) ⚠️ 핵심

```
POST /auctions/{id}/bids
Body:
{
  "amount": 9000
}
```

**흐름** (Hexagonal — ADR-012 / State 패턴 — ADR-014):
1. `UnitOfWork.lockAuction(id)` — SQLite write 락 (no-op `UPDATE`로 트랜잭션 write 락 선점)
2. `auction.placeBid(...)` — State 객체가 `OpenState`일 때만 허용, 최고가 비교
3. `BiddingCurrency.debit(...)` — wallet 잔액 검증 + 즉시 차감 (외부 호출 없음)
4. DB 트랜잭션: wallet 차감 + 최고가 갱신 + `LEDGER_ENTRY` INSERT
5. COMMIT 후 `EventBus.publish(BidPlacedEvent)` → WebSocket·메트릭 핸들러
6. 락 해제

**Response (성공)**
```json
{
  "data": {
    "auctionId": 101,
    "acceptedAmount": 9000,
    "newHighestBid": 9000
  }
}
```

**Response (실패 — 콘 부족)**
```json
{
  "success": false,
  "error": {
    "code": "POINT_INSUFFICIENT",
    "details": { "current": 5000, "required": 9000 }
  }
}
```

### 4.4 내 입찰 이력

```
GET /auctions/me/bids?page=1
```

---

## 5. 실시간 WebSocket

### 5.1 경매 채널 구독

```
WS /ws/auctions/{id}
```

**Server → Client 이벤트**:

```json
// 최고가 갱신
{
  "event": "BID_UPDATED",
  "data": { "auctionId": 101, "newHighestBid": 9500, "bidderId": 42 }
}

// 마감 임박 (5분 전)
{
  "event": "CLOSING_SOON",
  "data": { "auctionId": 101, "remainingSec": 300 }
}

// 낙찰 확정
{
  "event": "AWARDED",
  "data": { "auctionId": 101, "winnerId": 42, "finalBid": 10000 }
}
```

---

## 6. 관리자 API (RBAC: ADMIN 전용)

### 6.1 유찰 재고 수동 지급 (FR-4.2)

```
POST /admin/auctions/{id}/event-grant
Body:
{
  "empId": "E12345",
  "reason": "Q1 우수사원 포상"
}
```

### 6.2 직원 콘 적립 (FR-5.1) ✨ 신규

분기·이벤트 복지 콘을 직원 wallet에 적립. `LEDGER_ENTRY`에 `CREDIT_ADMIN`으로 기록.

```
POST /admin/wallet/credit
Body:
{
  "userId": 42,
  "currency": "WELFARE_POINT",
  "amount": 50000,
  "reason": "2026 Q2 분기 복지 콘 지급"
}
```

**Response (성공)**
```json
{
  "data": {
    "userId": 42,
    "currency": "WELFARE_POINT",
    "creditedAmount": 50000,
    "newBalance": 100000,
    "ledgerEntryId": 8821
  }
}
```

**제약**:
- `role != ADMIN` 호출 시 `403 FORBIDDEN`
- `reason` 누락·공백 시 `400 REASON_REQUIRED`
- 본 적립은 **에스크로와 무관** — `escrow_audit_view` 집계에서 제외 ([ADR-011](../04_decisions/ADR-011-welfare-point-ownership.md))

### 6.3 직원 지갑 조회 (FR-5.2 — 관리자용)

```
GET /admin/wallet?userId=42&currency=WELFARE_POINT
```

### 6.4 에스크로 현황 조회

```
GET /admin/escrow?year=2026&currency=WELFARE_POINT
```

**Response**
```json
{
  "data": {
    "year": 2026,
    "currency": "WELFARE_POINT",
    "balance": 4250000,
    "computedBalance": 4250000,
    "isConsistent": true,
    "totalBidCount": 487,
    "totalWinnerCount": 245
  }
}
```

> `balance`(캐시 테이블)와 `computedBalance`(`escrow_audit_view` 재계산)를 함께 반환하여 정합성을 항상 노출. 불일치 시 `isConsistent: false` + Slack Critical.

### 6.5 감사 로그 조회

```
GET /admin/ledger?userId=&auctionId=&currency=&actionType=&from=&to=
```

---

## 7. HR 시스템 연동 (Outbound — 본 시스템이 호출)

> 본 절의 호출은 모두 **Outbox 경유 비동기** ([ADR-005](../04_decisions/ADR-005-hr-api-timing.md)). 코어 도메인은 `HrClient` / `PayoutChannel` 포트에만 의존하며, 실제 호출은 어댑터(`RealHrClient` / `MockHrClient`)가 수행 ([ADR-012](../04_decisions/ADR-012-hexagonal-architecture.md)).

### 7.1 연차 권한 부여

```
POST {HR_BASE}/api/hr/leave
Headers: Authorization, X-Idempotency-Key
Body:
{
  "empId": "E12345",
  "amount": 1,
  "type": "AUCTION"
}
```

**Idempotency Key**: `auction-{auctionId}-winner-{userId}` — 중복 호출 방지 ([ADR-005](../04_decisions/ADR-005-hr-api-timing.md) 관련)

### 7.2 복지카드 한도 증액

```
POST {HR_BASE}/api/hr/welfare
Body:
{
  "empId": "E12345",
  "amount": 17500,
  "reason": "2026년 연차 경매 배당금"
}
```

> **입찰 결제와 무관**: 본 API는 *연말 배당 출금* 경로(`PayoutChannel`)에만 사용된다. 입찰 시 wallet 차감은 외부 호출 0건 ([ADR-011](../04_decisions/ADR-011-welfare-point-ownership.md)).

---

## 8. 배치 API (내부 스케줄러)

### 8.1 연말 정산 트리거

```
POST /internal/batch/year-end-settlement
(내부망 전용, X-Internal-Token 검증)
```

### 8.2 연말 배당 트리거

```
POST /internal/batch/dividend-distribution
```

---

## TODO

- [x] ~~OpenAPI 3.0 YAML로 정식화~~ ✅ `openapi.yaml` v0.1 완료
- [ ] Swagger UI 호스팅 설정 (dev-setup.md에서)
- [ ] 페이지네이션 규약 통일 (현재 offset+page, cursor 전환 검토)
- [ ] Rate Limiting 정책 (입찰 API 특히)
- [ ] API 버저닝 전략 (`/v1` 이후)
- [ ] WebSocket 채널 별도 명세 문서화 (`/ws/auctions/{id}`)
- [ ] HR API 실패 시 재시도 정책 문서화

---

## 관련 문서

- [SRS 3.1 외부 인터페이스](../02_requirements/SRS.md#31-외부-인터페이스-요구사항) · [SRS FR-5.x](../02_requirements/SRS.md#32-기능적-요구사항-명세표)
- [UML 순차 다이어그램](UML.md#-순차-다이어그램-sequence-diagram)
- [ADR-005 HR API 타이밍](../04_decisions/ADR-005-hr-api-timing.md)
- [ADR-010 통화 추상화](../04_decisions/ADR-010-currency-abstraction.md)
- [ADR-011 복지 콘 시스템 자체 보유](../04_decisions/ADR-011-welfare-point-ownership.md)
- [ADR-012 Hexagonal Architecture](../04_decisions/ADR-012-hexagonal-architecture.md)
- [ADR-014 Auction State 패턴](../04_decisions/ADR-014-auction-state-pattern.md)

## 개정 이력

| 버전 | 일자 | 변경 사항 |
|---|---|---|
| v1 | 2026-04-23 | 최초 초안 |
| v2 | 2026-05-14 | wallet 분리(§3), FR-5.1 관리자 적립·FR-5.2 잔액 조회 추가(§6), 입찰 흐름 Hexagonal/State 반영, 에러 코드 3종 추가 |
| v3 | 2026-05-14 | OpenAPI 3.0.3 정식 spec(`openapi.yaml`) 분리, 본 문서는 narrative summary로 전환 |
