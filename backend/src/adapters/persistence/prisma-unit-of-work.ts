// PrismaUnitOfWork — runs a callback inside a single Prisma $transaction,
// providing repository wrappers that all share the same tx client.
//
// scope-cuts.md CUT-1: lockAuction() serializes concurrent bids on the same
// auction. SQLite has no row locks, so it issues a no-op UPDATE that takes the
// database write lock for the transaction; held until commit/rollback. No Redis
// needed at this scale.

import { Inject, Injectable } from "@nestjs/common";
import type { Prisma } from "@prisma/client";
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
              currency: currency.code,
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
          ? { in: filter!.status }
          : filter?.status
            ? { equals: filter.status }
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
            leaveDays: row.leaveDays,
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
        // SQLite has no row-level locks (no `SELECT … FOR UPDATE`). A no-op
        // UPDATE on the target row takes SQLite's database write lock for this
        // transaction, serializing concurrent bids on the same auction.
        // Auto-released on commit/rollback. scope-cuts.md CUT-1 (SQLite variant).
        await tx.$executeRaw`UPDATE auction SET id = id WHERE id = ${auctionId.toString()}`;
      },
      grantAuctionLeave: async ({ userId, year, days }) => {
        // 낙찰 연차는 AUCTION 타입으로 우리 DB에만 적립 (ADR-002/020). ezpass엔
        // 안 보냄 — 이중보상 방지. 같은 정산 트랜잭션 안에서 원자적으로 처리.
        await tx.leaveBalance.upsert({
          where: { uq_leave_user_year_type: { userId, year, leaveType: "AUCTION" } },
          update: { adjustedDays: { increment: days } },
          create: { userId, year, leaveType: "AUCTION", grantedDays: 0, adjustedDays: days, usedDays: 0 },
        });
      },
      enqueueOutbox: async ({ topic, payload }) => {
        // 트랜잭션 아웃박스(ADR-005/013): 도메인 변경과 같은 tx에 메시지 적재.
        // 커밋돼야 메시지도 남음 → relay가 나중에 외부로 전송(재시도/DLQ).
        await tx.outboxMessage.create({
          data: { topic, payload: JSON.stringify(payload) },
        });
      },
    };
  }
}
