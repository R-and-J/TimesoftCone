// ListMyRedemptionOrders — 내가 교환한 주문 내역(상품명 포함).

import { Injectable } from "@nestjs/common";
import { PrismaService } from "@/adapters/persistence/prisma.service";

export type RedemptionOrderRow = {
  id: number;
  itemName: string;
  itemSku: string;
  pricePAtRedeem: string;
  status: "PENDING" | "FULFILLED" | "FAILED" | "REFUNDED";
  deliveryRef: string | null;
  createdAt: Date;
};

@Injectable()
export class ListMyRedemptionOrdersUseCase {
  constructor(private readonly prisma: PrismaService) {}

  async execute(userIdRaw: bigint | string | number, limit = 30): Promise<RedemptionOrderRow[]> {
    const userId = BigInt(userIdRaw);
    const rows = await this.prisma.redemptionOrder.findMany({
      where: { userId },
      orderBy: { createdAt: "desc" },
      take: limit,
      include: { item: { select: { name: true, sku: true } } },
    });
    return rows.map((r) => ({
      id: r.id,
      itemName: r.item.name,
      itemSku: r.item.sku,
      pricePAtRedeem: r.pricePAtRedeem.toString(),
      status: r.status as RedemptionOrderRow["status"],
      deliveryRef: r.deliveryRef,
      createdAt: r.createdAt,
    }));
  }
}
