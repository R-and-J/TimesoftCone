-- 직급/직책을 users에 추가 (ezpass clsf_nm / ofcsprtps_nm 동기화 캐시, 표시용 — ADR-020).
-- 신원/조직은 ezpass 기준; 이 컬럼은 ezpass에서 동기화되는 표시용 스냅샷.
ALTER TABLE `users`
  ADD COLUMN `job_rank`  VARCHAR(191) NULL,
  ADD COLUMN `job_title` VARCHAR(191) NULL;
