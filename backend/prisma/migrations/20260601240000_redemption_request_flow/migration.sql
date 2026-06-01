-- 교환 신청→승인+쿠폰→수령 워크플로 (ADR-023 v2). 즉시 결제 폐기.
--
-- 1) redemption_request 신규 테이블 (ChargeRequest 패턴 + couponCode/receivedAt).
-- 2) notification.type CHECK에 REDEMPTION_* 4토픽 추가.
--    (SQLite는 ALTER CHECK 불가 → 테이블 재생성 + 데이터 보존.)

CREATE TABLE "redemption_request" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "user_id" BIGINT NOT NULL,
    "item_id" INTEGER NOT NULL,
    "price_p_at_request" BIGINT NOT NULL,
    "note" TEXT,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "coupon_code" TEXT,
    "decided_by" BIGINT,
    "decided_at" DATETIME,
    "decision_note" TEXT,
    "received_at" DATETIME,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL,
    CONSTRAINT "redemption_request_status_valid" CHECK ("status" IN (
        'PENDING', 'APPROVED', 'RECEIVED', 'REJECTED'
    )),
    CONSTRAINT "redemption_request_user_fkey" FOREIGN KEY ("user_id") REFERENCES "users" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "redemption_request_decided_by_fkey" FOREIGN KEY ("decided_by") REFERENCES "users" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "redemption_request_item_fkey" FOREIGN KEY ("item_id") REFERENCES "redemption_item" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE INDEX "redemption_request_status_created_at_idx" ON "redemption_request" ("status", "created_at");
CREATE INDEX "redemption_request_user_id_created_at_idx" ON "redemption_request" ("user_id", "created_at");

-- notification.type CHECK 갱신: REDEMPTION_* 4토픽 추가.
CREATE TABLE "notification_new" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "user_id" BIGINT NOT NULL,
    "type" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "auction_id" TEXT,
    "link_path" TEXT,
    "read" BOOLEAN NOT NULL DEFAULT 0,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "notification_type_valid" CHECK ("type" IN (
        'OUTBID', 'AUCTION_WON', 'INVENTORY_CREATED',
        'CHARGE_REQUEST_SUBMITTED', 'CHARGE_APPROVED', 'CHARGE_REJECTED',
        'REDEMPTION_REQUEST_SUBMITTED', 'REDEMPTION_APPROVED', 'REDEMPTION_REJECTED', 'REDEMPTION_RECEIVED'
    )),
    CONSTRAINT "notification_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

INSERT INTO "notification_new" ("id","user_id","type","title","message","auction_id","link_path","read","created_at")
SELECT "id","user_id","type","title","message","auction_id","link_path","read","created_at" FROM "notification";

DROP TABLE "notification";
ALTER TABLE "notification_new" RENAME TO "notification";

CREATE INDEX "notification_user_id_read_idx" ON "notification" ("user_id", "read");
CREATE INDEX "notification_user_id_created_at_idx" ON "notification" ("user_id", "created_at");
