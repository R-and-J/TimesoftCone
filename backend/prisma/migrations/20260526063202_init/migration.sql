-- TimesoftCone — SQLite init migration.
-- Encodes: CLAUDE.md DB-RULE-1 (Insert-Only ledger via trigger), ADR-011 (wallet
-- master), ADR-002 (3-flag leave), and the former MySQL ENUM/CHECK constraints
-- (enums are TEXT on SQLite, validated by `… IN (…)` CHECKs + domain VOs).

-- CreateTable
CREATE TABLE "users" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "emp_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "team" TEXT,
    "job_rank" TEXT,
    "job_title" TEXT,
    "email" TEXT,
    "role" TEXT NOT NULL DEFAULT 'EMPLOYEE',
    "contributed_days" INTEGER NOT NULL DEFAULT 0,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "users_role_valid" CHECK ("role" IN ('EMPLOYEE', 'ADMIN')),
    CONSTRAINT "users_contributed_days_nonneg" CHECK ("contributed_days" >= 0)
);

-- CreateTable
CREATE TABLE "wallet" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "user_id" BIGINT NOT NULL,
    "currency" TEXT NOT NULL,
    "balance" BIGINT NOT NULL DEFAULT 0,
    "updated_at" DATETIME NOT NULL,
    CONSTRAINT "wallet_currency_valid" CHECK ("currency" IN ('WELFARE_POINT')),
    CONSTRAINT "wallet_balance_nonnegative" CHECK ("balance" >= 0),
    CONSTRAINT "wallet_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ledger_entry" (
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
    CONSTRAINT "ledger_action_type_valid" CHECK ("action_type" IN ('BID', 'REFUND', 'WIN', 'DIVIDEND', 'CREDIT_ADMIN', 'EXPIRE')),
    CONSTRAINT "ledger_balance_after_nonnegative" CHECK ("balance_after" >= 0),
    CONSTRAINT "ledger_credit_admin_needs_note" CHECK ("action_type" <> 'CREDIT_ADMIN' OR ("ref_note" IS NOT NULL AND length("ref_note") > 0)),
    CONSTRAINT "ledger_entry_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "auction" (
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
    CONSTRAINT "auction_status_valid" CHECK ("status" IN ('CREATED', 'OPEN', 'AWARDED', 'UNSOLD')),
    CONSTRAINT "auction_start_price_nonneg" CHECK ("start_price" >= 0),
    CONSTRAINT "auction_highest_nonneg" CHECK ("highest" >= 0),
    CONSTRAINT "auction_bid_count_nonneg" CHECK ("bid_count" >= 0),
    CONSTRAINT "auction_min_increment_positive" CHECK ("min_increment" > 0),
    CONSTRAINT "auction_leave_days_nonneg" CHECK ("leave_days" >= 0),
    CONSTRAINT "auction_time_ordering" CHECK ("ends_at" > "started_at"),
    CONSTRAINT "auction_highest_bidder_id_fkey" FOREIGN KEY ("highest_bidder_id") REFERENCES "users" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "bid_event" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "auction_id" TEXT NOT NULL,
    "user_id" BIGINT NOT NULL,
    "amount" BIGINT NOT NULL,
    "placed_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "bid_event_amount_positive" CHECK ("amount" > 0),
    CONSTRAINT "bid_event_auction_id_fkey" FOREIGN KEY ("auction_id") REFERENCES "auction" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "bid_event_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "leave_balance" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "user_id" BIGINT NOT NULL,
    "year" INTEGER NOT NULL,
    "leave_type" TEXT NOT NULL,
    "granted_days" INTEGER NOT NULL DEFAULT 0,
    "adjusted_days" INTEGER NOT NULL DEFAULT 0,
    "used_days" INTEGER NOT NULL DEFAULT 0,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL,
    CONSTRAINT "leave_type_valid" CHECK ("leave_type" IN ('REGULAR', 'AUCTION', 'EVENT')),
    CONSTRAINT "leave_granted_nonneg" CHECK ("granted_days" >= 0),
    CONSTRAINT "leave_adjusted_nonneg" CHECK ("adjusted_days" >= 0),
    CONSTRAINT "leave_used_nonneg" CHECK ("used_days" >= 0),
    CONSTRAINT "leave_balance_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "users_emp_id_key" ON "users"("emp_id");

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE UNIQUE INDEX "wallet_user_id_currency_key" ON "wallet"("user_id", "currency");

-- CreateIndex
CREATE INDEX "ledger_entry_user_id_occurred_at_idx" ON "ledger_entry"("user_id", "occurred_at");

-- CreateIndex
CREATE INDEX "ledger_entry_action_type_occurred_at_idx" ON "ledger_entry"("action_type", "occurred_at");

-- CreateIndex
CREATE INDEX "auction_status_ends_at_idx" ON "auction"("status", "ends_at");

-- CreateIndex
CREATE INDEX "bid_event_auction_id_placed_at_idx" ON "bid_event"("auction_id", "placed_at" DESC);

-- CreateIndex
CREATE INDEX "leave_balance_user_id_year_idx" ON "leave_balance"("user_id", "year");

-- CreateIndex
CREATE UNIQUE INDEX "leave_balance_user_id_year_leave_type_key" ON "leave_balance"("user_id", "year", "leave_type");

-- DB-RULE-1: ledger_entry is INSERT-ONLY. Block UPDATE/DELETE at the DB level.
-- Refunds/corrections happen as new compensating INSERTs (REFUND / CREDIT_ADMIN).
CREATE TRIGGER "ledger_entry_no_update"
BEFORE UPDATE ON "ledger_entry"
BEGIN
    SELECT RAISE(ABORT, 'DB-RULE-1: ledger_entry is INSERT-ONLY. UPDATE blocked. Use a compensating INSERT (REFUND / CREDIT_ADMIN).');
END;

CREATE TRIGGER "ledger_entry_no_delete"
BEFORE DELETE ON "ledger_entry"
BEGIN
    SELECT RAISE(ABORT, 'DB-RULE-1: ledger_entry is INSERT-ONLY. DELETE blocked. Use a compensating INSERT (REFUND / CREDIT_ADMIN).');
END;
