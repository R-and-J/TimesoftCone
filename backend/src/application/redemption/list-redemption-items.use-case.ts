// ListRedemptionItems — 스쿱 마켓 상품 카탈로그 조회 (ADR-023, 회사 스코프).
// 예외 1건: "원하는대로 담기"(sku=CUSTOM-WISH)는 자유 제안용 placeholder이므로
// 회사 무관 universal 아이템으로 모든 회사 카탈로그에 노출한다.
// (submit-custom-redemption은 sku만으로 단일 row를 찾고 request는 user.companyId로 INSERT — 정합 OK.)

import { Injectable } from "@nestjs/common";
import { PrismaService } from "@/adapters/persistence/prisma.service";
import { CUSTOM_WISH_SKU } from "./submit-custom-redemption-request.use-case";

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

  /** companyId=null이면 super 통합(전 회사). 그 외엔 해당 회사 카탈로그만 + CUSTOM-WISH(범용). */
  async execute(companyId: bigint | null = null): Promise<RedemptionItemRow[]> {
    const items = await this.prisma.redemptionItem.findMany({
      where: {
        active: true,
        ...(companyId !== null
          ? { OR: [{ companyId }, { sku: CUSTOM_WISH_SKU }] }
          : {}),
      },
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
