-- LEAVE_POOL_RUN: 연말 풀 수집 배치(ADR-017)의 멱등성/감사 마커.
-- target_year UNIQUE → 동일 연도 중복 수집 차단(매물·Stake 중복 생성 방지).
CREATE TABLE "leave_pool_run" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "source_year" INTEGER NOT NULL,
    "target_year" INTEGER NOT NULL,
    "contributor_count" INTEGER NOT NULL,
    "days_collected" INTEGER NOT NULL,
    "auctions_created" INTEGER NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'DONE',
    "ran_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE UNIQUE INDEX "leave_pool_run_target_year_key" ON "leave_pool_run"("target_year");
