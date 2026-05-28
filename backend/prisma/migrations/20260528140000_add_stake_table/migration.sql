-- STAKE — 연도별 배당 지분 스냅샷(ADR-017). dividend(ADR-008)가 user.contributedDays
-- 단일 컬럼 대신 (user_id, year)별 stake 행을 읽도록 분리. LeavePool 수집이 이 행을 적재.
CREATE TABLE "stake" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "user_id" BIGINT NOT NULL,
    "year" INTEGER NOT NULL,
    "days" INTEGER NOT NULL,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL,
    CONSTRAINT "stake_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "stake_user_id_year_key" ON "stake" ("user_id", "year");
CREATE INDEX "stake_year_idx" ON "stake" ("year");

-- 데이터 이관: 기존 user.contributed_days는 "현재 연도(2026) 배당의 지분"으로 쓰이고
-- 있었으므로, 그대로 stake(year=2026) 행으로 옮긴다. (이후 LeavePool 수집은 targetYear
-- 행을 새로 적재 — year별로 정확히 분리.)
INSERT INTO "stake" ("user_id", "year", "days", "updated_at")
SELECT "id", 2026, "contributed_days", CURRENT_TIMESTAMP
FROM "users" WHERE "contributed_days" > 0;
