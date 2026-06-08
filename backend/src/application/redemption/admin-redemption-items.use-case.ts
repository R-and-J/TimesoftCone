// 스쿱 마켓 관리(2026-06-04) — Admin CRUD UseCase 묶음.
// 회사 스코프: super(null)는 전 회사, 그 외엔 자기 회사 카탈로그.
// 모든 쓰기 작업은 redemption_item_audit에 같은 트랜잭션으로 1행씩 기록한다.

import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import type { Prisma, RedemptionItem } from "@prisma/client";
import { PrismaService } from "@/adapters/persistence/prisma.service";

export type AdminItemRow = {
  id: number;
  sku: string;
  name: string;
  brand: string | null;
  description: string | null;
  priceP: string;
  stock: number | null;
  category: string | null;
  displayOrder: number;
  active: boolean;
  companyId: string;
  createdAt: string;
  updatedAt: string;
};

export type AuditRow = {
  id: number;
  itemId: number;
  actorUserId: string | null;
  action: string;
  before: unknown | null;
  after: unknown | null;
  createdAt: string;
};

type Snapshot = {
  name: string;
  brand: string | null;
  description: string | null;
  priceP: string;
  stock: number | null;
  category: string | null;
  displayOrder: number;
  active: boolean;
};

function snapshot(i: RedemptionItem): Snapshot {
  return {
    name: i.name,
    brand: i.brand,
    description: i.description,
    priceP: i.priceP.toString(),
    stock: i.stock,
    category: i.category,
    displayOrder: i.displayOrder,
    active: i.active,
  };
}

function toRow(i: RedemptionItem): AdminItemRow {
  return {
    id: i.id,
    sku: i.sku,
    name: i.name,
    brand: i.brand,
    description: i.description,
    priceP: i.priceP.toString(),
    stock: i.stock,
    category: i.category,
    displayOrder: i.displayOrder,
    active: i.active,
    companyId: i.companyId.toString(),
    createdAt: i.createdAt.toISOString(),
    updatedAt: i.updatedAt.toISOString(),
  };
}

@Injectable()
export class AdminListRedemptionItemsUseCase {
  constructor(private readonly prisma: PrismaService) {}

  /** 비활성도 포함, 회사 스코프. super(null)면 전 회사. */
  async execute(companyId: bigint | null): Promise<AdminItemRow[]> {
    const items = await this.prisma.redemptionItem.findMany({
      where: companyId !== null ? { companyId } : {},
      orderBy: [{ displayOrder: "asc" }, { category: "asc" }, { priceP: "asc" }, { sku: "asc" }],
    });
    return items.map(toRow);
  }
}

export type CreateItemInput = {
  sku: string;
  name: string;
  brand?: string | null;
  description?: string | null;
  priceP: bigint | number | string;
  stock?: number | null;
  category?: string | null;
  displayOrder?: number;
  active?: boolean;
};

@Injectable()
export class CreateRedemptionItemUseCase {
  constructor(private readonly prisma: PrismaService) {}

  async execute(
    companyId: bigint,
    actorUserId: bigint,
    input: CreateItemInput,
  ): Promise<AdminItemRow> {
    const priceP = BigInt(input.priceP);
    if (priceP <= 0n) throw new BadRequestException("priceP는 0보다 커야 합니다");
    if (!input.sku.trim()) throw new BadRequestException("sku는 필수입니다");
    if (!input.name.trim()) throw new BadRequestException("name은 필수입니다");

    try {
      return await this.prisma.$transaction(async (tx) => {
        const created = await tx.redemptionItem.create({
          data: {
            companyId,
            sku: input.sku.trim(),
            name: input.name.trim(),
            brand: input.brand?.trim() || null,
            description: input.description?.trim() || null,
            priceP,
            stock: input.stock ?? null,
            category: input.category?.trim() || null,
            displayOrder: input.displayOrder ?? 0,
            active: input.active ?? true,
          },
        });
        await tx.redemptionItemAudit.create({
          data: {
            itemId: created.id,
            companyId,
            actorUserId,
            action: "CREATE",
            after: JSON.stringify(snapshot(created)),
          },
        });
        return toRow(created);
      });
    } catch (e) {
      if (e && typeof e === "object" && "code" in e && (e as Prisma.PrismaClientKnownRequestError).code === "P2002") {
        throw new ConflictException(`sku "${input.sku}" 가 이미 존재합니다`);
      }
      throw e;
    }
  }
}

