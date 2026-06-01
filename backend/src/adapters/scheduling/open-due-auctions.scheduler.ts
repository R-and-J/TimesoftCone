// OpenDueAuctionsScheduler — startedAt이 지난 CREATED 매물을 매 OPEN_INTERVAL_MS마다
// OPEN으로 승급. SettleDueAuctionsScheduler와 같은 패턴(concurrency guard, 시작 시 1회 즉시 실행).
// OPEN_INTERVAL_MS=0 이면 비활성화(테스트/수동 모드).
import {
  Injectable,
  Logger,
  OnApplicationShutdown,
  OnModuleInit,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { OpenDueAuctionsUseCase } from "@/application/auction/open-due-auctions.use-case";

const DEFAULT_INTERVAL_MS = 60_000;

@Injectable()
export class OpenDueAuctionsScheduler implements OnModuleInit, OnApplicationShutdown {
  private readonly logger = new Logger(OpenDueAuctionsScheduler.name);
  private timer: NodeJS.Timeout | null = null;
  private running = false;

  constructor(
    private readonly config: ConfigService,
    private readonly useCase: OpenDueAuctionsUseCase,
  ) {}

  onModuleInit() {
    const raw = this.config.get<string>("OPEN_INTERVAL_MS");
    const intervalMs = raw === undefined ? DEFAULT_INTERVAL_MS : Number(raw);
    if (!Number.isFinite(intervalMs) || intervalMs <= 0) {
      this.logger.warn("OPEN_INTERVAL_MS is 0 or invalid; auto-open disabled.");
      return;
    }
    this.logger.log(`Auto-open enabled (every ${intervalMs}ms)`);
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
        this.logger.log(`Tick: attempted=${r.attempted} opened=${r.opened} failed=${r.failed}`);
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      this.logger.error(`Tick errored: ${msg}`);
    } finally {
      this.running = false;
    }
  }
}
