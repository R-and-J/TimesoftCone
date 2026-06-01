// ListRedemptionItems — 스토어 상품 카탈로그 조회 (ADR-023).

import { Injectable } from "@nestjs/common";
import { PrismaService } from "@/adapters/persistence/prisma.service";

export type RedemptionItemRow = {
  id: number;
  sku: string;
  name: string;
  description: string | null;
  priceP: string; // bigint→string
  stock: number | null; // null = 무제한
  category: string | null;
};

@Injectable()
export class ListRedemptionItemsUseCase {
  constructor(private readonly prisma: PrismaService) {}

  async execute(): Promise<RedemptionItemRow[]> {
    const items = await this.prisma.redemptionItem.findMany({
      where: { active: true },
      orderBy: [{ category: "asc" }, { priceP: "asc" }, { sku: "asc" }],
    });
    return items.map((i) => ({
      id: i.id,
      sku: i.sku,
      name: i.name,
      description: i.description,
      priceP: i.priceP.toString(),
      stock: i.stock,
      category: i.category,
    }));
  }
}
