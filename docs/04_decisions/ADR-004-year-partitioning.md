# ADR-004: Year 기준 파티셔닝 (오버엔지니어링 방지)

- **상태**: ✅ Accepted
- **결정일**: 2026-04-10
- **결정자**: 타임소프트콘

## 컨텍스트

비정규 연차(`AUCTION`, `EVENT`)는 연말에 소멸된다. 이 "소멸" 로직을 어떻게 구현할지 결정 필요.

## 초기 아이디어 (Rejected)

> "낙찰받은 휴가마다 **`expired_at`** 컬럼을 두고, 매일 밤 배치를 돌려 만료된 휴가를 삭제한다."

## 회피한 리스크

💣 **불필요한 리소스 낭비 + 복잡도 증가**

- 본 시스템에서 거래되는 모든 비정규 연차는 **무조건 "해당 연도 12월 31일"까지만 유효**
- `expired_at`을 개별 row마다 두는 것은 **데이터 중복** (모든 값이 `YYYY-12-31`)
- **매일 스케줄러 실행** → 불필요한 DB 부하 (실제로 만료되는 날은 연 1회뿐)
- 날짜 계산 로직(윤년/영업일 고려?)의 복잡도

추가 리스크:
- 테스트 케이스 복잡화 ("2월 말에 낙찰받으면 만료일은?")
- 버그 온상 — 월별 만료 로직 오류 시 전사 영향

## 결정

`LEAVE_BALANCE` 및 `AUCTION` 테이블에 **`year` 컬럼만** 두어 연도 단위로 관리한다.

### 스키마

```sql
CREATE TABLE leave_balance (
    id          BIGINT PRIMARY KEY,
    user_id     BIGINT NOT NULL,
    year        INT NOT NULL,           -- ← 파티션 키
    leave_type  leave_type_enum NOT NULL,
    allocated_days INT NOT NULL,
    used_days      INT NOT NULL,
    UNIQUE (user_id, year, leave_type)
) PARTITION BY RANGE (year);

CREATE TABLE leave_balance_2026 PARTITION OF leave_balance
    FOR VALUES FROM (2026) TO (2027);
CREATE TABLE leave_balance_2027 PARTITION OF leave_balance
    FOR VALUES FROM (2027) TO (2028);
```

### 연말 소멸 처리 (12/31 배치)

```sql
-- Soft Delete (DB-RULE-2)
UPDATE leave_balance
SET deleted_at = NOW()
WHERE year = 2026
  AND leave_type IN ('AUCTION', 'EVENT');
```

이전 연도 파티션은 **그대로 두고 조회에서 필터링** (또는 아카이브 테이블로 이동).

## 결과 및 트레이드오프

### ✅ 긍정적 결과
- **극단적 단순성** — 배치는 연 1회, 단일 UPDATE
- **자연스러운 파티셔닝** — 연도별 쿼리 최적화 자동 적용
- **아카이빙 용이** — `leave_balance_2024` 파티션을 통째로 detach하면 끝
- **날짜 계산 버그 리스크 제로**

### ⚠️ 트레이드오프
- **분기/반기 만료 제품 도입 불가** — 향후 "반기 경매" 같은 요구사항이 오면 스키마 변경 필요
- **연말 배치 실패 시 롤백 복잡** — 배치가 여러 연도 데이터를 건드리면 복구 시나리오 필요
- **파티션 수동 생성 운영 부담** — 매년 12월 전에 다음 해 파티션 미리 생성해야 함 (자동화 스크립트 필수)

### 🛡️ 제약
- **[SRS DB-RULE-2]** AUCTION/EVENT 이전 연도 데이터는 Soft Delete (`deleted_at` 마킹). 완전 삭제 금지 — 감사 추적성 확보
- **파티션 자동 생성 스케줄러**: 매년 11/30에 다음 해 파티션 생성 작업 필요

## 관련 문서
- [SRS DB-RULE-2](../02_requirements/SRS.md#342-데이터-무결성-제약조건)
- [ERD](../03_design/erd.md)
- [ADR-002 휴가 속성 플래그](ADR-002-leave-type-flag.md)
