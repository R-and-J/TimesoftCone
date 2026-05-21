// SettleDueAuctionsUseCase — find every OPEN auction whose endsAt has passed
// and settle each one. Called periodically by SettleDueAuctionsScheduler.
//
// Each auction is settled in its own transaction so one bad row doesn't
// block the others. The underlying SettleAuctionUseCase already holds an
// advisory lock per auction, so even if two cron ticks race, only one wins
// per auction — the loser will see the status as no-longer-OPEN and throw
// AuctionNotReadyToSettleError, which we catch and log.

import { Inject, Injectable, Logger } from "@nestjs/common";
import {
  AUCTION_REPOSITORY,
  type AuctionRepository,
} from "@/ports/auction-repository";
import { SettleAuctionUseCase } from "./settle-auction.use-case";
import type { SettleAuctionResult } from "./settle-auction.use-case";

export type SettleDueAuctionsResult = {
  attempted: number;
  settled: number;
  failed: number;
  outcomes: SettleAuctionResult[];
};

@Injectable()
export class SettleDueAuctionsUseCase {
  private readonly logger = new Logger(SettleDueAuctionsUseCase.name);

  constructor(
    @Inject(AUCTION_REPOSITORY) private readonly auctions: AuctionRepository,
    private readonly settleOne: SettleAuctionUseCase,
  ) {}

  async execute(): Promise<SettleDueAuctionsResult> {
    const now = new Date();
    // List all OPEN auctions — the repository doesn't yet have a "due" filter
    // and adding one would mean leaking date-arithmetic into the port. At
    // school-project scale the OPEN set is tiny; filter in memory.
    const openAuctions = await this.auctions.list({ status: "OPEN" });
    const due = openAuctions.filter((a) => a.snapshot().endsAt <= now);

    const outcomes: SettleAuctionResult[] = [];
    let failed = 0;

    for (const auction of due) {
      const id = auction.id.toString();
      try {
        const r = await this.settleOne.execute(id);
        outcomes.push(r);
        this.logger.log(
          `Settled ${id}: ${r.outcome}${r.outcome === "AWARDED" ? ` to userId=${r.winnerId} for ${r.amount}P` : ""}`,
        );
      } catch (err) {
        failed += 1;
        // Most likely cause: another tick already settled this auction.
        // Less common: DB error / domain error. Either way, don't crash the
        // batch — log and continue.
        const msg = err instanceof Error ? err.message : String(err);
        this.logger.warn(`Settle failed for ${id}: ${msg}`);
      }
    }

    return {
      attempted: due.length,
      settled: outcomes.length,
      failed,
      outcomes,
    };
  }
}
