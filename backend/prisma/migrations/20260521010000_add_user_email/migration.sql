-- 사내 ezpass 중앙 인증(ADR-019) 연동용 email 컬럼 추가.
-- ezpass 로그인 계정(user_id = 이메일)을 우리 users 행과 매핑하기 위한 키.

ALTER TABLE `users`
  ADD COLUMN `email` VARCHAR(191) NULL COMMENT '사내 ezpass 로그인 계정(이메일) 매핑 키 (ADR-019)';

CREATE UNIQUE INDEX `users_email_key` ON `users`(`email`);

-- 테스트 ezpass 관리자 계정을 우리 관리자(박부장, TS-2024-099)에 매핑.
-- 시드 데이터가 있어 로그인 직후 데모가 풍부해짐.
UPDATE `users` SET `email` = 'admin@timesoftcon.co.kr' WHERE `emp_id` = 'TS-2024-099';
