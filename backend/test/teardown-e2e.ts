// globalTeardown — 임시 DB와 sidecar(-wal/-shm/-journal) 파일 정리.
import { existsSync, rmSync } from "node:fs";
import { E2E_DB_SIDECARS } from "./db-path";

module.exports = async () => {
  for (const f of E2E_DB_SIDECARS) {
    if (existsSync(f)) rmSync(f);
  }
};
