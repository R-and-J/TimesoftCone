-- notification.link_path 컬럼 추가 — 알림 클릭 시 이동할 프론트엔드 경로.
-- 새 토픽이 늘어도 프론트 분기를 수정하지 않게 하기 위함(백엔드가 path를 박음).
-- SQLite는 NULL 허용 컬럼 ADD COLUMN을 안전하게 지원 — 테이블 재생성 불필요.
ALTER TABLE "notification" ADD COLUMN "link_path" TEXT;
