// OpenDueAuctionsUseCase — startedAt이 지난 CREATED 매물을 OPEN으로 자동 승급.
// 분산 정책이 startedAt을 미래 시각으로 박아둔 매물(예약된 "오픈 예정")이
// 시간이 되면 별다른 관리자 액션 없이 OPEN으로 넘어가도록 한다.
// SettleDueAuctionsScheduler와 같은 패턴으로 OpenDueAuctionsScheduler가 매분 호출.
import { Inject, Injectable, Logger } from "@nestjs/common";
import { AUCTION_REPOSITORY, type AuctionRepository } from "@/ports/auction-repository";

export type OpenDueAuctionsResult = {
  attempted: number;
  opened: number;
  failed: number;
  errors: { auctionId: string; reason: string }[];
};

@Injectable()
export class OpenDueAuctionsUseCase {
  private readonly logger = new Logger(OpenDueAuctionsUseCase.name);

  constructor(
    @Inject(AUCTION_REPOSITORY) private readonly auctions: AuctionRepository,
  ) {}

  async execute(): Promise<OpenDueAuctionsResult> {
    const now = new Date();
    // status=CREATED 만. list()의 endsAt asc 정렬은 그대로 사용(어차피 OPEN 전이라 영향 없음).
    const candidates = await this.auctions.list({ status: "CREATED" });
    const due = candidates.filter((a) => a.startedAt <= now);

    const result: OpenDueAuctionsResult = { attempted: due.length, opened: 0, failed: 0, errors: [] };
    for (const a of due) {
      try {
        a.open(now);
        await this.auctions.save(a);
        result.opened += 1;
      } catch (e) {
        result.failed += 1;
        const msg = e instanceof Error ? e.message : String(e);
        result.errors.push({ auctionId: a.id.toString(), reason: msg });
        this.logger.warn(`open failed ${a.id.toString()}: ${msg}`);
      }
    }
    return result;
  }
}
