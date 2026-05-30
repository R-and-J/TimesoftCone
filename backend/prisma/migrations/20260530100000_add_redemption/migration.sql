-- 자립형 배포 포인트 소모처 (ADR-023). 상품 카탈로그 + 교환 주문.

CREATE TABLE "redemption_item" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "sku" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "price_p" BIGINT NOT NULL,
    "stock" INTEGER,
    "active" BOOLEAN NOT NULL DEFAULT 1,
    "category" TEXT,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL,
    CONSTRAINT "redemption_item_price_nonneg" CHECK ("price_p" >= 0),
    CONSTRAINT "redemption_item_stock_nonneg" CHECK ("stock" IS NULL OR "stock" >= 0)
);
CREATE UNIQUE INDEX "redemption_item_sku_key" ON "redemption_item" ("sku");
CREATE INDEX "redemption_item_active_category_idx" ON "redemption_item" ("active", "category");

CREATE TABLE "redemption_order" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "user_id" BIGINT NOT NULL,
    "item_id" INTEGER NOT NULL,
    "price_p_at_redeem" BIGINT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "delivery_ref" TEXT,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL,
    CONSTRAINT "redemption_order_status_valid" CHECK ("status" IN ('PENDING', 'FULFILLED', 'FAILED', 'REFUNDED')),
    CONSTRAINT "redemption_order_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "redemption_order_item_id_fkey" FOREIGN KEY ("item_id") REFERENCES "redemption_item" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE INDEX "redemption_order_user_id_created_at_idx" ON "redemption_order" ("user_id", "created_at");

-- ledger_entry CHECK에 REDEEM / REDEEM_REFUND 추가. SQLite는 CHECK ALTER 불가 →
-- 테이블을 새로 만들어 데이터 복사 후 교체. Insert-Only 트리거(DB-RULE-1)도 재부착.
PRAGMA foreign_keys=OFF;

DROP TRIGGER IF EXISTS "ledger_entry_no_update";
DROP TRIGGER IF EXISTS "ledger_entry_no_delete";

CREATE TABLE "ledger_entry_new" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "occurred_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "user_id" BIGINT NOT NULL,
    "currency" TEXT NOT NULL,
    "action_type" TEXT NOT NULL,
    "amount" BIGINT NOT NULL,
    "balance_after" BIGINT NOT NULL,
    "auction_id" TEXT,
    "ref_note" TEXT,
    CONSTRAINT "ledger_currency_valid" CHECK ("currency" IN ('WELFARE_POINT')),
    CONSTRAINT "ledger_action_type_valid" CHECK ("action_type" IN ('BID', 'REFUND', 'WIN', 'DIVIDEND', 'CREDIT_ADMIN', 'EXPIRE', 'REDEEM', 'REDEEM_REFUND')),
    CONSTRAINT "ledger_balance_after_nonnegative" CHECK ("balance_after" >= 0),
    CONSTRAINT "ledger_credit_admin_needs_note" CHECK ("action_type" <> 'CREDIT_ADMIN' OR ("ref_note" IS NOT NULL AND length("ref_note") > 0)),
    CONSTRAINT "ledger_entry_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

INSERT INTO "ledger_entry_new"
    ("id", "occurred_at", "user_id", "currency", "action_type", "amount", "balance_after", "auction_id", "ref_note")
SELECT "id", "occurred_at", "user_id", "currency", "action_type", "amount", "balance_after", "auction_id", "ref_note"
FROM "ledger_entry";

DROP TABLE "ledger_entry";
ALTER TABLE "ledger_entry_new" RENAME TO "ledger_entry";

CREATE INDEX "ledger_entry_user_id_occurred_at_idx" ON "ledger_entry" ("user_id", "occurred_at");
CREATE INDEX "ledger_entry_action_type_occurred_at_idx" ON "ledger_entry" ("action_type", "occurred_at");

-- DB-RULE-1 재부착: ledger_entry는 INSERT-ONLY.
CREATE TRIGGER "ledger_entry_no_update"
BEFORE UPDATE ON "ledger_entry"
BEGIN
    SELECT RAISE(ABORT, 'DB-RULE-1: ledger_entry is INSERT-ONLY. UPDATE blocked. Use a compensating INSERT (REFUND / CREDIT_ADMIN / REDEEM_REFUND).');
END;

CREATE TRIGGER "ledger_entry_no_delete"
BEFORE DELETE ON "ledger_entry"
BEGIN
    SELECT RAISE(ABORT, 'DB-RULE-1: ledger_entry is INSERT-ONLY. DELETE blocked. Use a compensating INSERT (REFUND / CREDIT_ADMIN / REDEEM_REFUND).');
END;

PRAGMA foreign_keys=ON;
