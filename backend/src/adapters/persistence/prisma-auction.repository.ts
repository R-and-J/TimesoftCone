// PrismaAuctionRepository — maps between the Auction aggregate and the
// auction row. Domain stays free of Prisma; mapping happens here.

import { Injectable } from "@nestjs/common";
import type { Prisma } from "@prisma/client";
import { PrismaService } from "./prisma.service";
import type {
  AuctionListFilter,
  AuctionRepository,
} from "@/ports/auction-repository";
import { Auction } from "@/domain/auction/auction";
import { AuctionId } from "@/domain/shared/value-objects/auction-id";
import { Point } from "@/domain/shared/value-objects/point";
import { UserId } from "@/domain/shared/value-objects/user-id";
import type { AuctionStatus } from "@/domain/auction/auction-status";

type AuctionRow = Awaited<ReturnType<PrismaService["auction"]["findUnique"]>>;

function rowToAuction(row: NonNullable<AuctionRow>): Auction {
  return Auction.rehydrate({
    id: AuctionId.of(row.id),
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
  });
}

@Injectable()
export class PrismaAuctionRepository implements AuctionRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findById(id: AuctionId): Promise<Auction | null> {
    return this.findByIdWith(this.prisma, id);
  }

  async findByIdWith(
    tx: PrismaService | Prisma.TransactionClient,
    id: AuctionId,
  ): Promise<Auction | null> {
    const row = await tx.auction.findUnique({ where: { id: id.toString() } });
    return row ? rowToAuction(row) : null;
  }

  async list(filter: AuctionListFilter = {}): Promise<Auction[]> {
    const status = Array.isArray(filter.status)
      ? { in: filter.status }
      : filter.status
        ? { equals: filter.status }
        : undefined;
    // id가 A-YYYY-NNN 형식이라 prefix 매칭으로 연도 필터(인덱스 활용).
    const idFilter = filter.year !== undefined ? { startsWith: `A-${filter.year}-` } : undefined;

    const where: Record<string, unknown> = {};
    if (status) where.status = status;
    if (idFilter) where.id = idFilter;

    const rows = await this.prisma.auction.findMany({
      where: Object.keys(where).length > 0 ? where : undefined,
      orderBy: [{ endsAt: "asc" }, { createdAt: "asc" }],
      take: filter.limit,
    });
    return rows.map(rowToAuction);
  }

  async save(auction: Auction): Promise<void> {
    await this.saveWith(this.prisma, auction);
  }

  async saveWith(
    tx: PrismaService | Prisma.TransactionClient,
    auction: Auction,
  ): Promise<void> {
    const s = auction.snapshot();
    await tx.auction.upsert({
      where: { id: s.id.toString() },
      update: {
        status: s.status,
        highest: s.highest.toBigInt(),
        highestBidder: s.highestBidder?.toBigInt() ?? null,
        bidCount: s.bidCount,
        // anti-snipe(CUT-5)로 연장될 수 있으므로 update에도 포함.
        endsAt: s.endsAt,
        settledAt: s.settledAt,
      },
      create: {
        id: s.id.toString(),
        status: s.status,
        startPrice: s.startPrice.toBigInt(),
        highest: s.highest.toBigInt(),
        highestBidder: s.highestBidder?.toBigInt() ?? null,
        bidCount: s.bidCount,
        minIncrement: s.minIncrement.toBigInt(),
        leaveDays: s.leaveDays,
        startedAt: s.startedAt,
        endsAt: s.endsAt,
        settledAt: s.settledAt,
      },
    });
  }

  async countAuctionsBidByUser(userId: bigint): Promise<number> {
    const rows = await this.prisma.bidEvent.findMany({
      where: { userId },
      distinct: ["auctionId"],
      select: { auctionId: true },
    });
    return rows.length;
  }
}
