# 권한 매트릭스 (RBAC + ABAC)

**상태**: ✅ v1 — 기획 결정 반영 (2026-05-14)
**관련 문서**: [SRS](SRS.md) / [business-rules.md](business-rules.md) GOV-1 / [api-spec.md](../03_design/api-spec.md) / [wbs.md](../07_plan/wbs.md) BR-1

> 본 문서는 *누가 무엇을 할 수 있는가*를 기능 단위로 명문화한다. API 구현 시 NestJS Guard·Decorator의 1:1 매핑 기준이 된다.

### 📖 약자 풀이

이 문서 전체에서 반복적으로 등장하는 두 가지 권한 모델 약자.

| 약자 | 풀이 (영문 / 한글) | 한 줄 의미 | 예시 |
|---|---|---|---|
| **RBAC** | Role-Based Access Control / *역할 기반 권한* | 사용자의 **역할(role)** 로 허용·거부 결정 | "ADMIN만 wallet 적립 가능" |
| **ABAC** | Attribute-Based Access Control / *속성 기반 권한* | 리소스의 **속성**(소유자·상태 등)으로 허용·거부 결정 | "본인 wallet만 조회 가능, 타인은 차단" |

> 본 시스템은 두 모델을 **혼합** 사용한다 — 먼저 RBAC로 역할을 확인하고, 자기 데이터 관련 API에선 ABAC로 소유자까지 검증한다.

---

## 1. 역할(Role) 정의

| Role | 정의 | 부여 기준 |
|---|---|---|
| `EMPLOYEE` | 일반 직원. 본인 데이터 조회·경매 참여 가능 | 기본값. SSO 인증 시 자동 부여 |
| `ADMIN` | 관리자. 운영·감사·시스템 설정 권한 보유. 일반 직원으로서의 행위도 모두 가능 ([business-rules](business-rules.md) GOV-1) | 별도 지정. `users.role = 'ADMIN'` |

> **확장 여지**: 추후 `AUDITOR`(감사 전용, 쓰기 불가) 등 분리 필요 시 본 매트릭스에 컬럼 추가.

## 2. 권한 결정 모델

본 시스템은 **RBAC(역할 기반) + ABAC(속성 기반) 혼합**을 사용한다. 위 §약자 풀이 참조.

| 차원 | 결정 기준 | 예시 |
|---|---|---|
| **RBAC** (역할 검사) | 사용자의 `role` 컬럼 값 | "관리자(ADMIN)만 wallet 적립 가능" |
| **ABAC** (소유자 검사 — 자기 vs 타인) | 리소스 소유자가 호출자와 동일한가 | "내 wallet은 조회 가능, 타인 것은 ADMIN만" |
| **System Token** (내부 호출 검증) | 내부 시스템 토큰 (X-Internal-Token) 헤더 | 스케줄러·Outbox Worker가 호출하는 내부 엔드콘 |

### 표기 규약 (이하 매트릭스에서)

- **✅** — 허용
- **❌** — 거부 (403)
- **✅ (self)** — 본인 리소스만 허용. 타인 리소스 접근 시 거부
- **✅ (audit)** — 허용하되 별도 감사 플래그 기록 ([wbs](../07_plan/wbs.md) BR-1 완화책)
- **🔒** — 시스템 내부 호출 전용 (X-Internal-Token), 일반 토큰 거부

---

## 3. 권한 매트릭스

### 3.1 인증 (Auth)

| ID | 기능 | API | EMPLOYEE | ADMIN | 익명 | 비고 |
|---|---|---|---|---|---|---|
| AU-1 | SSO 로그인 콜백 | `GET /auth/sso/callback` | ✅ | ✅ | ✅ | 인증 전 진입점 |
| AU-2 | 토큰 갱신 | `POST /auth/refresh` | ✅ (self) | ✅ (self) | ❌ | 자기 refresh token만 |

### 3.2 지갑 / 거래 내역 (Wallet)

| ID | 기능 | API | EMPLOYEE | ADMIN | 비고 |
|---|---|---|---|---|---|
| WA-1 | 내 wallet 잔액 조회 | `GET /users/me/wallet` | ✅ (self) | ✅ (self) | FR-5.2 |
| WA-2 | 내 거래 내역 조회 | `GET /users/me/ledger` | ✅ (self) | ✅ (self) | FR-5.2 |
| WA-3 | 타인 wallet 조회 | `GET /admin/wallet?userId=` | ❌ | ✅ | 관리자 감사용 |
| WA-4 | 타인 거래 내역 조회 | `GET /admin/ledger?userId=` | ❌ | ✅ | LEDGER_ENTRY 감사 |
| WA-5 | wallet 적립 (CREDIT_ADMIN) | `POST /admin/wallet/credit` | ❌ | ✅ | FR-5.1, `reason` 필수 |

### 3.3 휴가 잔액 (Leave)

