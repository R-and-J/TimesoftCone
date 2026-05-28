// setupFiles — 각 테스트 파일이 모듈을 import하기 *전에* 실행된다.
// PrismaClient가 process.env.DATABASE_URL을 읽기 전에 임시 DB로 지정하고,
// 스케줄러는 꺼서(타이머 0/비활성) 테스트가 부수효과 없이 끝나게 한다.
import { E2E_DB_URL } from "./db-path";

process.env.DATABASE_URL = E2E_DB_URL;
process.env.SETTLE_INTERVAL_MS = "0"; // 자동 정산 스케줄러 비활성
process.env.DIVIDEND_AUTO_ENABLED = "false"; // 연말 배당 자동 지급 비활성
process.env.AUTH_MODE = process.env.AUTH_MODE ?? "local"; // ezpass 네트워크 회피
process.env.ANTISNIPE_WINDOW_MS = process.env.ANTISNIPE_WINDOW_MS ?? "300000";
process.env.ANTISNIPE_EXTEND_MS = process.env.ANTISNIPE_EXTEND_MS ?? "300000";
process.env.JWT_SECRET = process.env.JWT_SECRET ?? "e2e-test-secret-0123456789abcdef";
