-- 사용자 주도 충전 요청, 관리자 승인 워크플로 (ADR-024).
CREATE TABLE "charge_request" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "user_id" BIGINT NOT NULL,
    "amount" BIGINT NOT NULL,
    "note" TEXT,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "decided_by" BIGINT,
    "decided_at" DATETIME,
    "decision_note" TEXT,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL,
    CONSTRAINT "charge_request_status_valid" CHECK ("status" IN ('PENDING', 'APPROVED', 'REJECTED')),
    CONSTRAINT "charge_request_amount_positive" CHECK ("amount" > 0),
    CONSTRAINT "charge_request_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "charge_request_decided_by_fkey" FOREIGN KEY ("decided_by") REFERENCES "users" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

CREATE INDEX "charge_request_status_created_at_idx" ON "charge_request" ("status", "created_at");
CREATE INDEX "charge_request_user_id_created_at_idx" ON "charge_request" ("user_id", "created_at");
