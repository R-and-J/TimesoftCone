// ListRedemptionItems — 스토어 상품 카탈로그 조회 (ADR-023, 회사 스코프).

import { Injectable } from "@nestjs/common";
import { PrismaService } from "@/adapters/persistence/prisma.service";

export type RedemptionItemRow = {
  id: number;
  sku: string;
  name: string;
  brand: string | null;
  description: string | null;
  priceP: string; // bigint→string
  stock: number | null; // null = 무제한
  category: string | null;
  displayOrder: number;
};

@Injectable()
export class ListRedemptionItemsUseCase {
  constructor(private readonly prisma: PrismaService) {}

  /** companyId=null이면 super 통합(전 회사). 그 외엔 해당 회사 카탈로그만. */
  async execute(companyId: bigint | null = null): Promise<RedemptionItemRow[]> {
    const items = await this.prisma.redemptionItem.findMany({
      where: { active: true, ...(companyId !== null ? { companyId } : {}) },
      orderBy: [{ displayOrder: "asc" }, { category: "asc" }, { priceP: "asc" }, { sku: "asc" }],
    });
    return items.map((i) => ({
      id: i.id,
      sku: i.sku,
      name: i.name,
      brand: i.brand,
      description: i.description,
      priceP: i.priceP.toString(),
      stock: i.stock,
      category: i.category,
      displayOrder: i.displayOrder,
    }));
  }
}
