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
    if (filter.companyId != null) where.companyId = filter.companyId;

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
        // 관리자 오픈 시 configureBeforeOpen으로 변경 가능한 필드 — CREATED 한정.
        startPrice: s.startPrice.toBigInt(),
        minIncrement: s.minIncrement.toBigInt(),
        leaveDays: s.leaveDays,
        startedAt: s.startedAt,
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

  async deleteCreated(
    ids: AuctionId[],
  ): Promise<{ deletedIds: string[]; skippedIds: string[]; protectedIds: string[] }> {
    if (ids.length === 0) return { deletedIds: [], skippedIds: [], protectedIds: [] };
    const idStrs = ids.map((i) => i.toString());
    return await this.prisma.$transaction(async (tx) => {
      // 풀 수집(LeavePoolRun)에 속한 매물은 삭제하지 않는다. 매물 id 형식이
      // "A-{targetYear}-NNN"이라 run 마커의 targetYear set으로 prefix 판정.
      // (학교 프로젝트 단순화 — 그 해에 수동 추가된 매물도 보호 받지만, 안전한 쪽으로.)
      const runs = await tx.leavePoolRun.findMany({ select: { targetYear: true } });
      const protectedYears = new Set(runs.map((r) => r.targetYear));
      const isPoolId = (id: string) => {
        const m = /^A-(\d{4})-/.exec(id);
        return m ? protectedYears.has(Number(m[1])) : false;
      };
      const protectedIds = idStrs.filter(isPoolId);
      const candidateIds = idStrs.filter((id) => !isPoolId(id));
      if (candidateIds.length === 0) {
        return { deletedIds: [], skippedIds: [], protectedIds };
      }
      // 남은 후보 중 DRAFT/CREATED만 실제 삭제. 그 외 상태(OPEN+)는 skipped.
      const eligible = await tx.auction.findMany({
        where: { id: { in: candidateIds }, status: { in: ["DRAFT", "CREATED"] } },
        select: { id: true },
      });
      const eligibleIds = eligible.map((r) => r.id);
      if (eligibleIds.length > 0) {
        await tx.auction.deleteMany({ where: { id: { in: eligibleIds } } });
      }
      const skipped = candidateIds.filter((id) => !eligibleIds.includes(id));
      return { deletedIds: eligibleIds, skippedIds: skipped, protectedIds };
    });
  }

  async countsByStatus(): Promise<Record<AuctionStatus, number>> {
    const rows = await this.prisma.auction.groupBy({
      by: ["status"],
      _count: { _all: true },
    });
    const init: Record<AuctionStatus, number> = {
      DRAFT: 0,
      CREATED: 0,
      OPEN: 0,
      AWARDED: 0,
      UNSOLD: 0,
    };
    for (const r of rows) {
      const k = r.status as AuctionStatus;
      if (k in init) init[k] = r._count._all;
    }
    return init;
  }

  async nextIdForYear(year: number): Promise<string> {
    // id가 "A-YYYY-NNN..." 형식이라 LIKE prefix 매칭 후 suffix 파싱이 단순·결정적.
    const rows = await this.prisma.auction.findMany({
      where: { id: { startsWith: `A-${year}-` } },
      select: { id: true },
    });
    let maxN = 0;
    const prefix = `A-${year}-`;
    for (const r of rows) {
      const n = Number.parseInt(r.id.slice(prefix.length), 10);
      if (Number.isFinite(n) && n > maxN) maxN = n;
    }
    const next = String(maxN + 1).padStart(3, "0");
    return `${prefix}${next}`;
  }
}