export type UpdateItemInput = {
  name?: string;
  brand?: string | null;
  description?: string | null;
  priceP?: bigint | number | string;
  stock?: number | null;
  category?: string | null;
  displayOrder?: number;
};

@Injectable()
export class UpdateRedemptionItemUseCase {
  constructor(private readonly prisma: PrismaService) {}

  async execute(
    companyId: bigint | null,
    actorUserId: bigint,
    id: number,
    input: UpdateItemInput,
  ): Promise<AdminItemRow> {
    return this.prisma.$transaction(async (tx) => {
      const before = await tx.redemptionItem.findUnique({ where: { id } });
      if (!before) throw new NotFoundException(`Item ${id} not found`);
      if (companyId !== null && before.companyId !== companyId) {
        throw new NotFoundException(`Item ${id} not found in scope`);
      }
      const data: Prisma.RedemptionItemUpdateInput = {};
      if (input.name !== undefined) {
        if (!input.name.trim()) throw new BadRequestException("name은 빈 값일 수 없습니다");
        data.name = input.name.trim();
      }
      if (input.brand !== undefined) data.brand = input.brand?.trim() || null;
      if (input.description !== undefined) data.description = input.description?.trim() || null;
      if (input.priceP !== undefined) {
        const p = BigInt(input.priceP);
        if (p <= 0n) throw new BadRequestException("priceP는 0보다 커야 합니다");
        data.priceP = p;
      }
      if (input.stock !== undefined) data.stock = input.stock;
      if (input.category !== undefined) data.category = input.category?.trim() || null;
      if (input.displayOrder !== undefined) data.displayOrder = input.displayOrder;

      const after = await tx.redemptionItem.update({ where: { id }, data });
      await tx.redemptionItemAudit.create({
        data: {
          itemId: id,
          companyId: before.companyId,
          actorUserId,
          action: "UPDATE",
          before: JSON.stringify(snapshot(before)),
          after: JSON.stringify(snapshot(after)),
        },
      });
      return toRow(after);
    });
  }
}

@Injectable()
export class SetRedemptionItemActiveUseCase {
  constructor(private readonly prisma: PrismaService) {}

  async execute(
    companyId: bigint | null,
    actorUserId: bigint,
    id: number,
    active: boolean,
  ): Promise<AdminItemRow> {
    return this.prisma.$transaction(async (tx) => {
      const before = await tx.redemptionItem.findUnique({ where: { id } });
      if (!before) throw new NotFoundException(`Item ${id} not found`);
      if (companyId !== null && before.companyId !== companyId) {
        throw new NotFoundException(`Item ${id} not found in scope`);
      }
      if (before.active === active) return toRow(before);
      const after = await tx.redemptionItem.update({ where: { id }, data: { active } });
      await tx.redemptionItemAudit.create({
        data: {
          itemId: id,
          companyId: before.companyId,
          actorUserId,
          action: active ? "ACTIVATE" : "DEACTIVATE",
          before: JSON.stringify(snapshot(before)),
          after: JSON.stringify(snapshot(after)),
        },
      });
      return toRow(after);
    });
  }
}

@Injectable()
export class ListRedemptionItemAuditsUseCase {
  constructor(private readonly prisma: PrismaService) {}

  async execute(companyId: bigint | null, itemId: number, limit = 50): Promise<AuditRow[]> {
    const item = await this.prisma.redemptionItem.findUnique({ where: { id: itemId } });
    if (!item) throw new NotFoundException(`Item ${itemId} not found`);
    if (companyId !== null && item.companyId !== companyId) {
      throw new NotFoundException(`Item ${itemId} not found in scope`);
    }
    const rows = await this.prisma.redemptionItemAudit.findMany({
      where: { itemId },
      orderBy: { createdAt: "desc" },
      take: Math.min(Math.max(limit, 1), 200),
    });
    return rows.map((r) => ({
      id: r.id,
      itemId: r.itemId,
      actorUserId: r.actorUserId?.toString() ?? null,
      action: r.action,
      before: r.before ? safeParse(r.before) : null,
      after: r.after ? safeParse(r.after) : null,
      createdAt: r.createdAt.toISOString(),
    }));
  }
}

function safeParse(s: string): unknown {
  try {
    return JSON.parse(s);
  } catch {
    return s;
  }
}
