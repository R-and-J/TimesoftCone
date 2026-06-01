-- role 값 확장: EMPLOYEE/ADMIN → ADMIN/EZPASS/EXAM (3-role 모델).
--   ADMIN  = 전용 관리자(고정), EZPASS = 회사 도메인 연동, EXAM = 비연동 독립.
-- 기존 EMPLOYEE 행은 EZPASS로 변환(이후 로그인/재시드가 이메일 도메인 기준으로 정확히 재계산).
-- SQLite는 CHECK 제약 변경 시 테이블 재생성이 필요하다(ALTER … DROP CONSTRAINT 미지원).

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
    CONSTRAINT "users_role_valid" CHECK ("role" IN ('ADMIN', 'EZPASS', 'EXAM')),
    CONSTRAINT "users_contributed_days_nonneg" CHECK ("contributed_days" >= 0)
);

INSERT INTO "new_users" ("id","emp_id","name","team","job_rank","job_title","email","role","contributed_days","created_at","password_hash","active")
SELECT "id","emp_id","name","team","job_rank","job_title","email",
       CASE "role" WHEN 'EMPLOYEE' THEN 'EZPASS' ELSE "role" END,
       "contributed_days","created_at","password_hash","active"
FROM "users";

DROP TABLE "users";
ALTER TABLE "new_users" RENAME TO "users";

CREATE UNIQUE INDEX "users_emp_id_key" ON "users"("emp_id");
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

PRAGMA foreign_keys=ON;