| ID | 기능 | API | EMPLOYEE | ADMIN | 비고 |
|---|---|---|---|---|---|
| LE-1 | 내 휴가 잔액 조회 | `GET /users/me/leave-balance` | ✅ (self) | ✅ (self) | 3-flag 모두 |
| LE-2 | 타인 휴가 잔액 조회 | `GET /admin/leave-balance?userId=` | ❌ | ✅ | |
| LE-3 | 휴가 차감 (시스템 호출) | `POST /internal/leave/deduct` | 🔒 | 🔒 | 그룹웨어/Stub의 휴가 사용 승인 시 호출 (ADR-016 스코프 외 워크플로) |

### 3.4 경매 (Auction)

| ID | 기능 | API | EMPLOYEE | ADMIN | 비고 |
|---|---|---|---|---|---|
| AC-1 | 경매 목록 조회 | `GET /auctions` | ✅ | ✅ | 자기 입찰 여부 표시 |
| AC-2 | 경매 상세 조회 | `GET /auctions/{id}` | ✅ | ✅ | |
| AC-3 | 입찰 | `POST /auctions/{id}/bids` | ✅ | **✅ (audit)** | GOV-1 — ADMIN 입찰은 `LEDGER_ENTRY`에 별도 플래그(예: `actor_role=ADMIN`)로 감사 (BR-1) |
| AC-4 | 내 입찰 이력 | `GET /auctions/me/bids` | ✅ (self) | ✅ (self) | |
| AC-5 | 경매 수동 오픈 (분산 오픈 운영) | `POST /admin/auctions/{id}/open` | ❌ | ✅ | OP-4 분산 오픈 배치의 수동 트리거 |
| AC-6 | 유찰 재고 EVENT 수동 지급 | `POST /admin/auctions/{id}/event-grant` | ❌ | ✅ | FR-4.2 |
| AC-7 | 경매 강제 마감/취소 | `POST /admin/auctions/{id}/force-close` | ❌ | ✅ | 장애 대응용. 감사 로그 필수 |

### 3.5 배당 / 지분 (Dividend / Stake)

| ID | 기능 | API | EMPLOYEE | ADMIN | 비고 |
|---|---|---|---|---|---|
| DV-1 | 내 예상/확정 배당 조회 | `GET /users/me/dividend` | ✅ (self) | ✅ (self) | |
| DV-2 | 타인 배당 조회 | `GET /admin/dividend?userId=` | ❌ | ✅ | |
| ST-1 | 내 Stake 조회 | `GET /users/me/stake` | ✅ (self) | ✅ (self) | |
| ST-2 | 타인 Stake 조회 | `GET /admin/stake?userId=` | ❌ | ✅ | |

### 3.6 운영 파라미터 (Config)

[business-rules.md](business-rules.md) §1 ⚙️ 항목들의 런타임 변경 API. 모두 관리자 전용.

| ID | 기능 | API | EMPLOYEE | ADMIN | 비고 |
|---|---|---|---|---|---|
| CF-1 | OP-3 최소 입찰 증분 설정 | `PUT /admin/config/bid-increment` | ❌ | ✅ | |
| CF-2 | OP-5 분산 오픈 주당 개수 설정 | `PUT /admin/config/weekly-open-quota` | ❌ | ✅ | |
| CF-3 | OP-6 시작가 모드·값 설정 | `PUT /admin/config/starting-price` | ❌ | ✅ | 3모드 중 택1 |

### 3.7 감사 / 모니터링 (Audit)

| ID | 기능 | API | EMPLOYEE | ADMIN | 비고 |
|---|---|---|---|---|---|
| AD-1 | 에스크로 현황 조회 | `GET /admin/escrow?year=` | ❌ | ✅ | 정합성 검증 포함 |
| AD-2 | 전체 LEDGER_ENTRY 감사 로그 | `GET /admin/ledger` | ❌ | ✅ | 필터·페이지네이션 |
| AD-3 | Outbox 상태 조회 | `GET /admin/outbox` | ❌ | ✅ | PENDING/SENT/DLQ |
| AD-4 | DLQ 항목 재시도·해제 | `POST /admin/outbox/{id}/retry` | ❌ | ✅ | 감사 로그 필수 |

### 3.8 배치 (Batch)

| ID | 기능 | API | EMPLOYEE | ADMIN | 시스템 토큰 | 비고 |
|---|---|---|---|---|---|---|
| BA-1 | 연말 풀 수집 배치 | `POST /internal/batch/year-end-settlement` | ❌ | ✅ | 🔒 | 보통 스케줄러 자동. 관리자는 수동 재실행 가능 (재진입 가능 — ADR-017) |
| BA-2 | 연말 배당 배치 | `POST /internal/batch/dividend-distribution` | ❌ | ✅ | 🔒 | FR-4.1 |
| BA-3 | 분산 오픈 주차 배치 | `POST /internal/batch/weekly-auction-open` | ❌ | ✅ | 🔒 | OP-4 |
| BA-4 | 경매 마감 처리 배치 | `POST /internal/batch/close-expired-auctions` | ❌ | ✅ | 🔒 | end_time 경과 경매 일괄 마감 |

---

## 4. 특수 케이스

### 4.1 ADMIN의 이중 역할 — 감사 강화 (BR-1)

