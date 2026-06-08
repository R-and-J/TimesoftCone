// ListLedger — paginated, filterable read of ledger_entry for AdminLedger
// screen. Read-only by definition (DB-RULE-1).
//
// This is a pure projection; we don't go through the LedgerRepository port
// (which is append-only by design) and instead read Prisma directly. That's
// fine — see ADR-012 §"read models" exception.

import { Injectable } from "@nestjs/common";
import type { Prisma } from "@prisma/client";
import type { LedgerActionType } from "@/domain/ledger/ledger-action-type";
import { PrismaService } from "@/adapters/persistence/prisma.service";

export type ListLedgerInput = {
  actionTypes?: LedgerActionType[];
  from?: Date;
  to?: Date;
  limit?: number;
  cursor?: bigint;
  /** 회사 스코프(멀티테넌시). null=전 회사(super ADMIN). */
  companyId?: bigint | null;
};

export type LedgerRow = {
  id: bigint;
  occurredAt: Date;
  userId: bigint;
  userName: string;
  currency: string;
  actionType: string;
  amount: bigint;
  balanceAfter: bigint;
  auctionId: string | null;
  refNote: string | null;
};

export type ListLedgerResult = {
  rows: LedgerRow[];
  nextCursor: bigint | null;
  totalEstimate: number;
};

const DEFAULT_LIMIT = 50;
const MAX_LIMIT = 200;

@Injectable()
export class ListLedgerUseCase {
  constructor(private readonly prisma: PrismaService) {}

  async execute(input: ListLedgerInput = {}): Promise<ListLedgerResult> {
    const limit = Math.min(input.limit ?? DEFAULT_LIMIT, MAX_LIMIT);

    const where: Prisma.LedgerEntryWhereInput = {};
    if (input.companyId != null) where.companyId = input.companyId;
    if (input.actionTypes && input.actionTypes.length > 0) {
      where.actionType = { in: input.actionTypes };
    }
    if (input.from || input.to) {
      where.occurredAt = {};
      if (input.from) where.occurredAt.gte = input.from;
      if (input.to) where.occurredAt.lte = input.to;
    }

    const [rows, total] = await Promise.all([
      this.prisma.ledgerEntry.findMany({
        where,
        orderBy: { id: "desc" },
        take: limit + 1, // fetch one extra to know if there's more
        cursor: input.cursor ? { id: input.cursor } : undefined,
        skip: input.cursor ? 1 : 0,
        include: { user: { select: { name: true } } },
      }),
      this.prisma.ledgerEntry.count({ where }),
    ]);

    const hasMore = rows.length > limit;
    const page = hasMore ? rows.slice(0, limit) : rows;

    return {
      rows: page.map((r) => ({
        id: r.id,
        occurredAt: r.occurredAt,
        userId: r.userId,
        userName: r.user.name,
        currency: r.currency,
        actionType: r.actionType,
        amount: r.amount,
        balanceAfter: r.balanceAfter,
        auctionId: r.auctionId,
        refNote: r.refNote,
      })),
      nextCursor: hasMore ? page[page.length - 1].id : null,
      totalEstimate: total,
    };
  }
}
