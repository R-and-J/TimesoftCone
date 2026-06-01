# ADR-025: ezpass 연차 테이블 쓰기 — 정책 완화 (낙찰 통지)

- **상태**: ✅ Accepted
- **결정일**: 2026-06-01
- **결정자**: 타임소프트콘
- **이전 결정 일부 완화**: [[ADR-016]], [[ADR-020]] §4 (둘 다 "ezpass 연차 테이블 *읽기 전용*"이었음)

## 컨텍스트

[[ADR-016]](자체 휴가 관리 시스템 보유)와 [[ADR-020]] §4 ("ezpass 연차 테이블은 쓰지 않는다(읽기만)") 결정 당시의 명분:
- 진짜 HR 연차 테이블에 경매분을 써넣으면 *이중보상* 위험 — 회사가 연차수당까지 부담할 가능성.
- 안전한 분리: 우리 `leave_balance(AUCTION)`에만 적립, 진짜 HR 연차는 안 건드림 ([[ADR-002]] 3-flag).

[[ADR-005]] Outbox + `HrLeaveClient` 인프라는 이미 구축됨([[ADR-013]] EventBus와 역할 분리). 단 `HrLeaveClientAdapter`의 기본 모드는 Mock(외부 호출 0), 실 HR 엔드포인트엔 연결되지 않음 — 발표/데모상 "외부 연동까지 한다"를 *시연*할 도착지가 없었음.

여섯 줄기 외부연동 점검에서 ③(HR 연차 통지)이 mock으로만 멈춰 있어, **실제 ezpass에 쓰는 어댑터를 추가**해 그 한 칸을 닫기로 결정.

추가 결정: "휴가 늘리는 건 그냥 따로 구분 말고 연차 개수만 ↑" — ezpass엔 type(REGULAR/AUCTION/EVENT) 개념이 없으니 굳이 흉내내지 말고 **단일 카운트 증가**로 단순화.

## 결정

**ADR-020 §4의 "ezpass 연차 테이블은 쓰지 않는다(읽기만)"를 다음 범위로 완화한다:**

1. **쓰기 대상은 `tbl_user_yryc.mdat_yryc_day_qty`(조정분)만.** `atmc_yryc_day_qty`(자동 부여분)는 여전히 건드리지 않음.
2. **쓰기 시점은 낙찰 정산 *후* Outbox relay에서**만 — 동기 핫패스 아님, 재시도/DLQ 보장 ([[ADR-005]]).
3. **cmpny_no=7 한정**. 쓰기 전 `user_no`가 cmpny 7 소속인지 검증 → 아니면 throw → DLQ로 격리.
4. 우리 `leave_balance(AUCTION)`은 *그대로* 마스터 유지([[ADR-016]]). ezpass 쓰기는 *추가 통지* — UI 잔액 정본은 항상 우리 DB.
5. **type 구분 안 함** — ezpass엔 REGULAR/AUCTION/EVENT 구분이 없고 mdat 카운트 +N이면 끝. 우리 DB의 3-flag([[ADR-002]])는 *내부 분석/배당 계산용*으로 유지.

### 인바리언트 영향

| 인바리언트 | 영향 |
|---|---|
| #1 회사 예산 0원 선투입 | 변동 없음 — escrow 모델 그대로 |
| #2 P2P 영구 차단 | 변동 없음 — 흐름 방향 동일 (회사→사용자) |
| #3 3-flag 분리 | **우리 DB에선 유지**(내부 분석용). ezpass 쪽은 단일 카운트로 합산 표시 |
| #4 강제 차감 우선순위 | 변동 없음 — 차감은 ezpass가 자체 정책으로 |
| #5 Insert-Only ledger | 변동 없음 — 우리 ledger는 그대로 |
| #6 단일 트랜잭션 정산 | 외부 통지는 *커밋 후 Outbox* (이전과 동일) — 정산 트랜잭션은 여전히 로컬 단일 |

### 이중보상 위험 명시

ezpass가 `mdat_yryc_day_qty`를 연차수당 계산에 포함하느냐는 ezpass(외부 시스템) 정책. 본 ADR은:
- 위험을 *인지*함.
- 학교 프로젝트 데모 범위에선 cmpny 7 테스트 사용자 한정 — 실 임금 영향 없음.
- 운영 도입 시엔 (a) ezpass에 "비법정 연차" 별도 컬럼 협의 또는 (b) 수당 정산 시 mdat 제외 룰 명문화 — 도입사 인사팀 협의 필요.

## 결과 및 트레이드오프

### ✅ 긍정적
- 외부연동 줄기 ③(HR 연차 통지)이 mock → **실 ezpass write**로 완성. 발표·데모 효과 큼 — 사용자가 ezpass에 로그인하면 우리 시스템에서 낙찰한 연차가 *실제로 보임*.
- 기존 Outbox 인프라(재시도/지수 백오프/DLQ) 그대로 활용 — 어댑터 1개 추가로 끝.
- `dlqDepth` 메트릭이 진짜 의미를 가짐(외부 실패 시 누적).

### ⚠️ 트레이드오프
- ADR-020 §4 "읽기만" 약속을 명시적으로 깸 — 본 ADR로 자국 남김.
- 이중보상 이론적 위험 (위 "명시" 참고).
- mysql2 직접 쓰기 → ezpass 스키마 변경 시 어댑터 깨짐. 영향 국소적(어댑터 1개).

### 🛡 안전장치
- `cmpny_no=7` 한정 SQL 가드.
- 쓰기 전 `tbl_user_info`로 user_no 매핑 + cmpny 일치 확인.
- 실패 시 throw → `OutboxRelay`가 DLQ로 격리 → 관리자 `dlqDepth` 노출.
- `HR_LEAVE_CLIENT_KIND` env 기본 `mock`, opt-in으로 `msaportal` 활성.

## 관련 문서
- [[ADR-016]] 자체 휴가 관리 — wallet/leave 마스터는 우리 (변동 없음)
- [[ADR-020]] 신원=ezpass / 연차=우리 DB — §4를 본 ADR로 완화
- [[ADR-005]] Outbox — 통지 경로 (그대로)
- [[ADR-013]] EventBus / 외부호출 분리 (그대로)
- [[ADR-002]] 3-flag — 우리 DB에선 유지
- 코드: `backend/src/adapters/hr/msaportal-hr-leave.client.ts`(예정), `backend/src/ports/hr-leave-client.port.ts`
