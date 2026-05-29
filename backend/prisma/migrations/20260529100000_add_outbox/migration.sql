-- 트랜잭션 아웃박스 (ADR-005/013, CUT-4·7 부활). 외부 HR 호출의 신뢰성 발행.
CREATE TABLE "outbox" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "topic" TEXT NOT NULL,
    "payload" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "max_attempts" INTEGER NOT NULL DEFAULT 5,
    "next_attempt_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "last_error" TEXT,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "sent_at" DATETIME,
    CONSTRAINT "outbox_status_valid" CHECK ("status" IN ('PENDING', 'SENT', 'DEAD'))
);

CREATE INDEX "outbox_status_next_attempt_at_idx" ON "outbox" ("status", "next_attempt_at");
