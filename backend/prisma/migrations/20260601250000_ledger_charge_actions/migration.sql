-- ledger_entry CHECK 제약 확장: 충전 요청 라이프사이클 추적용 actionType 2개 추가.
--   CHARGE_REQUESTED: 사용자가 충전 요청 제출 (amount=요청금액, balanceAfter=현재잔액 — 잔액 변화 없음)
--   CHARGE_REJECTED:  관리자 반려 (amount=요청금액, balanceAfter=현재잔액 — 잔액 변화 없음)
-- 실제 잔액 변화는 승인 시 CREDIT_ADMIN entry로 남는다(기존 그대로).
-- SQLite CHECK ALTER 불가 → 테이블 재구성 + DB-RULE-1 트리거 재부착.
PRAGMA foreign_keys=OFF;

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
    CONSTRAINT "ledger_action_type_valid" CHECK ("action_type" IN ('BID', 'REFUND', 'WIN', 'DIVIDEND', 'CREDIT_ADMIN', 'EXPIRE', 'REDEEM', 'REDEEM_REFUND', 'CHARGE_REQUESTED', 'CHARGE_REJECTED')),
    CONSTRAINT "ledger_balance_after_nonnegative" CHECK ("balance_after" >= 0),
    CONSTRAINT "ledger_credit_admin_needs_note" CHECK ("action_type" <> 'CREDIT_ADMIN' OR ("ref_note" IS NOT NULL AND length("ref_note") > 0)),
    CONSTRAINT "ledger_entry_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

INSERT INTO "ledger_entry_new" ("id","occurred_at","user_id","currency","action_type","amount","balance_after","auction_id","ref_note")
SELECT "id","occurred_at","user_id","currency","action_type","amount","balance_after","auction_id","ref_note" FROM "ledger_entry";

-- 트리거는 DROP 시 같이 제거되지만 테이블 삭제 시 먼저 명시 drop.
DROP TRIGGER IF EXISTS "ledger_entry_no_update";
DROP TRIGGER IF EXISTS "ledger_entry_no_delete";

DROP TABLE "ledger_entry";
ALTER TABLE "ledger_entry_new" RENAME TO "ledger_entry";

CREATE INDEX "ledger_entry_user_id_occurred_at_idx" ON "ledger_entry"("user_id", "occurred_at");
CREATE INDEX "ledger_entry_action_type_occurred_at_idx" ON "ledger_entry"("action_type", "occurred_at");

-- DB-RULE-1: 트리거 재부착(insert-only).
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

PRAGMA foreign_keys=ON;
