-- role 값 확장: ADMIN/EZPASS/EXAM → + EZPASS_ADMIN, EXAM_ADMIN (관리자 영역 분리).
--   ADMIN=최고관리자, EZPASS_ADMIN=ezpass 영역, EXAM_ADMIN=exam 영역, EZPASS/EXAM=일반.
-- 기존 데이터 변환 불필요(현 값 유지). SQLite는 CHECK 변경 시 테이블 재생성 필요.

PRAGMA foreign_keys=OFF;

CREATE TABLE "new_users" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "emp_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "team" TEXT,
    "job_rank" TEXT,
    "job_title" TEXT,
    "email" TEXT,
    "role" TEXT NOT NULL DEFAULT 'EXAM',
    "contributed_days" INTEGER NOT NULL DEFAULT 0,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "password_hash" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT 1,
    CONSTRAINT "users_role_valid" CHECK ("role" IN ('ADMIN', 'EZPASS_ADMIN', 'EXAM_ADMIN', 'EZPASS', 'EXAM')),
    CONSTRAINT "users_contributed_days_nonneg" CHECK ("contributed_days" >= 0)
);

INSERT INTO "new_users" ("id","emp_id","name","team","job_rank","job_title","email","role","contributed_days","created_at","password_hash","active")
SELECT "id","emp_id","name","team","job_rank","job_title","email","role","contributed_days","created_at","password_hash","active"
FROM "users";

DROP TABLE "users";
ALTER TABLE "new_users" RENAME TO "users";

CREATE UNIQUE INDEX "users_emp_id_key" ON "users"("emp_id");
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

PRAGMA foreign_keys=ON;
