---
name: adr-025-ezpass-leave-write-relaxation
description: "ezpass 연차 테이블 쓰기 — ADR-020 §4 '읽기만' 완화. 1차 안(msaportal 직쓰기)에서 정식 REST API(AdmDlz0070M/streYryc + CmnDlz0020P/selectUserYrycInfo)로 개정."
metadata:
  type: project
---

# ADR-025: ezpass 연차 테이블 쓰기 — 정책 완화 (낙찰 통지)

- **상태**: ✅ Accepted (개정 2026-06-01)
- **결정일**: 2026-06-01 (원안) → **2026-06-01 개정**
- **결정자**: 타임소프트콘
- **이전 결정 일부 완화**: [[ADR-016]], [[ADR-020]] §4 (둘 다 "ezpass 연차 테이블 *읽기 전용*"이었음)

## 컨텍스트

[[ADR-016]](자체 휴가 관리 시스템 보유)와 [[ADR-020]] §4 ("ezpass 연차 테이블은 쓰지 않는다(읽기만)") 결정 당시의 명분:
- 진짜 HR 연차 테이블에 경매분을 써넣으면 *이중보상* 위험 — 회사가 연차수당까지 부담할 가능성.
- 안전한 분리: 우리 `leave_balance(AUCTION)`에만 적립, 진짜 HR 연차는 안 건드림 ([[ADR-002]] 3-flag).

[[ADR-005]] Outbox + `HrLeaveClient` 인프라는 이미 구축됨([[ADR-013]] EventBus와 역할 분리). 단 `HrLeaveClientAdapter`의 기본 모드는 Mock(외부 호출 0), 실 HR 엔드포인트엔 연결되지 않음 — 발표/데모상 "외부 연동까지 한다"를 *시연*할 도착지가 없었음.

여섯 줄기 외부연동 점검에서 ③(HR 연차 통지)이 mock으로만 멈춰 있어, **실제 ezpass에 쓰는 어댑터를 추가**해 그 한 칸을 닫기로 결정.

추가 결정: "휴가 늘리는 건 그냥 따로 구분 말고 연차 개수만 ↑" — ezpass엔 type(REGULAR/AUCTION/EVENT) 개념이 없으니 굳이 흉내내지 말고 **단일 카운트 증가**로 단순화.

## 결정의 변천

### 원안 (2026-06-01 오전) — msaportal 직쓰기 어댑터 (폐기)

처음엔 `MsaportalHrLeaveClient`가 mysql2로 `tbl_user_yryc.mdat_yryc_day_qty += N`을 직접 UPDATE. 실측까지 성공(admin mdat 0 → 2.000)했으나 사용자 검토에서 정정 요청.

### 개정 (2026-06-01 오후) — ezpass 정식 REST API

ezpass 코드 분석으로 **정식 엔드포인트 발견**:
- `POST {bsns}/v1/cmn/dlz/CmnDlz0020P/selectUserYrycInfo` — 단일 사용자의 현재 mdat 절대값 조회.
- `PUT  {bsns}/v1/adm/dlz/AdmDlz0070M/streYryc` — `[AdmDlz0070MUpdtYrycVo]` 리스트로 mdat 절대값 덮어쓰기. 관리자 메뉴 "근태 관리 > 개인별 휴가 관리"가 사용하는 그 API.

### 직쓰기 vs REST 비교

| 항목 | msaportal 직쓰기(원안) | REST API(개정) |
|---|---|---|
| 매칭 키 | `yryc_year` ❌ — 회사 정책 무시 | `accnut_start_de` ✅ (회사 정책 Y1=회계년도/Y2=입사일에 따라 서버 자동 계산) |
| cmpny 가드 | SQL 하드코딩 | **토큰에서 cmpny_no 자동 주입** — 구조적으로 타 회사 침범 불가 |
| 이력 적재 | 없음 ❌ — 감사 추적성 깨짐 | `tbl_user_yryc_creat_history`에 자동 적재(`yrycCreatCode="MDAT"`, `content` 포함) |
| 비고/추적 | 없음 | `content="낙찰 적립 (경매 A-...)"` — 감사 시 누가/왜/언제 식별 가능 |
| 누적 방식 | SQL `SET mdat = COALESCE(mdat,0) + ?` | client가 (현재 + delta) 절대값 보냄 (서버는 `SET mdat = ?` 덮어쓰기). `selectUserYrycInfo` 한 번 더 부르지만 동시성·이력 정합성 모두 안전 |
| ezpass 스키마 변경 내성 | 깨짐 (SQL 변경 시 어댑터 깨짐) | REST 계약만 안 깨지면 OK |

**개정으로 채택**: 정식 REST API 경로. 직쓰기 어댑터는 제거.

## 결정 (최종)

**ADR-020 §4의 "ezpass 연차 테이블은 쓰지 않는다(읽기만)"를 다음 범위로 완화한다:**

