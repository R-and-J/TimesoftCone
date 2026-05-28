// YearEndDividendScheduler — 연말이 지나면 배당 배치(SettleYearEndDividendUseCase)를
// 자동으로 1회 실행한다 (ADR-008). 운영자가 12/31에 수동으로 버튼을 누르지 않아도
// 에스크로가 자동으로 지분만큼 지급된다.
//
// 설계 (SettleDueAuctionsScheduler와 동일한 setInterval 패턴):
//   - 컷오프(기본 올해 12/31 23:59) 이전이면 아무것도 안 함 — 연중 내내 안전.
//   - 컷오프 이후 첫 tick에서 실지급. 멱등성은 use case가 보장하므로
//     (이미 DIVIDEND 원장 존재 → ConflictException) 그 이후 tick은 409를
//     조용히 흘려보낸다 — 이중 지급 불가.
//
// env:
//   DIVIDEND_AUTO_ENABLED   "true"/"1" 이면 활성 (기본 비활성 — 실지급은 신중히)
//   DIVIDEND_CHECK_INTERVAL_MS  체크 주기(기본 1시간). 데모는 작게.
//   DIVIDEND_CUTOFF         실행 시작 시각 ISO 오버라이드(데모/테스트용).
//                           미지정 시 올해 12/31 23:59(로컬).

import {
  ConflictException,
  Injectable,
  Logger,
  OnApplicationShutdown,
  OnModuleInit,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { SettleYearEndDividendUseCase } from "@/application/dividend/settle-year-end-dividend.use-case";

const DEFAULT_INTERVAL_MS = 3_600_000; // 1시간

@Injectable()
export class YearEndDividendScheduler
  implements OnModuleInit, OnApplicationShutdown
{
  private readonly logger = new Logger(YearEndDividendScheduler.name);
  private timer: NodeJS.Timeout | null = null;
  private running = false;

  constructor(
    private readonly config: ConfigService,
    private readonly useCase: SettleYearEndDividendUseCase,
  ) {}

  onModuleInit() {
    const enabled = this.config.get<string>("DIVIDEND_AUTO_ENABLED");
    if (enabled !== "true" && enabled !== "1") {
      this.logger.warn(
        "Year-end dividend auto-payout disabled (set DIVIDEND_AUTO_ENABLED=true to enable).",
      );
      return;
    }

    const raw = this.config.get<string>("DIVIDEND_CHECK_INTERVAL_MS");
    const intervalMs = raw === undefined ? DEFAULT_INTERVAL_MS : Number(raw);
    if (!Number.isFinite(intervalMs) || intervalMs <= 0) {
      this.logger.warn(
        "DIVIDEND_CHECK_INTERVAL_MS is 0 or invalid; auto-payout disabled.",
      );
      return;
    }

    this.logger.log(
      `Year-end dividend auto-payout enabled (check every ${intervalMs}ms, cutoff=${this.cutoff().toISOString()})`,
    );
    // 시작 시 1회 — 이미 컷오프가 지난 채로 부팅했으면 즉시 지급.
    void this.tick();
    this.timer = setInterval(() => void this.tick(), intervalMs);
  }

  onApplicationShutdown() {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
  }

  /** 실행 시작 시각. 오버라이드 없으면 올해 12/31 23:59(로컬). */
  private cutoff(): Date {
    const override = this.config.get<string>("DIVIDEND_CUTOFF");
    if (override) {
      const d = new Date(override);
      if (!Number.isNaN(d.getTime())) return d;
      this.logger.warn(`DIVIDEND_CUTOFF "${override}" 파싱 실패 — 기본값(12/31) 사용`);
    }
    return new Date(new Date().getFullYear(), 11, 31, 23, 59, 0);
  }

  private async tick(): Promise<void> {
    if (this.running) {
      this.logger.debug("Previous tick still running; skipping this one.");
      return;
    }
    if (new Date() < this.cutoff()) return; // 아직 연말 아님 — 대기

    this.running = true;
    try {
      const r = await this.useCase.execute(); // dryRun=false → 실지급
      this.logger.log(
        `Year-end dividend paid: ${r.lines.length} recipients, total=${r.totalDistributed} (escrow=${r.escrowBalance})`,
      );
    } catch (err) {
      // 이미 정산됨(멱등) — 정상 경로이므로 조용히 종료, 타이머는 계속 돌되 매번 409.
      if (err instanceof ConflictException) {
        this.logger.debug("Already settled; nothing to pay.");
        // 한 번 정산됐으면 더 돌 이유가 없으니 타이머를 멈춘다.
        if (this.timer) {
          clearInterval(this.timer);
          this.timer = null;
          this.logger.log("Dividend already settled — stopping scheduler.");
        }
        return;
      }
      const msg = err instanceof Error ? err.message : String(err);
      this.logger.error(`Year-end dividend tick errored: ${msg}`);
    } finally {
      this.running = false;
    }
  }
}
