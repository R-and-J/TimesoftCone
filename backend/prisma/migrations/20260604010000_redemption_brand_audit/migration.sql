-- 스토어 관리 페이지 확장(2026-06-04).
-- 1) redemption_item에 brand(제휴사), display_order 컬럼 추가.
-- 2) (company_id, active, category) 복합 인덱스 — 회사 스코프 카탈로그 조회용.
-- 3) redemption_item_audit 신설 — CRUD 이력 추적(actor / before / after JSON).

ALTER TABLE "redemption_item" ADD COLUMN "brand" TEXT;
ALTER TABLE "redemption_item" ADD COLUMN "display_order" INTEGER NOT NULL DEFAULT 0;

DROP INDEX IF EXISTS "redemption_item_active_category_idx";
CREATE INDEX "redemption_item_company_id_active_category_idx"
    ON "redemption_item" ("company_id", "active", "category");

CREATE TABLE "redemption_item_audit" (
    "id"              INTEGER PRIMARY KEY AUTOINCREMENT,
    "item_id"         INTEGER NOT NULL,
    "company_id"      BIGINT  NOT NULL DEFAULT 1,
    "actor_user_id"   BIGINT,
    "action"          TEXT    NOT NULL,
    "before"          TEXT,
    "after"           TEXT,
    "created_at"      DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "fk_audit_item" FOREIGN KEY ("item_id")
        REFERENCES "redemption_item" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX "redemption_item_audit_item_created_idx"
    ON "redemption_item_audit" ("item_id", "created_at");
CREATE INDEX "redemption_item_audit_company_created_idx"
    ON "redemption_item_audit" ("company_id", "created_at");