1. **쓰기 대상은 `tbl_user_yryc.mdat_yryc_day_qty`(조정연차)만.** `atmc_yryc_day_qty`(자동 부여분)는 여전히 건드리지 않음.
2. **쓰기 방법은 정식 ezpass REST API** — `AdmDlz0070M/streYryc`. 직접 DB UPDATE는 금지.
3. **쓰기 시점은 낙찰 정산 *후* Outbox relay에서**만 — 동기 핫패스 아님, 재시도/DLQ 보장 ([[ADR-005]]).
4. **cmpny 한정**: 시스템 토큰(`EZPASS_SYSTEM_USER`)이 cmpny 7 admin이므로 토큰 자체가 cmpny 7 가드를 함. 추가로 어댑터가 `tbl_user_info`에서 email → user_no 매핑 시 cmpny != 7이면 throw → DLQ.
5. 우리 `leave_balance(AUCTION)`은 *그대로* 마스터 유지([[ADR-016]]). ezpass 쓰기는 *추가 통지* — UI 잔액 정본은 항상 우리 DB.
6. **type 구분 안 함** — ezpass엔 REGULAR/AUCTION/EVENT 구분이 없고 mdat 카운트 +N이면 끝. 우리 DB의 3-flag([[ADR-002]])는 *내부 분석/배당 계산용*으로 유지.
7. **`content` 비고** 필드에 `"낙찰 적립 (경매 {id})"` 채워서 ezpass 이력에 추적성 남김.

### 인바리언트 영향

| 인바리언트 | 영향 |
|---|---|
| #1 회사 예산 0원 선투입 | 변동 없음 — escrow 모델 그대로 |
| #2 P2P 영구 차단 | 변동 없음 — 흐름 방향 동일 (회사→사용자) |
| #3 3-flag 분리 | **우리 DB에선 유지**(내부 분석용). ezpass 쪽은 단일 카운트로 합산 표시 |
| #4 강제 차감 우선순위 | 변동 없음 — 차감은 ezpass가 자체 정책으로 |
| #5 Insert-Only ledger | 변동 없음 — 우리 ledger는 그대로 |
| #6 단일 트랜잭션 정산 | 외부 통지는 *커밋 후 Outbox* (이전과 동일) — 정산 트랜잭션은 여전히 로컬 단일 |

### 이중보상 위험 명시 (개정 후에도 유지)

ezpass가 `mdat_yryc_day_qty`를 연차수당 계산에 포함하느냐는 ezpass(외부 시스템) 정책. 본 ADR은:
- 위험을 *인지*함.
- 학교 프로젝트 데모 범위에선 cmpny 7 테스트 사용자 한정 — 실 임금 영향 없음.
- 운영 도입 시엔 (a) ezpass에 "비법정 연차" 별도 컬럼 협의 또는 (b) 수당 정산 시 mdat 제외 룰 명문화 — 도입사 인사팀 협의 필요.

## 결과 및 트레이드오프

### ✅ 긍정적
- 외부연동 줄기 ③(HR 연차 통지)이 mock → **실 ezpass write**로 완성.
- 정식 REST 경로 사용 → ezpass 운영자 관점에서도 "정상 메뉴 호출"로 보임(감사 가능).
- 이력·회계년도·cmpny 가드를 서버 측이 알아서 처리 → 어댑터 코드 단순.
- ezpass DB 스키마 변경에 내성(REST 계약 stable).

### ⚠️ 트레이드오프
- ADR-020 §4 "읽기만" 약속을 명시적으로 깸 — 본 ADR로 자국 남김.
- 이중보상 이론적 위험 (위 "명시" 참고).
- REST 호출 2개(selectUserYrycInfo + streYryc)로 1개 grant당 네트워크 RTT 2번.
- 토큰 캐시(만료 1시간 추정) 관리 필요 — `EzpassAdminTokenService`.
- email → user_no 매핑은 여전히 `tbl_user_info` SELECT 일회성 호출 (시드와 동일 패턴, READ-ONLY).

### 🛡 안전장치
- 시스템 토큰이 cmpny 7 admin이라 토큰 자체가 cmpny 가드. 토큰 발급 실패하면 어댑터 throw → DLQ.
- email → user_no 매핑 시 cmpny != 7이면 throw → DLQ.
- 401 응답 → `refreshOnUnauthorized` 후 1회 재시도. 실패 시 throw → OutboxRelay 재시도/DLQ.
- `HR_LEAVE_CLIENT_KIND` env 기본 `mock`, opt-in으로 `ezpass` 활성.
- `EZPASS_SYSTEM_USER/PW`는 `.env`에만 (`.gitignore` 적용, 커밋 금지).

## 관련 문서
- [[ADR-016]] 자체 휴가 관리 — wallet/leave 마스터는 우리 (변동 없음)
- [[ADR-020]] 신원=ezpass / 연차=우리 DB — §4를 본 ADR로 완화
- [[ADR-005]] Outbox — 통지 경로 (그대로)
- [[ADR-013]] EventBus / 외부호출 분리 (그대로)
- [[ADR-002]] 3-flag — 우리 DB에선 유지
- 코드:
  - `backend/src/adapters/hr/ezpass-hr-leave.client.ts` — REST 어댑터
  - `backend/src/adapters/auth/ezpass-admin-token.service.ts` — 시스템 토큰 캐시
  - `backend/src/ports/hr-leave-client.port.ts` — 포트(변경 없음)
- ezpass 측 엔드포인트 (참고):
  - `POST /v1/cmn/dlz/CmnDlz0020P/selectUserYrycInfo` — `{ submitUserNo, startDe }` → `{ mdatYryc, ... }`
  - `PUT  /v1/adm/dlz/AdmDlz0070M/streYryc` — `[{ userNo, mdatYrycDayQty, mdatYrycDayQtyMinute, yrycYear, content }]`
