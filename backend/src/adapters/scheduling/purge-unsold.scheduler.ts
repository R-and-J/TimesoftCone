// PurgeUnsoldAuctionsScheduler — 연말이 지나면 그 해 UNSOLD 재고를 영구 삭제(FR-4.2).
// 패턴은 YearEndDividendScheduler / LeavePoolScheduler와 동일(setInterval + 컷오프 게이트
// + 멱등 선제 정지). 한 번 비우면 더 돌릴 이유 없으니 타이머 정지.
//
// env:
//   PURGE_UNSOLD_AUTO_ENABLED     true/1 이면 활성 (기본 비활성 — 영구 삭제는 신중히)
//   PURGE_UNSOLD_CHECK_INTERVAL_MS 체크 주기(ms, 기본 1시간)
//   PURGE_UNSOLD_CUTOFF           실행 시각 ISO 오버라이드(데모/테스트용)

import {
  Injectable,
  Logger,
  OnApplicationShutdown,
  OnModuleInit,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { PurgeUnsoldAuctionsUseCase } from "@/application/leave/purge-unsold-auctions.use-case";

const DEFAULT_INTERVAL_MS = 3_600_000;

@Injectable()
export class PurgeUnsoldAuctionsScheduler implements OnModuleInit, OnApplicationShutdown {
  private readonly logger = new Logger(PurgeUnsoldAuctionsScheduler.name);
  private timer: NodeJS.Timeout | null = null;
  private running = false;

  constructor(
    private readonly config: ConfigService,
    private readonly useCase: PurgeUnsoldAuctionsUseCase,
  ) {}

  onModuleInit() {
    const enabled = this.config.get<string>("PURGE_UNSOLD_AUTO_ENABLED");
    if (enabled !== "true" && enabled !== "1") {
      this.logger.warn(
        "Year-end unsold-purge auto-run disabled (set PURGE_UNSOLD_AUTO_ENABLED=true to enable).",
      );
      return;
    }
    const raw = this.config.get<string>("PURGE_UNSOLD_CHECK_INTERVAL_MS");
    const intervalMs = raw === undefined ? DEFAULT_INTERVAL_MS : Number(raw);
    if (!Number.isFinite(intervalMs) || intervalMs <= 0) {
      this.logger.warn("PURGE_UNSOLD_CHECK_INTERVAL_MS is 0 or invalid; auto-run disabled.");
      return;
    }
    this.logger.log(
      `Year-end unsold-purge auto-run enabled (check every ${intervalMs}ms, cutoff=${this.cutoff().toISOString()})`,
    );
    void this.tick();
    this.timer = setInterval(() => void this.tick(), intervalMs);
  }

  onApplicationShutdown() {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
  }

  private cutoff(): Date {
    const override = this.config.get<string>("PURGE_UNSOLD_CUTOFF");
    if (override) {
      const d = new Date(override);
      if (!Number.isNaN(d.getTime())) return d;
      this.logger.warn(`PURGE_UNSOLD_CUTOFF "${override}" 파싱 실패 — 기본값(12/31) 사용`);
    }
    return new Date(new Date().getFullYear(), 11, 31, 23, 59, 0);
  }

  private async tick(): Promise<void> {
    if (this.running) return;
    if (new Date() < this.cutoff()) return;
    this.running = true;
    try {
      const r = await this.useCase.execute();
      this.logger.log(`Year-end unsold purged: ${r.deleted} auctions (upToYear=${r.upToYear})`);
      // 한 번 비우면 더 돌 이유 없으니 자체 정지.
      if (this.timer) {
        clearInterval(this.timer);
        this.timer = null;
        this.logger.log("Unsold purged — stopping scheduler.");
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      this.logger.error(`Unsold-purge tick errored: ${msg}`);
    } finally {
      this.running = false;
    }
  }
}
