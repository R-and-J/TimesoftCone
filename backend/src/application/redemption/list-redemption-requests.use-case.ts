// ListRedemptionRequests — 사용자 자기 / 관리자 전체(필터). 상품·결정자 이름 동봉.

import { Injectable } from "@nestjs/common";
import { PrismaService } from "@/adapters/persistence/prisma.service";

export type RedemptionRequestRow = {
  id: number;
  userId: string;
  userName: string;
  itemId: number;
  itemName: string;
  pricePAtRequest: string;
  note: string | null;
  status: "PENDING" | "APPROVED" | "RECEIVED" | "REJECTED";
  couponCode: string | null;
  decidedByName: string | null;
  decidedAt: Date | null;
  decisionNote: string | null;
  receivedAt: Date | null;
  createdAt: Date;
};

type Status = "PENDING" | "APPROVED" | "RECEIVED" | "REJECTED";

@Injectable()
export class ListRedemptionRequestsUseCase {
  constructor(private readonly prisma: PrismaService) {}

  async forUser(userId: bigint, limit = 30): Promise<RedemptionRequestRow[]> {
    const rows = await this.prisma.redemptionRequest.findMany({
      where: { userId },
      orderBy: { createdAt: "desc" },
      take: limit,
      include: {
        user: { select: { name: true } },
        decidedByUser: { select: { name: true } },
        item: { select: { name: true } },
      },
    });
    return rows.map(this.toRow);
  }

  async forAdmin(status?: Status, limit = 50): Promise<RedemptionRequestRow[]> {
    const rows = await this.prisma.redemptionRequest.findMany({
      where: status ? { status } : undefined,
      orderBy: { createdAt: "desc" },
      take: limit,
      include: {
        user: { select: { name: true } },
        decidedByUser: { select: { name: true } },
        item: { select: { name: true } },
      },
    });
    return rows.map(this.toRow);
  }

  private toRow = (r: {
    id: number;
    userId: bigint;
    itemId: number;
    pricePAtRequest: bigint;
    note: string | null;
    status: string;
    couponCode: string | null;
    decidedAt: Date | null;
    decisionNote: string | null;
    receivedAt: Date | null;
    createdAt: Date;
    user: { name: string };
    decidedByUser: { name: string } | null;
    item: { name: string };
  }): RedemptionRequestRow => ({
    id: r.id,
    userId: String(r.userId),
    userName: r.user.name,
    itemId: r.itemId,
    itemName: r.item.name,
    pricePAtRequest: r.pricePAtRequest.toString(),
    note: r.note,
    status: r.status as Status,
    couponCode: r.couponCode,
    decidedByName: r.decidedByUser?.name ?? null,
    decidedAt: r.decidedAt,
    decisionNote: r.decisionNote,
    receivedAt: r.receivedAt,
    createdAt: r.createdAt,
  });
}
