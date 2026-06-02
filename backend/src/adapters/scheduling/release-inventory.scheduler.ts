// ReleaseInventoryScheduler — 점진 발행 배치(2026-06-02 결정).
// CollectLeavePool이 적재한 supply에서 ReleasePolicy 주기마다 quantity씩을 매물로 변환.
//
// 패턴은 다른 스케줄러와 동일(setInterval). LeavePoolScheduler와 달리 "1회 발화 후 종료"가
// 아니라 풀이 소진될 때까지 계속 발화(회차당 quantity씩). supply 합계가 0이 되면 종료.
//
// env:
//   RELEASE_INV_AUTO_ENABLED       "true"/"1" 이면 활성 (기본 비활성)
//   RELEASE_INV_CHECK_INTERVAL_MS  체크 주기(기본 1시간). 데모는 작게(예: 60000).

import {
  Injectable,
  Logger,
  OnApplicationShutdown,
  OnModuleInit,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { ReleaseInventoryUseCase } from "@/application/leave-pool/release-inventory.use-case";

const DEFAULT_INTERVAL_MS = 3_600_000; // 1시간

@Injectable()
export class ReleaseInventoryScheduler implements OnModuleInit, OnApplicationShutdown {
  private readonly logger = new Logger(ReleaseInventoryScheduler.name);
  private timer: NodeJS.Timeout | null = null;
  private running = false;

  constructor(
    private readonly config: ConfigService,
    private readonly useCase: ReleaseInventoryUseCase,
  ) {}

  onModuleInit() {
    const enabled = this.config.get<string>("RELEASE_INV_AUTO_ENABLED");
    if (enabled !== "true" && enabled !== "1") {
      this.logger.warn(
        "Release-inventory auto-batch disabled (set RELEASE_INV_AUTO_ENABLED=true to enable).",
      );
      return;
    }

    const raw = this.config.get<string>("RELEASE_INV_CHECK_INTERVAL_MS");
    const intervalMs = raw === undefined ? DEFAULT_INTERVAL_MS : Number(raw);
    if (!Number.isFinite(intervalMs) || intervalMs <= 0) {
      this.logger.warn(
        "RELEASE_INV_CHECK_INTERVAL_MS is 0 or invalid; auto-batch disabled.",
      );
      return;
    }

    this.logger.log(`Release-inventory auto-batch enabled (check every ${intervalMs}ms)`);
    void this.tick();
    this.timer = setInterval(() => void this.tick(), intervalMs);
  }

  onApplicationShutdown() {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
  }

  private async tick(): Promise<void> {
    if (this.running) return;
    this.running = true;
    try {
      const results = await this.useCase.executeAll();
      let totalRemaining = 0;
      for (const r of results) {
        totalRemaining += r.totalRemainingAfter;
        if (r.status === "RELEASED") {
          this.logger.log(
            `Release-inventory: company=${r.companyId}, year=${r.targetYear}, period=${r.periodIndex}, released=${r.released}, remaining=${r.totalRemainingAfter}`,
          );
        }
      }
      if (totalRemaining === 0 && results.every((r) => r.status === "EMPTY")) {
        if (this.timer) {
          clearInterval(this.timer);
          this.timer = null;
          this.logger.log("All supplies exhausted — stopping release-inventory scheduler.");
        }
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      this.logger.error(`Release-inventory tick errored: ${msg}`);
    } finally {
      this.running = false;
    }
  }
}
