// SettleDueAuctionsScheduler — fires SettleDueAuctionsUseCase on a fixed
// interval (default 60s, override via SETTLE_INTERVAL_MS env var).
//
// Why setInterval instead of @nestjs/schedule?
//   - One less dependency.
//   - We only need "every N seconds" — no cron expressions.
//   - Easy to disable via env var (set SETTLE_INTERVAL_MS=0).
//
// Concurrency guard: if a previous tick is still running when the next one
// fires (slow DB, batch of many due auctions), we skip rather than stack.

import {
  Injectable,
  Logger,
  OnApplicationShutdown,
  OnModuleInit,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { SettleDueAuctionsUseCase } from "@/application/auction/settle-due-auctions.use-case";

const DEFAULT_INTERVAL_MS = 60_000;

@Injectable()
export class SettleDueAuctionsScheduler
  implements OnModuleInit, OnApplicationShutdown
{
  private readonly logger = new Logger(SettleDueAuctionsScheduler.name);
  private timer: NodeJS.Timeout | null = null;
  private running = false;

  constructor(
    private readonly config: ConfigService,
    private readonly useCase: SettleDueAuctionsUseCase,
  ) {}

  onModuleInit() {
    const raw = this.config.get<string>("SETTLE_INTERVAL_MS");
    const intervalMs = raw === undefined ? DEFAULT_INTERVAL_MS : Number(raw);

    if (!Number.isFinite(intervalMs) || intervalMs <= 0) {
      this.logger.warn(
        "SETTLE_INTERVAL_MS is 0 or invalid; auto-settlement disabled.",
      );
      return;
    }

    this.logger.log(`Auto-settlement enabled (every ${intervalMs}ms)`);
    // Fire once on startup so newly-passed auctions get settled without
    // waiting a full interval.
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
    if (this.running) {
      this.logger.debug("Previous tick still running; skipping this one.");
      return;
    }
    this.running = true;
    try {
      const r = await this.useCase.execute();
      if (r.attempted > 0) {
        this.logger.log(
          `Tick: attempted=${r.attempted} settled=${r.settled} failed=${r.failed}`,
        );
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      this.logger.error(`Tick errored: ${msg}`);
    } finally {
      this.running = false;
    }
  }
}
