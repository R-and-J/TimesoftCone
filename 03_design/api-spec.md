# API 명세서 (OpenAPI 초안)

**상태**: 🟡 초안 — 팀 리뷰 후 OpenAPI YAML로 정식화 필요
**관련 문서**: [SRS 3.1](../02_requirements/SRS.md#31-외부-인터페이스-요구사항) / [UML 순차](UML.md#-순차-다이어그램-sequence-diagram)

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
    "message": "잔여 포인트가 입찰액보다 부족합니다.",
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
| `POINT_INSUFFICIENT` | 400 | 포인트 부족 |
| `BID_TOO_LOW` | 400 | 현재 최고가보다 낮거나 같음 |
| `AUCTION_CLOSED` | 409 | 마감된 경매에 입찰 시도 |
| `LOCK_CONFLICT` | 409 | Redis 락 획득 실패 (재시도 권장) |
| `HR_API_TIMEOUT` | 502 | HR API 응답 지연 (MQ 재시도 처리 중) |
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

## 3. 사용자 / 포인트 API

### 3.1 내 포인트 잔액 조회 (FR 없음 - 기본 조회)

```
GET /users/me/points
```

**Response**
```json
{
  "data": {
    "currentPoint": 50000,
    "bidableBalance": 45000,
    "heldInBids": 5000
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

**흐름**:
1. Redis 분산 락 획득 (`LOCK auction:{id}`, TTL 5s)
2. 현재 최고가 비교
3. 포인트 잔액 검증 (`current_point >= amount`)
4. DB 트랜잭션: 포인트 차감 + 최고가 갱신 + 로그 INSERT
5. WebSocket 브로드캐스트
6. 락 해제

**Response (성공)**
```json
{
  "data": {
    "auctionId": 101,
    "acceptedAmount": 9000,
    "newHighestBid": 9000,
    "lockHeldMs": 47
  }
}
```

**Response (실패 — 포인트 부족)**
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

### 6.2 에스크로 현황 조회

```
GET /admin/escrow?year=2026
```

**Response**
```json
{
  "data": {
    "year": 2026,
    "balance": 4250000,
    "totalBidCount": 487,
    "totalWinnerCount": 245,
    "auditHash": "sha256:abc123..."
  }
}
```

### 6.3 감사 로그 조회

```
GET /admin/logs?userId=&auctionId=&from=&to=
```

---

## 7. HR 시스템 연동 (Outbound — 본 시스템이 호출)

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

- [ ] OpenAPI 3.0 YAML로 정식화 (Swagger UI 생성)
- [ ] 페이지네이션 규약 통일 (cursor vs offset)
- [ ] Rate Limiting 정책 (입찰 API 특히)
- [ ] API 버저닝 전략 (`/v1` 이후)
- [ ] HR API 실패 시 재시도 정책 문서화

---

## 관련 문서

- [SRS 3.1 외부 인터페이스](../02_requirements/SRS.md#31-외부-인터페이스-요구사항)
- [UML 순차 다이어그램](UML.md#-순차-다이어그램-sequence-diagram)
- [ADR-005 HR API 타이밍](../04_decisions/ADR-005-hr-api-timing.md)
