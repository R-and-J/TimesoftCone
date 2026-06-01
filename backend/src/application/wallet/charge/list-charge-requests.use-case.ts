// ListChargeRequests — 사용자 자기 목록 / 관리자 전체(필터). 이름·결정자명 포함.

import { Injectable } from "@nestjs/common";
import { PrismaService } from "@/adapters/persistence/prisma.service";

export type ChargeRequestRow = {
  id: number;
  userId: string;
  userName: string;
  amount: string;
  note: string | null;
  status: "PENDING" | "APPROVED" | "REJECTED";
  decidedByName: string | null;
  decidedAt: Date | null;
  decisionNote: string | null;
  createdAt: Date;
};

type Status = "PENDING" | "APPROVED" | "REJECTED";

@Injectable()
export class ListChargeRequestsUseCase {
  constructor(private readonly prisma: PrismaService) {}

  /** 사용자 자기 요청 목록(최근). */
  async forUser(userId: bigint, limit = 30): Promise<ChargeRequestRow[]> {
    const rows = await this.prisma.chargeRequest.findMany({
      where: { userId },
      orderBy: { createdAt: "desc" },
      take: limit,
      include: {
        user: { select: { name: true } },
        decidedByUser: { select: { name: true } },
      },
    });
    return rows.map(this.toRow);
  }

  /** 관리자 — status 필터(미지정 = 전체, 최근순). */
  async forAdmin(status?: Status, limit = 50): Promise<ChargeRequestRow[]> {
    const rows = await this.prisma.chargeRequest.findMany({
      where: status ? { status } : undefined,
      orderBy: { createdAt: "desc" },
      take: limit,
      include: {
        user: { select: { name: true } },
        decidedByUser: { select: { name: true } },
      },
    });
    return rows.map(this.toRow);
  }

  private toRow = (r: {
    id: number; userId: bigint; amount: bigint; note: string | null; status: string;
    decidedAt: Date | null; decisionNote: string | null; createdAt: Date;
    user: { name: string }; decidedByUser: { name: string } | null;
  }): ChargeRequestRow => ({
    id: r.id,
    userId: String(r.userId),
    userName: r.user.name,
    amount: r.amount.toString(),
    note: r.note,
    status: r.status as Status,
    decidedByName: r.decidedByUser?.name ?? null,
    decidedAt: r.decidedAt,
    decisionNote: r.decisionNote,
    createdAt: r.createdAt,
  });
}
