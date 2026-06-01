-- release_policy 테이블 재구성: cadence='none' 허용 + timeOfDay/quantity NULL 허용.
-- SQLite는 CHECK ALTER 불가 → 테이블 재구성 + 데이터 복사 패턴.
PRAGMA foreign_keys=OFF;

CREATE TABLE "release_policy_new" (
    "id"            INTEGER NOT NULL PRIMARY KEY DEFAULT 1,
    "cadence"       TEXT    NOT NULL,
    "day_of_week"   INTEGER,
    "day_of_month"  INTEGER,
    "time_of_day"   TEXT,
    "quantity"      INTEGER,
    "updated_at"    DATETIME NOT NULL,
    CONSTRAINT "release_policy_singleton"           CHECK ("id" = 1),
    CONSTRAINT "release_policy_cadence_valid"       CHECK ("cadence" IN ('none', 'daily', 'weekly', 'monthly')),
    CONSTRAINT "release_policy_quantity_positive"   CHECK ("quantity" IS NULL OR "quantity" > 0),
    CONSTRAINT "release_policy_dow_range"           CHECK ("day_of_week"  IS NULL OR ("day_of_week"  BETWEEN 0 AND 6)),
    CONSTRAINT "release_policy_dom_range"           CHECK ("day_of_month" IS NULL OR ("day_of_month" BETWEEN 1 AND 31))
);

INSERT INTO "release_policy_new" ("id", "cadence", "day_of_week", "day_of_month", "time_of_day", "quantity", "updated_at")
SELECT "id", "cadence", "day_of_week", "day_of_month", "time_of_day", "quantity", "updated_at" FROM "release_policy";

DROP TABLE "release_policy";
ALTER TABLE "release_policy_new" RENAME TO "release_policy";

PRAGMA foreign_keys=ON;
