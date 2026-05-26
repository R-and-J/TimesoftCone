// Catch-all admin read endpoints (stats + ledger).
// RBAC NOT enforced — scope-cuts.md CUT-8.

import { Controller, Get, Query } from "@nestjs/common";
import type { LedgerActionType } from "@/domain/ledger/ledger-action-type";
import { GetAdminStatsUseCase } from "@/application/admin/get-admin-stats.use-case";
import { ListLedgerUseCase } from "@/application/admin/list-ledger.use-case";

const ALL_ACTIONS: LedgerActionType[] = [
  "BID",
  "REFUND",
  "WIN",
  "DIVIDEND",
  "CREDIT_ADMIN",
  "EXPIRE",
];

@Controller("api/admin")
export class AdminController {
  constructor(
    private readonly stats: GetAdminStatsUseCase,
    private readonly ledger: ListLedgerUseCase,
  ) {}

  @Get("stats")
  getStats() {
    return this.stats.execute();
  }

  @Get("ledger")
  listLedger(
    @Query("actionTypes") actionTypesCsv?: string,
    @Query("from") from?: string,
    @Query("to") to?: string,
    @Query("limit") limit?: string,
    @Query("cursor") cursor?: string,
  ) {
    const actionTypes = actionTypesCsv
      ? (actionTypesCsv
          .split(",")
          .filter((t) => ALL_ACTIONS.includes(t as LedgerActionType)) as LedgerActionType[])
      : undefined;

    return this.ledger.execute({
      actionTypes,
      from: from ? new Date(from) : undefined,
      to: to ? new Date(to) : undefined,
      limit: limit ? Number(limit) : undefined,
      cursor: cursor ? BigInt(cursor) : undefined,
    });
  }
}
