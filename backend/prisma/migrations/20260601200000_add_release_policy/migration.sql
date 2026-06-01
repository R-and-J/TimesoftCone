-- ReleasePolicy 싱글톤(id=1) — 풀 수집 매물의 startedAt 분산 정책.
-- cadence별 필수 컬럼 사용 규칙은 애플리케이션 검증으로 강제(SQLite는 부분 CHECK 제약 미지원).
CREATE TABLE "release_policy" (
    "id"            INTEGER NOT NULL PRIMARY KEY DEFAULT 1,
    "cadence"       TEXT    NOT NULL,
    "day_of_week"   INTEGER,
    "day_of_month"  INTEGER,
    "time_of_day"   TEXT    NOT NULL,
    "quantity"      INTEGER NOT NULL,
    "updated_at"    DATETIME NOT NULL,
    CONSTRAINT "release_policy_singleton"     CHECK ("id" = 1),
    CONSTRAINT "release_policy_cadence_valid" CHECK ("cadence" IN ('daily', 'weekly', 'monthly')),
    CONSTRAINT "release_policy_quantity_positive" CHECK ("quantity" > 0),
    CONSTRAINT "release_policy_dow_range"       CHECK ("day_of_week"  IS NULL OR ("day_of_week"  BETWEEN 0 AND 6)),
    CONSTRAINT "release_policy_dom_range"       CHECK ("day_of_month" IS NULL OR ("day_of_month" BETWEEN 1 AND 31))
);

-- 기본 정책 — 매주 월요일 09:00, 1회 5개 (env LEAVEPOOL_WEEKLY_QTY=0 폴백 대체용).
-- 실 적용 값은 관리자 UI에서 PATCH로 조정.
INSERT INTO "release_policy" ("id", "cadence", "day_of_week", "day_of_month", "time_of_day", "quantity", "updated_at")
VALUES (1, 'weekly', 1, NULL, '09:00', 5, CURRENT_TIMESTAMP);
