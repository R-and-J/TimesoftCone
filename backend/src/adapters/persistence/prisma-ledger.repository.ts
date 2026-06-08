// PrismaLedgerRepository — INSERT-only. Any attempt to UPDATE/DELETE would
// hit the SQLite trigger and fail loudly; this adapter doesn't expose
// those operations to begin with.

import { Injectable } from "@nestjs/common";
import type { Prisma } from "@prisma/client";
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
    const userId = p.userId.toBigInt();
    // 멀티테넌시: 원장 행을 사용자 회사로 태깅(에스크로 per company 정합).
    const u = await tx.user.findUnique({ where: { id: userId }, select: { companyId: true } });
    await tx.ledgerEntry.create({
      data: {
        userId,
        currency: p.currency.code,
        actionType: p.actionType,
        amount: p.amount,
        balanceAfter: p.balanceAfter.toBigInt(),
        auctionId: p.auctionId ?? null,
        refNote: p.refNote ?? null,
        companyId: u?.companyId ?? 1n,
      },
    });
  }
}
