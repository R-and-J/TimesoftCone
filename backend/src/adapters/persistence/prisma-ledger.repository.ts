// PrismaLedgerRepository — INSERT-only. Any attempt to UPDATE/DELETE would
// hit the Postgres trigger and fail loudly; this adapter doesn't expose
// those operations to begin with.

import { Injectable } from "@nestjs/common";
import type {
  Prisma,
  Currency as PrismaCurrency,
  LedgerActionType as PrismaActionType,
} from "@prisma/client";
import { PrismaService } from "./prisma.service";
import type { LedgerRepository } from "@/ports/ledger-repository";
import type { LedgerEntry } from "@/domain/ledger/ledger-entry";

@Injectable()
export class PrismaLedgerRepository implements LedgerRepository {
  constructor(private readonly prisma: PrismaService) {}

  async append(entry: LedgerEntry): Promise<void> {
    await this.appendWith(this.prisma, entry);
  }

  async appendWith(
    tx: PrismaService | Prisma.TransactionClient,
    entry: LedgerEntry,
  ): Promise<void> {
    const p = entry.props;
    await tx.ledgerEntry.create({
      data: {
        userId: p.userId.toBigInt(),
        currency: p.currency.code as PrismaCurrency,
        actionType: p.actionType as PrismaActionType,
        amount: p.amount,
        balanceAfter: p.balanceAfter.toBigInt(),
        auctionId: p.auctionId ?? null,
        refNote: p.refNote ?? null,
      },
    });
  }
}
