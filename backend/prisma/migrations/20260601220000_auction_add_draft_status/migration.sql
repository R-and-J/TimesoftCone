-- auction.status CHECK 제약에 'DRAFT' 추가. SQLite는 CHECK ALTER 불가 →
-- 테이블 재구성 + FK·인덱스 재부착. bid_event가 auction.id를 FK로 가리키므로
-- bid_event의 데이터는 ON DELETE RESTRICT 영향 받지 않게 PRAGMA로 임시 OFF.
PRAGMA foreign_keys=OFF;

CREATE TABLE "auction_new" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "status" TEXT NOT NULL DEFAULT 'CREATED',
    "start_price" BIGINT NOT NULL,
    "highest" BIGINT NOT NULL,
    "highest_bidder_id" BIGINT,
    "bid_count" INTEGER NOT NULL DEFAULT 0,
    "min_increment" BIGINT NOT NULL DEFAULT 100,
    "leave_days" INTEGER NOT NULL DEFAULT 1,
    "started_at" DATETIME NOT NULL,
    "ends_at" DATETIME NOT NULL,
    "settled_at" DATETIME,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL,
    CONSTRAINT "auction_status_valid"          CHECK ("status" IN ('DRAFT', 'CREATED', 'OPEN', 'AWARDED', 'UNSOLD')),
    CONSTRAINT "auction_start_price_nonneg"    CHECK ("start_price" >= 0),
    CONSTRAINT "auction_highest_nonneg"        CHECK ("highest" >= 0),
    CONSTRAINT "auction_bid_count_nonneg"      CHECK ("bid_count" >= 0),
    CONSTRAINT "auction_min_increment_positive" CHECK ("min_increment" > 0),
    CONSTRAINT "auction_leave_days_nonneg"     CHECK ("leave_days" >= 0),
    CONSTRAINT "auction_time_ordering"         CHECK ("ends_at" > "started_at"),
    CONSTRAINT "auction_highest_bidder_id_fkey" FOREIGN KEY ("highest_bidder_id") REFERENCES "users" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

INSERT INTO "auction_new" ("id","status","start_price","highest","highest_bidder_id","bid_count","min_increment","leave_days","started_at","ends_at","settled_at","created_at","updated_at")
SELECT "id","status","start_price","highest","highest_bidder_id","bid_count","min_increment","leave_days","started_at","ends_at","settled_at","created_at","updated_at" FROM "auction";

DROP TABLE "auction";
ALTER TABLE "auction_new" RENAME TO "auction";

CREATE INDEX "auction_status_ends_at_idx" ON "auction"("status", "ends_at");

PRAGMA foreign_keys=ON;
