-- 알림 테이블 (ADR-013 Observer/Domain-Event 구독 결과물).
CREATE TABLE "notification" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "user_id" BIGINT NOT NULL,
    "type" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "auction_id" TEXT,
    "read" BOOLEAN NOT NULL DEFAULT 0,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "notification_type_valid" CHECK ("type" IN ('OUTBID', 'AUCTION_WON')),
    CONSTRAINT "notification_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE INDEX "notification_user_id_read_idx" ON "notification" ("user_id", "read");
CREATE INDEX "notification_user_id_created_at_idx" ON "notification" ("user_id", "created_at");
