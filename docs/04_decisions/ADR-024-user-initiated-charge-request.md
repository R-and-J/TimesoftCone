# ADR-024: 사용자 주도 충전 요청 — 관리자 매개 워크플로

- **상태**: ✅ Accepted
- **결정일**: 2026-06-01
- **결정자**: 타임소프트콘

## 컨텍스트

[[ADR-011]] 결정대로 wallet은 우리 시스템이 정본이고, 충전 경로는 두 가지뿐이었다:
1. 시드/관리자 직접 적립 (`POST /api/admin/wallet/credit`, `CREDIT_ADMIN` 원장).
2. 흐름의 결과(REFUND·DIVIDEND) — 정확히는 "충전"이 아님.

데모/실사용 관점에서 **사용자가 직접 충전을 신청할 수 있어야** 한다는 요구가 나왔다. 후보:

| 옵션 | 장점 | 문제 |
|---|---|---|
| **A. 자체 결제(PG 연동 즉시 충전)** | UX 매끄러움 | 외부 PG·세금·결제 시스템 도입 — 학부 프로젝트 범위 밖 |
| **B. 후불(개인 카드/급여공제)로 자동 충전 → escrow 합류** | "후불" 느낌 | **P2P 우회**: 개인돈→escrow→타직원 배당 = 근로기준법 §43 위반 소지([[ADR-001]] 인바리언트 #2/#5) |
| **C. 후불 결제를 스토어 전용으로 분리** | 법 충돌 회피 | 별도 결제 잔액 채널 + 월 청구·정산 시스템 필요(여전히 외부 결제 코드 무거움) |
| **D. 관리자 매개 요청-승인 워크플로** | 인바리언트 0 깨짐, 외부 결제 0, 기존 인프라 100% 재사용 | "진짜 후불"은 아님 — 관리자 책임으로 정산(외부 처리) |

## 결정

**D. 관리자 매개 요청-승인 워크플로 채택.**

사용자는 "N P 충전 요청" 을 등록 → 관리자 알림 → 관리자가 승인하면 기존 `CreditWalletAdminUseCase`가 실행돼 `CREDIT_ADMIN` 원장으로 잔액이 적립. 실제 금전 정산(급여공제·청구서 등)은 **관리자의 외부 업무**로 한정 — 우리 시스템은 *요청 기록과 권한*만 관리.

### 흐름

```
[사용자]  POST /api/wallet/charge-requests {amount, note}
            └─ charge_request INSERT (status=PENDING)
            └─ ChargeRequestSubmittedEvent
                  └─► NotificationObserver: 모든 ADMIN에게 알림
                        "user001 — 50,000P 충전 요청"

[관리자]  GET  /api/admin/charge-requests?status=PENDING
            관리 화면 "충전 요청" 탭에서 확인

[관리자]  POST /api/admin/charge-requests/:id/approve
            └─ 단일 tx:
                  ① charge_request → APPROVED + decidedBy/decidedAt
                  ② CreditWalletAdminUseCase 실행
                       wallet += amount
                       ledger INSERT(CREDIT_ADMIN, refNote="충전요청 #N 승인")
            └─ ChargeApprovedEvent → 요청자에게 알림 "+50,000P 승인됨"

[관리자]  POST /api/admin/charge-requests/:id/reject {note}
            └─ charge_request → REJECTED + decisionNote
            └─ ChargeRejectedEvent → 요청자에게 알림 "반려: 사유"
```

### 도메인

```ts
charge_request:
  id              INTEGER PK
  user_id         BIGINT FK→users
  amount          BIGINT  (positive)
  note            TEXT?   (사용자 요청 사유)
  status          TEXT    PENDING | APPROVED | REJECTED
  decided_by      BIGINT? FK→users (ADMIN)
  decided_at      DATETIME?
  decision_note   TEXT?   (관리자 사유 — 주로 REJECTED 시)
  created_at      DATETIME
  updated_at      DATETIME
```

### 권한 (permission-matrix)

- 요청 생성: 인증 사용자 자신만(토큰 주체 자동 사용, body.userId 무시 — CUT-8 정책).
- 자기 요청 목록: `@SelfParam` 또는 ADMIN.
- 관리자 목록·승인·반려: `@Roles('ADMIN')`.

### 인바리언트와의 정합

- **#1 회사 예산 0원 선투입**: 충전은 회사 예산이지만 *관리자가 명시적으로 승인할 때만* 일어남(데모 = ezpass 복지포인트 부여를 명시화). escrow와 무관(여전히 입찰로만 채워짐).
- **#2/#5 P2P 금지**: 충전은 회사→사용자 방향. P2P 흐름 없음.
- **DB-RULE-1 Insert-Only**: 잔액 변경은 기존 `CreditWalletAdminUseCase` 경유 → CREDIT_ADMIN ledger INSERT. UPDATE/DELETE 없음.
- **ADR-013 EventBus**: 3 도메인 이벤트는 application/events/, 옵저버는 알림 적재(throw 금지) — 기존 패턴 그대로.

### 재사용

- `CreditWalletAdminUseCase` — 그대로 호출.
- `NotificationObserver` — `@OnEvent` 3개 추가 (Submitted/Approved/Rejected).
- `AdminTabs` — '충전 요청' 탭 추가.
- 종 아이콘 피드 — 알림 type 3종 자동 노출.

## 결과 및 트레이드오프

### ✅ 긍정적
- **인바리언트 0건 깨짐** — 인프라 100% 재사용, 외부 결제 0.
- **양방향 알림 자동** — EventBus가 첫 실구독자 이후 새 구독자(이 ADR)를 흡수 → ADR-013 패턴이 또 값을 함.
- **감사 추적** — 모든 요청·결정이 charge_request + ledger CREDIT_ADMIN 양쪽에 남음.

### ⚠️ 트레이드오프
- "**진짜 후불**" 아님 — 외부 결제/급여공제는 *관리자가 알아서 처리*하는 가정. 외부 시스템 자동 정산이 필요해지면 별도 ADR(PG 또는 HR Outbox).
- 관리자 부담 — 요청 누적 시 처리 큐가 됨. 학교 프로젝트엔 OK.

### 🛡 제약
- 요청당 상한 **없음**(관리자 재량). 운영 도입 시 env knob 추가 권장.
- 동일 사용자의 PENDING 다중 요청 허용(관리자가 일괄/개별 판단).

## 관련 문서
- [[ADR-011]] wallet 자체 보유 — 충전 경로의 정본
- [[ADR-013]] Domain Event — 알림 패턴의 또 한 명의 구독자
- [[ADR-019]] 중앙 인증 위임 — 토큰 주체 정책(요청자=토큰 주체)
- [[ADR-022]] 배포 모드 — 자립형에서 회사 복지 예산이 적을 때 유연성 ↑
- 코드: `backend/src/application/wallet/charge-request/*`, `backend/src/interfaces/http/wallet-charge.controller.ts` (사용자) · `admin-charges.controller.ts` (관리자), `frontend/src/pages/AdminCharges.tsx`
