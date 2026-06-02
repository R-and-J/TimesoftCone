-- LeavePool 점진 발행(2026-06-02 결정).
-- 수집 시점에 매물을 한꺼번에 만들지 않고, 기여자별 잔여(supply)만 적재해두고
-- ReleaseInventoryScheduler가 ReleasePolicy 주기마다 N개씩 매물로 변환한다.
-- BigInt autoincrement drift 회피 위해 PK는 INTEGER.

CREATE TABLE "leave_pool_supply" (
    "id"               INTEGER PRIMARY KEY AUTOINCREMENT,
    "target_year"      INTEGER NOT NULL,
    "company_id"       BIGINT  NOT NULL DEFAULT 1,
    "user_id"          BIGINT  NOT NULL,
    "contributed_days" INTEGER NOT NULL,
    "remaining_days"   INTEGER NOT NULL,
    "created_at"       DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at"       DATETIME NOT NULL,
    CONSTRAINT "fk_supply_user" FOREIGN KEY ("user_id") REFERENCES "users" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "uq_supply_company_year_user"
    ON "leave_pool_supply" ("company_id", "target_year", "user_id");

CREATE INDEX "ix_supply_company_year_remaining"
    ON "leave_pool_supply" ("company_id", "target_year", "remaining_days");


CREATE TABLE "leave_pool_release_run" (
    "id"           INTEGER PRIMARY KEY AUTOINCREMENT,
    "target_year"  INTEGER NOT NULL,
    "company_id"   BIGINT  NOT NULL DEFAULT 1,
    "period_index" TEXT    NOT NULL,
    "cadence"      TEXT    NOT NULL,
    "released_qty" INTEGER NOT NULL,
    "ran_at"       DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE UNIQUE INDEX "uq_release_company_year_period"
    ON "leave_pool_release_run" ("company_id", "target_year", "period_index");