[business-rules.md](business-rules.md) GOV-1에서 ADMIN의 경매 참여를 "완전 허용"으로 결정. 단 이해상충(COI) 리스크는 [wbs](../07_plan/wbs.md) BR-1에 등재.

**완화책 — 감사 분리**:
- ADMIN이 입찰(AC-3)·기여(연말 자동) 등 *직원으로서* 한 행위는 `LEDGER_ENTRY`에 `actor_role = 'ADMIN'` 플래그 기록
- 관리자 운영 행위(AC-5/6/7, CF-x, AD-x, BA-x)는 별도 감사 테이블(`admin_audit_log`)에 기록 — 누가 언제 무엇을 운영했는지
- 같은 ADMIN이 *동일 경매*를 오픈하고(AC-5) 본인이 입찰(AC-3)하면 → 감사 대시보드에서 *이상 패턴*으로 표시

### 4.2 자기 vs 타인 — ABAC(속성 기반) 검증

`✅ (self)` 표시된 항목은 **반드시 리소스 소유자와 호출자 일치 검증** 필요. 즉 RBAC(역할)는 통과해도, 리소스의 *소유자 속성*이 일치하지 않으면 거부:

```typescript
// 예: /users/me/* 는 path의 'me'를 호출자 ID로 치환
// /admin/* 는 RBAC만 검증 (이미 ADMIN이면 타인 리소스 접근 OK)
```

**구현 가이드**: NestJS Guard 2단계 — `JwtAuthGuard` → `RolesGuard` (RBAC) → `ResourceOwnerGuard` (ABAC, `/users/me/*` 패턴에만 적용).

### 4.3 시스템 인터널 (🔒) — X-Internal-Token

- Cron 스케줄러, Outbox Worker 등 *내부 호출* 전용 엔드콘
- 일반 JWT 토큰으로는 접근 불가 → 403
- 별도 환경변수 `INTERNAL_API_TOKEN`을 X-Internal-Token 헤더로 검증
- 외부 노출 금지 — 내부망 또는 사이드카에서만 호출

### 4.4 퇴사자

- SSO 인증 단계에서 차단되어 시스템 자체에 접근 불가
- 따라서 권한 매트릭스 적용 시점에 *존재하지 않음*
- 퇴사자 데이터 처리는 [edge-cases.md](edge-cases.md) EC-1 참조

### 4.5 익명 (Anonymous)

- 인증 전 상태. AU-1만 허용. 그 외 모두 401
- API Gateway 단에서 `/auth/sso/*` 외 경로는 JWT 필수

---

## 5. 구현 가이드 (NestJS 기준)

### 5.1 데코레이터 패턴

```typescript
// 컨트롤러 메서드에 권한 데코레이터 부착
@Roles('ADMIN')
@Post('/admin/wallet/credit')
creditWallet(@Body() dto: CreditWalletDto) { ... }

@Roles('EMPLOYEE', 'ADMIN')
@Self()  // path의 :userId가 호출자와 일치해야 함
@Get('/users/:userId/wallet')
getMyWallet(@Param('userId') userId: string) { ... }

@InternalOnly()  // X-Internal-Token 검증
@Post('/internal/batch/year-end-settlement')
runBatch() { ... }
```

### 5.2 Guard 체인

```
JwtAuthGuard       → 토큰 유효성·만료 검증, req.user 주입
   ↓
RolesGuard         → @Roles 데코레이터 vs req.user.role 비교
   ↓
ResourceOwnerGuard → @Self() 데코레이터 시 path/query의 userId vs req.user.id
```

### 5.3 감사 로그 자동화

- ADMIN 운영 행위(`/admin/*`)는 NestJS Interceptor로 자동 `admin_audit_log` INSERT
- ADMIN의 일반 행위(예: AC-3 입찰)는 도메인 이벤트에 `actor_role` 포함 → 이벤트 핸들러가 LEDGER_ENTRY에 플래그 기록

---

## 6. 미결 / 추가 검토

- [ ] `admin_audit_log` 테이블 스키마 신설 — db-schema.sql 다음 개정 시 추가
- [ ] LEDGER_ENTRY의 `actor_role` 컬럼 추가 여부 (BR-1 완화책 — 추가 권장)
- [ ] `AUDITOR` 역할 도입 시점 결정 — 학교 프로젝트 범위 외
- [ ] 운영 파라미터 변경 이력(`config_change_log`)도 별도 감사 대상으로 둘지

## 관련 문서

- [SRS](SRS.md) — FR/NFR 원본 (특히 FR-5.x)
- [business-rules.md](business-rules.md) GOV-1, KPI
- [edge-cases.md](edge-cases.md) EC-1 퇴사자
- [api-spec.md](../03_design/api-spec.md) — 엔드콘과 1:1 매핑
- [wbs.md](../07_plan/wbs.md) BR-1 — 관리자 COI 리스크
- [ADR-011](../04_decisions/ADR-011-welfare-point-ownership.md) — 관리자 적립 권한
- [ADR-016](../04_decisions/ADR-016-internal-leave-system.md) — 휴가 차감 워크플로 스코프
