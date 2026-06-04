-- ReleasePolicy 에 startPrice 컬럼 추가(2026-06-04). null이면 ENV/기본값 사용.
ALTER TABLE "release_policy" ADD COLUMN "start_price" BIGINT;
