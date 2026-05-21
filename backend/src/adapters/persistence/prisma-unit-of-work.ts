// PrismaUnitOfWork — runs a callback inside a single Prisma $transaction,
// providing repository wrappers that all share the same tx client.
//
// scope-cuts.md CUT-1: lockAuction() acquires a Postgres advisory lock keyed
// on hashtext(auction_id). Released automatically when the tx commits or
// rolls back. No Redis needed at this scale.

import { Inject, Injectable } from "@nestjs/common";
import type { Prisma, Currency as PrismaCurrency, AuctionStatus as PrismaAuctionStatus } from "@prisma/client";
import { PrismaService } from "./prisma.service";
import { PrismaWalletRepository } from "./prisma-wallet.repository";
import { PrismaLedgerRepository } from "./prisma-ledger.repository";
import { PrismaAuctionRepository } from "./prisma-auction.repository";
import type { TxContext, UnitOfWork } from "@/ports/unit-of-work";
import type { WalletRepository } from "@/ports/wallet-repository";
import type { LedgerRepository } from "@/ports/ledger-repository";
import type { AuctionRepository } from "@/ports/auction-repository";
import type { AuctionId } from "@/domain/shared/value-objects/auction-id";
import { Wallet } from "@/domain/wallet/wallet";
import { UserId } from "@/domain/shared/value-objects/user-id";
import { Currency } from "@/domain/shared/value-objects/currency";
import { Point } from "@/domain/shared/value-objects/point";
import { Auction } from "@/domain/auction/auction";
import { AuctionId as AuctionIdVO } from "@/domain/shared/value-objects/auction-id";
import type { LedgerEntry } from "@/domain/ledger/ledger-entry";
import type { AuctionStatus } from "@/domain/auction/auction-status";

@Injectable()
export class PrismaUnitOfWork implements UnitOfWork {
  constructor(
    private readonly prisma: PrismaService,
    @Inject(PrismaWalletRepository)
    private readonly walletRepo: PrismaWalletRepository,
    @Inject(PrismaLedgerRepository)
    private readonly ledgerRepo: PrismaLedgerRepository,
    @Inject(PrismaAuctionRepository)
    private readonly auctionRepo: PrismaAuctionRepository,
  ) {}

  async run<T>(fn: (ctx: TxContext) => Promise<T>): Promise<T> {
    return this.prisma.$transaction(async (tx) => {
      const ctx = this.buildContext(tx);
      return fn(ctx);
    });
  }

  private buildContext(tx: Prisma.TransactionClient): TxContext {
    const walletRepo = this.walletRepo;
    const ledgerRepo = this.ledgerRepo;
    const auctionRepo = this.auctionRepo;

    const wallets: WalletRepository = {
      async find(userId: UserId, currency: Currency) {
        const row = await tx.wallet.findUnique({
          where: {
            uq_wallet_user_currency: {
              userId: userId.toBigInt(),
              currency: currency.code as PrismaCurrency,
            },
          },
        });
        if (!row) return null;
        return Wallet.rehydrate(userId, currency, Point.of(row.balance));
      },
      async save(wallet: Wallet) {
        await walletRepo.saveWith(tx, wallet);
      },
    };

    const ledger: LedgerRepository = {
      async append(entry: LedgerEntry) {
        await ledgerRepo.appendWith(tx, entry);
      },
    };

    const auctions: AuctionRepository = {
      async findById(id) {
        return auctionRepo.findByIdWith(tx, id);
      },
      async list(filter) {
        const status = Array.isArray(filter?.status)
          ? { in: filter!.status as PrismaAuctionStatus[] }
          : filter?.status
            ? { equals: filter.status as PrismaAuctionStatus }
            : undefined;
        const rows = await tx.auction.findMany({
          where: status ? { status } : undefined,
          orderBy: [{ endsAt: "asc" }, { createdAt: "asc" }],
          take: filter?.limit,
        });
        return rows.map((row) =>
          Auction.rehydrate({
            id: AuctionIdVO.of(row.id),
            status: row.status as AuctionStatus,
            startPrice: Point.of(row.startPrice),
            highest: Point.of(row.highest),
            highestBidder:
              row.highestBidder !== null ? UserId.of(row.highestBidder) : null,
            bidCount: row.bidCount,
            minIncrement: Point.of(row.minIncrement),
            startedAt: row.startedAt,
            endsAt: row.endsAt,
            settledAt: row.settledAt,
          }),
        );
      },
      async save(auction) {
        await auctionRepo.saveWith(tx, auction);
      },
      async countAuctionsBidByUser(userId) {
        const rows = await tx.bidEvent.findMany({
          where: { userId },
          distinct: ["auctionId"],
          select: { auctionId: true },
        });
        return rows.length;
      },
    };

    return {
      wallets,
      ledger,
      auctions,
      recordBid: async ({ auctionId, userId, amount }) => {
        await tx.bidEvent.create({
          data: {
            auctionId: auctionId.toString(),
            userId,
            amount,
          },
        });
      },
      lockAuction: async (auctionId: AuctionId) => {
        // hashtext(text) -> int4. Cast to bigint for pg_advisory_xact_lock.
        await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${auctionId.toString()})::bigint)`;
      },
    };
  }
}
