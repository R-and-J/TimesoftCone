# API 명세서 (Narrative Summary)

**상태**: ✅ v4 — **코드 기준 동기화: 2026-06-12**. **정식 spec은 [openapi.yaml](openapi.yaml)** (OpenAPI 3.0.3)
**관련 문서**: [openapi.yaml](openapi.yaml) · [acceptance-criteria.md](../02_requirements/acceptance-criteria.md) · [permission-matrix.md](../02_requirements/permission-matrix.md) · [SRS 3.1](../02_requirements/SRS.md#31-외부-인터페이스-요구사항)

> 본 문서는 *사람이 읽기 쉬운 요약*이다. 실제 구현·codegen·테스트의 기준은 [openapi.yaml](openapi.yaml). 둘 사이 충돌 시 openapi.yaml이 우선한다.
> 본 v4는 `backend/src/interfaces/http/*.controller.ts` 의 실제 라우트를 전수 추출해 갱신했다.

---

## 1. 공통 규약

### 1.1 베이스 URL · 경로 접두사

- 로컬: `http://localhost:3002` (`PORT` 기본 3002).
- **모든 컨트롤러는 `@Controller("api/...")` 접두사를 가지므로 실제 경로는 `/api/...`.** (전역 `setGlobalPrefix` 없음 — `api/` 가 두 번 붙지 않는다.)
- 과거 문서의 `/api/v1` base 는 코드에 없으므로 제거.

### 1.2 인증 · 가드

- **방식**: Bearer JWT — `POST /api/auth/login` 으로 발급. ezpass 중앙 인증에 자격 검증 위임(ADR-019). 토큰에 `sub`/`role`/`empId` 적재 → RBAC를 DB 조회 없이 토큰만으로 결정.
- **전역 가드 3종** (`app.module.ts` 에 `APP_GUARD` 등록, 순서대로):
  1. `JwtAuthGuard` — 토큰 검증. `@Public()` 라우트는 통과. SSE는 `?token=<JWT>` 쿼리 인증 지원(EventSource가 헤더를 못 실음).
  2. `RolesGuard` — `@Roles(...)` 가 있으면 그 role 만. 관리자 계열 `ADMIN_ROLES = [ADMIN, EZPASS_ADMIN, EXAM_ADMIN]`.
  3. `SelfOrAdminGuard` — `@SelfParam("userId")` 가 있으면 경로 `:userId` == 토큰 주체이거나 ADMIN.
- **role**: 관리자 계열(`ADMIN`/`EZPASS_ADMIN`/`EXAM_ADMIN`) vs 일반(`EZPASS`/`EXAM`). (과거 문서의 `EMPLOYEE`/`ADMIN` 2-role 모델은 폐기.)
- **멀티테넌시**: 일반 role 은 자기 회사로 스코프 고정. super `ADMIN` 은 `X-Company-Id` 헤더로 회사 전환(없으면 전 회사 통합).

### 1.3 응답 포맷

- 컨트롤러는 use-case 결과를 **그대로** 반환한다. 과거 문서의 `{success,data,error,timestamp}` 봉투는 **코드에 없음**(미적용).
- 오류는 NestJS 표준 예외 형태: `{ statusCode, message, error }`. 도메인 규칙 위반은 use-case 가 던지는 `DomainError` → 컨트롤러에서 400(`BadRequestException`) 또는 409(`ConflictException`)로 매핑.
- **BigInt**: wallet 잔액·콘·userId 는 backend `bigint`. `json-bigint.interceptor` 가 와이어에서 **문자열**로 직렬화 → 프론트는 `Number()` 로 표시 변환.

---

## 2. 인증 API

### 2.1 로그인

```
POST /api/auth/login
Body: { "id": "user@timesoftcone.com", "password": "...", "cmpnyNo": "7" }   // cmpnyNo 선택
```

- `@Public()`. ezpass 위임 검증 성공 시 JWT + 사용자 식별 반환.
- 과거 문서의 `GET /auth/sso/callback`·`POST /auth/refresh` 는 **코드에 없으므로 제거**.

---

## 3. 본인(Self) API — `@SelfParam("userId")` (본인 또는 ADMIN)

> 과거 문서의 `/users/me/*` 패턴은 실제로는 `/api/users/:userId/*` (경로에 명시적 userId). 배당만 `/api/dividend/me/:userId`.

| 메서드 | 경로 | 설명 |
|---|---|---|
| GET | `/api/users/:userId/activity` | 내 활동(입찰·낙찰·원장 요약) |
| GET | `/api/users/:userId/balance` | 내 지갑 잔액 (FR-5.2) |
| GET | `/api/users/:userId/leave` | 내 휴가 잔액(3-flag) |
| GET | `/api/users/:userId/notifications` | 알림 목록 |
| POST | `/api/users/:userId/notifications/read` | 알림 읽음(`body.ids` 생략 시 전체) |
| GET (SSE) | `/api/users/:userId/notifications/stream` | 실시간 알림 SSE (`?token=`) |
| GET | `/api/dividend/me/:userId?year=` | 내 배당(연도별 stake — ADR-017) |
| GET | `/api/users/:userId/redemption-orders` | 옛 즉시결제 교환 이력(deprecated) |

> 코드에 없어 **제거**: `/users/me/stake`(미구현), `/users/me/wallet`·`/users/me/ledger`·`/users/me/leave-balance`·`/users/me/dividend`(위 실경로로 대체).

---

## 4. 경매 API

| 메서드 | 경로 | 인증 | 설명 |
|---|---|---|---|
| GET | `/api/auctions?status=OPEN,CLOSED&year=2026` | 인증 | 목록(회사 스코프). `status` 는 CSV. |
| GET | `/api/auctions/:id` | 인증 | 상세 |
| POST | `/api/auctions/:id/bids` | 인증 | 입찰 (FR-2.1) |
| GET (SSE) | `/api/auctions/:id/stream` | `@Public()` | 실시간 업데이트 SSE (신호만) |

### 4.1 입찰 (FR-2.1) — 핵심

```
POST /api/auctions/:id/bids
Body: { "amount": 9000 }   // 문자열도 허용(BigInt). userId는 body에 안 받음(토큰 주체 고정).
```

흐름(단일 SQLite 트랜잭션, ADR-018 / CUT-1):
1. `UnitOfWork.lockAuction(id)` — SQLite write 락(no-op `UPDATE`).
2. `auction.placeBid(...)` — `AuctionStatus` 가드절(State 패턴은 CUT-3로 미채택).
3. 직전 최고가 즉시 환불 + 새 입찰자 wallet 차감(외부 호출 0건).
4. `highest_bid` 갱신 + `LEDGER_ENTRY` INSERT.
5. COMMIT 후 `BidPlacedEvent` 발행 → NotificationObserver / SSE.

- 도메인 규칙 위반(마감/최저가 미만/OPEN 아님)은 **409 ConflictException**(메시지 그대로 노출 가능). 타사 경매 입찰은 회사 스코프로 차단.
- 과거 문서의 `GET /auctions/me/bids` 는 **코드에 없으므로 제거**.

### 4.2 실시간 — SSE (WebSocket 아님)

- 과거 문서의 `WS /ws/auctions/{id}` 는 **미구현**. 경매·알림 모두 `@Sse` Server-Sent Events 로 구현.
- 메시지는 **신호만**(민감정보 없음). 클라는 신호 수신 시 인증된 상세 API 를 다시 읽는다.
- 경매 스트림은 `@Public()`, 알림 스트림은 `@SelfParam` + `?token=`.

---

## 5. 지갑·충전 / 교환 (Self)

### 5.1 충전 요청 (ADR-024)

| 메서드 | 경로 | 설명 |
|---|---|---|
| POST | `/api/wallet/charge-requests` | 충전 요청 등록(`{amount, note?}`). 관리자 승인 시 적립. |
| GET | `/api/wallet/charge-requests` | 내 충전 요청 목록 |

### 5.2 교환(Redemption) 신청 (ADR-023)

| 메서드 | 경로 | 설명 |
|---|---|---|
| GET | `/api/redemption/items` | 카탈로그(활성, 회사 스코프) |
| POST | `/api/redemption/requests` | 신청(`{itemId, note?}`) |
| POST | `/api/redemption/requests/custom` | 자유 제안형 신청(`{customName, customPriceP, note?}`) |
| GET | `/api/redemption/requests` | 내 신청 목록 |
| POST | `/api/redemption/requests/:id/confirm` | 수령 컨펌(APPROVED→RECEIVED) |

---

## 6. 관리자 API — `@Roles(...ADMIN_ROLES)`

> 별도 표기 없으면 ADMIN 계열(ADMIN/EZPASS_ADMIN/EXAM_ADMIN) 모두 접근. 일부 메서드는 더 좁은 role.

### 6.1 지갑·충전

| 메서드 | 경로 | 설명 |
|---|---|---|
| GET | `/api/wallet/:userId` | 임의 사용자 잔액(타인 조회라 ADMIN 전용, WA-3) |
| POST | `/api/admin/wallet/credit` | 콘 적립/차감(`{userId, amount, reason}`, 음수=차감, CREDIT_ADMIN) |
| GET | `/api/admin/charge-requests?status=` | 충전 요청 목록 |
| GET | `/api/admin/charge-requests/:id` | 충전 요청 단건(deep-link) |
| POST | `/api/admin/charge-requests/:id/approve` | 승인(적립) |
| POST | `/api/admin/charge-requests/:id/reject` | 반려 |

### 6.2 경매 운영 (`admin-auctions`)

| 메서드 | 경로 | 설명 |
|---|---|---|
| POST | `/api/admin/auctions` | 1일권 수동 생성(`quantity`, `asDraft`; `startPrice` deprecated) |
| POST | `/api/admin/auctions/:id/open` | 즉시 오픈(CREATED→OPEN, 파라미터 변경 동반) |
| POST | `/api/admin/auctions/:id/schedule` | 오픈 예약(파라미터만, 상태 유지) |
| POST | `/api/admin/auctions/:id/settle` | 단건 정산 |
| POST | `/api/admin/auctions/settle-due` | 마감 경과 일괄 정산(스케줄러 수동 트리거) |
| POST | `/api/admin/auctions/open-due` | 시작 경과 일괄 OPEN |
| GET | `/api/admin/auctions/summary` | 상태별 카운터(회사 스코프) |
| GET | `/api/admin/auctions/next-id?year=` | 다음 채번 추천(A-YYYY-NNN) |
| POST | `/api/admin/auctions/:id/extend` | 마감 시각 연장(`{endsAt}`) |
| POST | `/api/admin/auctions/:id/close-now` | 즉시 마감+정산 |
| POST | `/api/admin/auctions/:id/reopen-unsold` | UNSOLD 재오픈(새 매물, `{startedAt, endsAt}`) |
| POST | `/api/admin/auctions/cancel` | CREATED 다중 취소(`{ids[]}`) |
| POST | `/api/admin/auctions/:id/grant-event` | UNSOLD→EVENT 휴가 변환(`{userId}`, FR-4.2) |
| POST | `/api/admin/auctions/purge-unsold?upToYear=` | UNSOLD 재고 영구 삭제 |

> `grant-event` 의 실제 경로는 `:id/grant-event` (과거 문서의 `event-grant` 아님). `force-close` → 실제는 `close-now`.

### 6.3 회원 관리 (`admin-members`, ADR-022)

| 메서드 | 경로 | role | 설명 |
|---|---|---|---|
| GET | `/api/admin/members` | ADMIN 계열 | 목록(회사 스코프, 응답 `mode`) |
| POST | `/api/admin/members/sync` | ADMIN·EZPASS_ADMIN | ezpass org 동기화 |
| POST | `/api/admin/members` | ADMIN·EXAM_ADMIN | 회원 추가(EXAM 로컬) |
| PATCH | `/api/admin/members/:id` | ADMIN·EXAM_ADMIN | 수정/비번재설정/비활성(EZPASS는 use-case에서 409) |

### 6.4 휴가·연말 풀

| 메서드 | 경로 | 설명 |
|---|---|---|
| POST | `/api/admin/leave/use` | 휴가 사용 우선순위 차감(`{userId, days, year?}`, FR-3.1, ADR-003). **ADMIN RBAC**(과거 `/internal/leave/deduct` + X-Internal-Token 모델 폐기). |
| POST | `/api/admin/leave-pool/collect?dryRun=&sourceYear=` | 연말 풀 수집(REGULAR 잔여→supply, 멱등, ADR-017) |
| POST | `/api/admin/leave-pool/release?force=&sourceYear=` | 다음 회차 발행(점진 발행) |
| GET | `/api/admin/leave-pool/upcoming` | 다음 자동 발행 회차 미리보기 |
| GET / PATCH | `/api/admin/release-policy` | 분산 발행 정책 조회/변경(none/daily/weekly/monthly union) |
| POST | `/api/admin/leave-sync/check?year=` | leave_balance.AUCTION ↔ ezpass mdat 정합 점검(비상조치) |
| POST | `/api/admin/leave-sync/:userId/reconcile?year=` | 단일 사용자 강제 동기(drift 복구) |

### 6.5 배당

| 메서드 | 경로 | 설명 |
|---|---|---|
| POST | `/api/admin/dividend/settle?dryRun=&year=` | 연말 배당 정산(멱등, 재호출 409, NFR-2 escrow 정합, ADR-008). super ADMIN은 회사별 분리 일괄. |

### 6.6 교환(Redemption) 관리

| 메서드 | 경로 | 설명 |
|---|---|---|
| GET | `/api/admin/redemption/items` | 카탈로그 전체(비활성 포함) |
| POST | `/api/admin/redemption/items` | 항목 추가 |
| PATCH | `/api/admin/redemption/items/:id` | 항목 수정 |
| POST | `/api/admin/redemption/items/:id/active` | 활성 토글(`{active}`) |
| GET | `/api/admin/redemption/items/:id/audits?limit=` | 변경 이력 |
| GET | `/api/admin/redemption-requests?status=` | 신청 목록 |
| GET | `/api/admin/redemption-requests/summary` | 신청 요약 집계 |
| POST | `/api/admin/redemption-requests/:id/approve` | 승인+쿠폰 발급(`{couponCode, note?}`) |
| POST | `/api/admin/redemption-requests/:id/reject` | 반려+환불(`{note}`) |

### 6.7 감사·통계·export

| 메서드 | 경로 | 설명 |
|---|---|---|
| GET | `/api/admin/stats` | 통계(회사 스코프) |
| GET | `/api/admin/ledger?actionTypes=BID,REFUND&from=&to=&limit=&cursor=` | 원장 감사. **커서 페이지네이션**(`cursor`=마지막 id), `actionTypes` CSV. |
| GET | `/api/admin/export?sets=&format=xlsx\|md\|json` | 정산 데이터 결합 export(파일 다운로드, ADR-021) |
| GET | `/api/admin/export/leave-grants?format=csv\|json\|md` | 낙찰 연차 부여 내역 |
| GET | `/api/admin/export/dividends?format=` | 연말 배당 내역 |
| GET | `/api/admin/export/spending?format=` | 지출 내역 |

> **코드에 없어 제거된 관리자 라우트**: `/admin/config/*`(bid-increment/weekly-open-quota/starting-price — 운영 파라미터는 ENV/`release-policy`/생성 시 body 로 대체), `/admin/escrow`(미구현, 정합은 dividend settle 의 NFR-2 검증으로), `/admin/outbox*`(미노출), `/admin/leave-balance`(타인 휴가 조회 라우트 없음 — self `/users/:id/leave` 만), `/admin/wallet?userId=`(→ 실제는 `/api/wallet/:userId`).

---

## 7. HR 시스템 연동 (Outbound — 본 시스템이 호출) — ADR-025

> 본 절은 본 시스템이 **호출하는 외부 API**라 위 paths 목록과 별개. 낙찰 시 연차 통지는 Outbox → relay → 어댑터(`EzpassHrLeaveClient`)가 ezpass 정식 REST 로 수행(실패 시 재시도/DLQ, ADR-005).

**ADR-025 개정(2026-06-01)**: 초안의 msaportal DB 직쓰기 어댑터를 **ezpass 정식 REST 어댑터**로 교체. 과거 문서의 `POST {HR_BASE}/api/hr/leave` 서술은 폐기.

### 7.1 낙찰 연차 통지 (현재 mdat 절대값 덮어쓰기)

```
1) 현재값 조회:  POST {EZPASS_BASE_BSNS_URL}/v1/cmn/dlz/CmnDlz0020P/selectUserYrycInfo
                 Body: { submitUserNo, startDe }              // startDe=회계년도 시작일(회사 정책 Y1/Y2)
2) 갱신:        PUT  {EZPASS_BASE_BSNS_URL}/v1/adm/dlz/AdmDlz0070M/streYryc
                 Headers: Authorization: Bearer <admin token>, locale
                 Body: [ { userNo, mdatYrycDayQty: (현재+delta), mdatYrycDayQtyMinute, yrycYear, content } ]
```

- `email → (user_no, cmpny_no)` 는 `tbl_user_info` READ-ONLY lookup. `cmpny != 7`(타임소프트콘) 이면 throw(타 회사 쓰기 방지).
- `cmpny_no`·회계년도·이력 적재는 **ezpass 서버가 토큰·회사정보로 자동 처리** → 직쓰기 대비 안전·감사추적 확보.
- 잔여 위젯은 mdat **분** 컬럼을 합산하므로 `mdatYrycDayQtyMinute = mdat × 8h × 60` 도 함께 PUT.
- `401` → admin 토큰 재발급 후 1회 재시도.

> **배당 출금**(연말 복지카드 한도 증액)은 `PayoutChannel` 포트 경로. 입찰 결제와 무관하며 wallet 차감은 외부 호출 0건(ADR-011).

---

## 8. 배치 / 스케줄러 (HTTP 라우트 아님)

> 과거 문서의 `/internal/batch/*` (X-Internal-Token) 엔드포인트는 **코드에 없음**. 대신 **자동 스케줄러 + 관리자 수동 트리거 라우트**로 구현:

| 기능 | 자동 스케줄러 | 수동 트리거 라우트 |
|---|---|---|
| 마감 경매 정산 | `SettleDueAuctionsScheduler`(`SETTLE_INTERVAL_MS`) | `POST /api/admin/auctions/settle-due` |
| 시작 경매 오픈 | `OpenDueAuctionsScheduler` | `POST /api/admin/auctions/open-due` |
| 연말 풀 수집 | `LeavePoolScheduler`(cutoff-gated) | `POST /api/admin/leave-pool/collect` |
| 풀 매물 발행 | (release-policy 기반) | `POST /api/admin/leave-pool/release` |
| 연말 배당 | `YearEndDividendScheduler`(cutoff-gated) | `POST /api/admin/dividend/settle` |

---

## 관련 문서

- [SRS 3.1 외부 인터페이스](../02_requirements/SRS.md#31-외부-인터페이스-요구사항) · [SRS FR-5.x](../02_requirements/SRS.md#32-기능적-요구사항-명세표)
- [permission-matrix.md](../02_requirements/permission-matrix.md)
- [ADR-018 경매 정산 규칙](../04_decisions/ADR-018-auction-settlement-rules.md)
- [ADR-019~022 인증·신원](../04_decisions/)
- [ADR-023 교환 채널](../04_decisions/) · [ADR-024 충전 요청](../04_decisions/) · [ADR-025 HR REST 연동](../04_decisions/)

## 개정 이력

| 버전 | 일자 | 변경 사항 |
|---|---|---|
| v1 | 2026-04-23 | 최초 초안 |
| v2 | 2026-05-14 | wallet 분리, FR-5.1/5.2 추가 |
| v3 | 2026-05-14 | OpenAPI 정식 spec 분리, narrative summary 전환 |
| v4 | 2026-06-12 | **코드 기준 전수 동기화**: `/api` 접두사 정정, 로그인 실경로, `/users/:userId/*` self 경로, ADR-023/024 교환·충전, admin-auctions/members/leave-pool/dividend/redemption/export 전체 반영, SSE(WebSocket 정정), 커서 원장, ADR-025 HR REST. 미구현 라우트(`/auth/sso/*`·`/users/me/*`·`/admin/config/*`·`/admin/escrow`·`/admin/outbox*`·`/internal/*`) 제거. |
