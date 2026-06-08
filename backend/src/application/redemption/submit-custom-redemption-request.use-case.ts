// SubmitCustomRedemptionRequest — 사용자 자유 제안형 교환 신청 (스쿱 마켓 "원하는대로 담기").
// 카탈로그에 없는 물품을 사용자가 직접 제안: 물품명·희망 가격·요청 사항 입력.
//
// 단일 트랜잭션 (기존 SubmitRedemptionRequest와 같은 패턴):
//   wish item(sku="CUSTOM-WISH") 잠금 + wallet 차감 customPriceP + REDEEM ledger + request INSERT
// 신청 시점에 콘을 잠그는 것은 ADR-001 escrow 모델과 정합 — 반려 시 환불.
// customName 은 request.note 앞에 "[원하는 것: ...]" 라벨로 박혀 관리자 화면에서 확인 가능.

import { BadRequestException, ConflictException, Injectable, NotFoundException } from "@nestjs/common";
import { EventEmitter2 } from "@nestjs/event-emitter";
import { PrismaService } from "@/adapters/persistence/prisma.service";
import {
  REDEMPTION_EVENTS,
  RedemptionRequestSubmittedEvent,
} from "@/application/events/redemption-events";

export const CUSTOM_WISH_SKU = "CUSTOM-WISH";

export type SubmitCustomRedemptionRequestInput = {
  userId: bigint;
  customName: string;
  customPriceP: bigint | number | string;
  note?: string | null;
};

@Injectable()
export class SubmitCustomRedemptionRequestUseCase {
  constructor(
    private readonly prisma: PrismaService,
    private readonly events: EventEmitter2,
  ) {}

  async execute(input: SubmitCustomRedemptionRequestInput) {
    const name = input.customName?.trim();
    if (!name) throw new BadRequestException("물품명은 필수입니다.");
    const priceP = BigInt(input.customPriceP);
    if (priceP <= 0n) throw new BadRequestException("희망 금액은 양의 정수여야 합니다.");

    const result = await this.prisma.$transaction(async (tx) => {
      const user = await tx.user.findUnique({
        where: { id: input.userId },
        select: { id: true, name: true, companyId: true },
      });
      if (!user) throw new NotFoundException("사용자를 찾을 수 없습니다.");
      const co = user.companyId ?? 1n;

      // wish item — 회사별 시드. sku는 회사 무관 unique.
      const item = await tx.redemptionItem.findUnique({ where: { sku: CUSTOM_WISH_SKU } });
      if (!item || !item.active) {
        throw new ConflictException("자유 신청이 현재 비활성입니다.");
      }

      const wallet = await tx.wallet.findUnique({
        where: { uq_wallet_user_currency: { userId: user.id, currency: "WELFARE_POINT" } },
      });
      if (!wallet || wallet.balance < priceP) {
        throw new BadRequestException("콘이 부족합니다.");
      }
      const newBalance = wallet.balance - priceP;
      await tx.wallet.update({
        where: { uq_wallet_user_currency: { userId: user.id, currency: "WELFARE_POINT" } },
        data: { balance: newBalance },
      });

      await tx.ledgerEntry.create({
        data: {
          userId: user.id,
          currency: "WELFARE_POINT",
          actionType: "REDEEM",
          amount: -priceP,
          balanceAfter: newBalance,
          refNote: `자유 신청 — ${name}`,
          companyId: co,
        },
      });

      const tail = input.note?.trim() ? ` / ${input.note.trim()}` : "";
      const composedNote = `[원하는 것: ${name}]${tail}`;
      const req = await tx.redemptionRequest.create({
        data: {
          userId: user.id,
          itemId: item.id,
          pricePAtRequest: priceP,
          note: composedNote,
          status: "PENDING",
          companyId: co,
        },
      });

      return { req, user, customName: name };
    });

    this.events.emit(
      REDEMPTION_EVENTS.SUBMITTED,
      new RedemptionRequestSubmittedEvent(
        result.req.id,
        result.user.id,
        result.user.name,
        `원하는 것: ${result.customName}`,
        priceP,
      ),
    );

    return {
      id: result.req.id,
      itemId: result.req.itemId,
      itemName: `원하는 것: ${result.customName}`,
      pricePAtRequest: result.req.pricePAtRequest.toString(),
      status: result.req.status,
      createdAt: result.req.createdAt,
    };
  }
}
