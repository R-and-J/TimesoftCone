// globalSetup — 통합 테스트 전체 실행 전 1회. 임시 DB를 지우고 마이그레이션을
// deploy해서 트리거(reject_ledger_mutation)·CHECK 제약까지 포함한 깨끗한 스키마를
// 만든다. (committed dev.db 시드 데이터에 의존하지 않아 격리됨.)
import { execSync } from "node:child_process";
import { existsSync, rmSync } from "node:fs";
import { join } from "node:path";
import { E2E_DB_SIDECARS, E2E_DB_URL } from "./db-path";

module.exports = async () => {
  for (const f of E2E_DB_SIDECARS) {
    if (existsSync(f)) rmSync(f);
  }
  execSync("npx prisma migrate deploy", {
    cwd: join(__dirname, ".."),
    env: { ...process.env, DATABASE_URL: E2E_DB_URL },
    stdio: "inherit",
  });
};
