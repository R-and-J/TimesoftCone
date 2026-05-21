# ADR-003: 백엔드 강제 차감 우선순위

- **상태**: ✅ Accepted
- **결정일**: 2026-04-10
- **결정자**: 타임소프트콘

## 컨텍스트

직원이 사내 그룹웨어에서 휴가를 기안할 때, 어떤 속성(`REGULAR`/`AUCTION`/`EVENT`)의 연차부터 차감할지 결정해야 한다.

## 초기 아이디어 (Rejected)

> "사용자에게 선택권을 준다 — 휴가 기안 시 '일반 연차'와 '경매 연차' 중 고를 수 있게 한다."

## 회피한 리스크

💣 **사용자 실수로 인한 재산 손실 + 대규모 클레임**

시나리오:
1. 직원 A가 경매로 `AUCTION` 연차 2개를 10,000 포인트에 낙찰받음
2. 연중 휴가 기안 시 무심코 `REGULAR`(법정 연차)을 먼저 다 사용
3. 연말 도래 → `AUCTION` 연차 2개가 미사용 상태로 **소멸** ([ADR-002](ADR-002-leave-type-flag.md))
4. 직원 A: "내 돈 주고 산 연차가 왜 사라지냐" → **극심한 사내 클레임**

실제 이유는 A가 직접 잘못 선택한 것이지만, 사용자 인지 부하(3종 구분 인식)를 기대하는 설계는 **실패**한다.

추가 리스크:
- 공용 풀에 재투입되어야 할 `REGULAR`이 소진되지 않아 **다음 해 경매 물량 감소**
- `EVENT` 연차도 `AUCTION`처럼 소멸되어 포상 가치 훼손

## 결정

**사용자에게 선택권을 주지 않는다.** 백엔드 로직에서 차감 순서를 강제한다.

```
차감 우선순위: AUCTION → EVENT → REGULAR
                (1순위)    (2순위)   (3순위, 최후)
```

### 의사 코드

```sql
-- 휴가 승인 시 애플리케이션 트랜잭션 내
FOR leave_type IN ['AUCTION', 'EVENT', 'REGULAR']:
    remaining_of_type = SELECT (allocated - used)
                        FROM leave_balance
                        WHERE user_id=? AND year=? AND leave_type=?
    IF remaining_of_type >= days_needed:
        UPDATE leave_balance SET used_days = used_days + days_needed
        WHERE user_id=? AND year=? AND leave_type=?
        BREAK
    ELSE:
        UPDATE leave_balance SET used_days = allocated_days  -- 이 타입 소진
        days_needed -= remaining_of_type
        CONTINUE
```

### UI 규칙
- 휴가 기안 화면에는 **"총 사용 가능 일수"만 표시**
- 어떤 속성에서 차감되는지는 **결과 화면에서만 노출** ("이번 휴가는 AUCTION 1일, REGULAR 1일 차감됨")

## 결과 및 트레이드오프

### ✅ 긍정적 결과
- **경매 연차 소멸 클레임 원천 차단** — 직원이 산 연차는 반드시 먼저 소모됨
- **공용 풀 재투입 보장** — `REGULAR`이 끝까지 남아 다음 해 매물화 가능성 유지
- **사용자 인지 부하 최소화** — "그냥 휴가 쓰면 알아서 처리됨"

### ⚠️ 트레이드오프
- **사용자 자유도 제거** — "전략적으로 REGULAR을 먼저 쓰고 싶은" 직원의 요구는 무시됨
  - 예: "올해는 AUCTION을 아껴두고 내년으로 넘기고 싶다" → 불가능 (`AUCTION`은 이월 안 됨이 전제이므로 실제론 의미 없음)
- **UI 설명 부담** — 결과 화면에서 "어느 속성이 차감되었는지"를 명확히 고지해야 혼란 최소화
- **쿼리 복잡도 증가** — 단일 UPDATE가 아닌 FOR 루프 로직

### 🛡️ 제약
- 이 우선순위는 **하드코딩하지 말고 enum 순서로 관리** → 향후 속성 추가 시 유지보수 용이
- 휴가 승인 API 응답에 **실제 차감된 타입 breakdown** 반드시 포함

## 관련 문서
- [SRS FR-3.1](../02_requirements/SRS.md#32-기능적-요구사항-명세표)
- [ADR-002 휴가 속성 플래그](ADR-002-leave-type-flag.md)
