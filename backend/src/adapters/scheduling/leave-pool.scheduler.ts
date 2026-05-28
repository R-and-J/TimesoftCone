// LeavePoolScheduler — 연말이 지나면 풀 수집 배치(CollectLeavePoolUseCase)를
// 자동으로 1회 실행한다 (ADR-017). 운영자가 12/31에 수동으로 버튼을 누르지 않아도
// REGULAR 미사용 연차가 자동으로 익년도 매물 + Stake로 변환된다.
//
// 설계 (YearEndDividendScheduler와 동일한 setInterval 패턴):
//   - 컷오프(기본 올해 12/31 23:59) 이전이면 아무것도 안 함 — 연중 내내 안전.
//   - 컷오프 이후 첫 tick에서 실수집. 멱등성은 use case가 보장하므로
//     (이미 leave_pool_run 존재 → ConflictException) 그 이후는 타이머를
//     스스로 멈춰 무의미한 반복 호출을 차단한다.
//
// env:
//   LEAVEPOOL_AUTO_ENABLED       "true"/"1" 이면 활성 (기본 비활성 — 실수집은 신중히)
//   LEAVEPOOL_CHECK_INTERVAL_MS  체크 주기(기본 1시간). 데모는 작게.
//   LEAVEPOOL_CUTOFF             실행 시작 시각 ISO 오버라이드(데모/테스트용).
//                                미지정 시 올해 12/31 23:59(로컬).

import {
  ConflictException,
  Injectable,
  Logger,
  OnApplicationShutdown,
  OnModuleInit,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { CollectLeavePoolUseCase } from "@/application/leave-pool/collect-leave-pool.use-case";

const DEFAULT_INTERVAL_MS = 3_600_000; // 1시간

@Injectable()
export class LeavePoolScheduler implements OnModuleInit, OnApplicationShutdown {
  private readonly logger = new Logger(LeavePoolScheduler.name);
  private timer: NodeJS.Timeout | null = null;
  private running = false;

  constructor(
    private readonly config: ConfigService,
    private readonly useCase: CollectLeavePoolUseCase,
  ) {}

  onModuleInit() {
    const enabled = this.config.get<string>("LEAVEPOOL_AUTO_ENABLED");
    if (enabled !== "true" && enabled !== "1") {
      this.logger.warn(
        "Year-end leave-pool auto-collect disabled (set LEAVEPOOL_AUTO_ENABLED=true to enable).",
      );
      return;
    }

    const raw = this.config.get<string>("LEAVEPOOL_CHECK_INTERVAL_MS");
    const intervalMs = raw === undefined ? DEFAULT_INTERVAL_MS : Number(raw);
    if (!Number.isFinite(intervalMs) || intervalMs <= 0) {
      this.logger.warn(
        "LEAVEPOOL_CHECK_INTERVAL_MS is 0 or invalid; auto-collect disabled.",
      );
      return;
    }

    this.logger.log(
      `Year-end leave-pool auto-collect enabled (check every ${intervalMs}ms, cutoff=${this.cutoff().toISOString()})`,
    );
    // 시작 시 1회 — 이미 컷오프가 지난 채로 부팅했으면 즉시 수집.
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
    const override = this.config.get<string>("LEAVEPOOL_CUTOFF");
    if (override) {
      const d = new Date(override);
      if (!Number.isNaN(d.getTime())) return d;
      this.logger.warn(`LEAVEPOOL_CUTOFF "${override}" 파싱 실패 — 기본값(12/31) 사용`);
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
      // sourceYear는 use case가 기본값(=올해)으로 처리. targetYear = sourceYear+1.
      const r = await this.useCase.execute();
      this.logger.log(
        `Year-end leave-pool collected: targetYear=${r.targetYear}, contributors=${r.contributorCount}, days=${r.daysCollected}, auctions=${r.auctionsCreated}`,
      );
      // 한 번 수집됐으면 더 돌 이유 없음 — 멱등 신호를 받기 전에 선제 정지.
      if (this.timer) {
        clearInterval(this.timer);
        this.timer = null;
        this.logger.log("Leave-pool collected — stopping scheduler.");
      }
    } catch (err) {
      // 이미 수집됨(멱등) — 정상 경로이므로 타이머 정지하고 종료.
      if (err instanceof ConflictException) {
        this.logger.debug("Already collected; nothing to do.");
        if (this.timer) {
          clearInterval(this.timer);
          this.timer = null;
          this.logger.log("Leave-pool already collected — stopping scheduler.");
        }
        return;
      }
      const msg = err instanceof Error ? err.message : String(err);
      this.logger.error(`Leave-pool tick errored: ${msg}`);
    } finally {
      this.running = false;
    }
  }
}
