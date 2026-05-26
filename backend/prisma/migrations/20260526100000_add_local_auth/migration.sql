-- 자립형(AUTH_MODE=local) 배포용 컬럼 (ADR-022).
-- password_hash: bcrypt 해시 (위임형에선 NULL). active: 비활성 시 로그인 거부.
ALTER TABLE "users" ADD COLUMN "password_hash" TEXT;
ALTER TABLE "users" ADD COLUMN "active" BOOLEAN NOT NULL DEFAULT 1;
