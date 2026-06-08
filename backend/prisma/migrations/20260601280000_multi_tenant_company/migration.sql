-- 멀티테넌시: company 테이블 + 전 테넌트 테이블 company_id + 복합 UNIQUE.
-- 테이블 재생성 없이 ADD COLUMN(DEFAULT 1=EZPASS) + 유니크 인덱스 교체.
-- 백필: 자식 테이블은 user의 회사 기준. ledger_entry는 insert-only 트리거를
-- 잠시 drop → ADD COLUMN+백필 → 재생성. (reset 시엔 빈 테이블이라 백필 0행.)

PRAGMA foreign_keys=OFF;

-- 1) company + 2개 회사(EZPASS=1, EXAM=2)
CREATE TABLE "company" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "cmpny_no" INTEGER,
    "kind" TEXT NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE UNIQUE INDEX "company_code_key" ON "company"("code");
INSERT INTO "company" ("id","code","name","cmpny_no","kind") VALUES
    (1,'EZPASS','타임소프트콘 (ezpass)',7,'EZPASS'),
    (2,'EXAM','EXAM (독립)',NULL,'EXAM');

-- 2) users.company_id (nullable — super ADMIN은 null=전 회사)
ALTER TABLE "users" ADD COLUMN "company_id" INTEGER;
UPDATE "users" SET "company_id" = 1;
UPDATE "users" SET "company_id" = 2 WHERE "role" IN ('EXAM','EXAM_ADMIN');
UPDATE "users" SET "company_id" = NULL WHERE "role" = 'ADMIN';

-- 3) 자식 테이블(user 연관) company_id + user 회사 기준 백필
ALTER TABLE "wallet" ADD COLUMN "company_id" INTEGER NOT NULL DEFAULT 1;
UPDATE "wallet" SET "company_id" = COALESCE((SELECT "company_id" FROM "users" WHERE "users"."id"="wallet"."user_id"),1);
ALTER TABLE "leave_balance" ADD COLUMN "company_id" INTEGER NOT NULL DEFAULT 1;
UPDATE "leave_balance" SET "company_id" = COALESCE((SELECT "company_id" FROM "users" WHERE "users"."id"="leave_balance"."user_id"),1);
ALTER TABLE "bid_event" ADD COLUMN "company_id" INTEGER NOT NULL DEFAULT 1;
UPDATE "bid_event" SET "company_id" = COALESCE((SELECT "company_id" FROM "users" WHERE "users"."id"="bid_event"."user_id"),1);
ALTER TABLE "notification" ADD COLUMN "company_id" INTEGER NOT NULL DEFAULT 1;
UPDATE "notification" SET "company_id" = COALESCE((SELECT "company_id" FROM "users" WHERE "users"."id"="notification"."user_id"),1);
ALTER TABLE "stake" ADD COLUMN "company_id" INTEGER NOT NULL DEFAULT 1;
UPDATE "stake" SET "company_id" = COALESCE((SELECT "company_id" FROM "users" WHERE "users"."id"="stake"."user_id"),1);
ALTER TABLE "redemption_order" ADD COLUMN "company_id" INTEGER NOT NULL DEFAULT 1;
UPDATE "redemption_order" SET "company_id" = COALESCE((SELECT "company_id" FROM "users" WHERE "users"."id"="redemption_order"."user_id"),1);
ALTER TABLE "redemption_request" ADD COLUMN "company_id" INTEGER NOT NULL DEFAULT 1;
UPDATE "redemption_request" SET "company_id" = COALESCE((SELECT "company_id" FROM "users" WHERE "users"."id"="redemption_request"."user_id"),1);
ALTER TABLE "charge_request" ADD COLUMN "company_id" INTEGER NOT NULL DEFAULT 1;
UPDATE "charge_request" SET "company_id" = COALESCE((SELECT "company_id" FROM "users" WHERE "users"."id"="charge_request"."user_id"),1);

-- user 무관 테이블: 현재 데이터 전부 EZPASS(=1)
ALTER TABLE "auction" ADD COLUMN "company_id" INTEGER NOT NULL DEFAULT 1;
ALTER TABLE "outbox" ADD COLUMN "company_id" INTEGER NOT NULL DEFAULT 1;
ALTER TABLE "redemption_item" ADD COLUMN "company_id" INTEGER NOT NULL DEFAULT 1;
ALTER TABLE "release_policy" ADD COLUMN "company_id" INTEGER NOT NULL DEFAULT 1;
ALTER TABLE "leave_pool_run" ADD COLUMN "company_id" INTEGER NOT NULL DEFAULT 1;

-- 4) ledger_entry — insert-only 트리거 drop → ADD COLUMN+백필 → 재생성
DROP TRIGGER IF EXISTS "ledger_entry_no_update";
DROP TRIGGER IF EXISTS "ledger_entry_no_delete";
ALTER TABLE "ledger_entry" ADD COLUMN "company_id" INTEGER NOT NULL DEFAULT 1;
UPDATE "ledger_entry" SET "company_id" = COALESCE((SELECT "company_id" FROM "users" WHERE "users"."id"="ledger_entry"."user_id"),1);
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

-- 5) (중간단계) user-스코프 유니크는 그대로 유지 — 사용자가 한 회사 소속이라
--    (userId,...) 유니크가 이미 충분. 비-user 유니크(redemption_item/leave_pool_run)도
--    중간단계에선 유지. 회사별 유니크 강화는 읽기 격리와 함께 후속 마이그레이션에서.

-- 6) 보조 인덱스(@@index 대응)
CREATE INDEX "users_company_id_idx" ON "users"("company_id");
CREATE INDEX "wallet_company_id_idx" ON "wallet"("company_id");
CREATE INDEX "ledger_entry_company_id_action_type_idx" ON "ledger_entry"("company_id","action_type");
CREATE INDEX "auction_company_id_status_idx" ON "auction"("company_id","status");
CREATE INDEX "bid_event_company_id_idx" ON "bid_event"("company_id");
CREATE INDEX "leave_balance_company_id_idx" ON "leave_balance"("company_id");
CREATE INDEX "stake_company_id_year_idx" ON "stake"("company_id","year");
CREATE INDEX "notification_company_id_idx" ON "notification"("company_id");
CREATE INDEX "outbox_company_id_idx" ON "outbox"("company_id");
CREATE INDEX "redemption_order_company_id_idx" ON "redemption_order"("company_id");
CREATE INDEX "redemption_request_company_id_status_idx" ON "redemption_request"("company_id","status");
CREATE INDEX "charge_request_company_id_status_idx" ON "charge_request"("company_id","status");

PRAGMA foreign_keys=ON;
