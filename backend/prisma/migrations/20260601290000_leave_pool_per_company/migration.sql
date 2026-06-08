-- 멀티테넌시: leave_pool_run 멱등 키를 (target_year) → (company_id, target_year)로.
-- 회사별로 같은 연도 풀을 독립 수집할 수 있어야 한다(EZPASS·EXAM 각자 2027 등).
-- SQLite에서 UNIQUE 제약 변경은 인덱스 교체로 충분(테이블 재생성 불필요).

DROP INDEX IF EXISTS "leave_pool_run_target_year_key";
CREATE UNIQUE INDEX "uq_pool_company_target" ON "leave_pool_run"("company_id", "target_year");
