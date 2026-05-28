// 통합 테스트용 임시 SQLite DB 경로. globalSetup(마이그레이션)과
// env-e2e(워커 env 주입)가 같은 절대 경로를 가리키게 한 곳에 둔다.
import { tmpdir } from "node:os";
import { join } from "node:path";

export const E2E_DB_PATH = join(tmpdir(), "timesoftcone-e2e.db");
export const E2E_DB_URL = `file:${E2E_DB_PATH}`;
export const E2E_DB_SIDECARS = ["", "-journal", "-wal", "-shm"].map(
  (s) => E2E_DB_PATH + s,
);
