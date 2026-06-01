-- notification.type CHECK에 CHARGE_REQUEST_SUBMITTED/CHARGE_APPROVED/CHARGE_REJECTED 추가 (ADR-024).
-- SQLite는 ALTER로 CHECK 수정 불가 → 테이블 재생성 + 데이터 보존.
CREATE TABLE "notification_new" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "user_id" BIGINT NOT NULL,
    "type" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "auction_id" TEXT,
    "read" BOOLEAN NOT NULL DEFAULT 0,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "notification_type_valid" CHECK ("type" IN (
        'OUTBID', 'AUCTION_WON', 'INVENTORY_CREATED',
        'CHARGE_REQUEST_SUBMITTED', 'CHARGE_APPROVED', 'CHARGE_REJECTED'
    )),
    CONSTRAINT "notification_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

INSERT INTO "notification_new" ("id","user_id","type","title","message","auction_id","read","created_at")
SELECT "id","user_id","type","title","message","auction_id","read","created_at" FROM "notification";

DROP TABLE "notification";
ALTER TABLE "notification_new" RENAME TO "notification";

CREATE INDEX "notification_user_id_read_idx" ON "notification" ("user_id", "read");
CREATE INDEX "notification_user_id_created_at_idx" ON "notification" ("user_id", "created_at");
