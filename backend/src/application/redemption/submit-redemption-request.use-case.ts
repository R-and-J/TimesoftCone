// SubmitRedemptionRequest — 사용자 주도 교환 신청 (ADR-023 v2).
// 단일 트랜잭션:
//   item.stock -1 (재고 잠금) + wallet 차감 + REDEEM ledger(음수) + request INSERT(PENDING).
// 신청 시점에 콘을 잠그는 것이 ADR-001 escrow 모델과 정합 — 반려 시 환불.
// 커밋 후 RedemptionRequestSubmittedEvent 발행(NotificationObserver가 관리자들에게 알림).

import { BadRequestException, ConflictException, Injectable, NotFoundException } from "@nestjs/common";
import { EventEmitter2 } from "@nestjs/event-emitter";
import { PrismaService } from "@/adapters/persistence/prisma.service";
import {
  REDEMPTION_EVENTS,
  RedemptionRequestSubmittedEvent,
} from "@/application/events/redemption-events";

export type SubmitRedemptionRequestInput = {
  userId: bigint;
  itemId: number;
  note?: string | null;
};

@Injectable()
export class SubmitRedemptionRequestUseCase {
  constructor(
    private readonly prisma: PrismaService,
    private readonly events: EventEmitter2,
  ) {}

  async execute(input: SubmitRedemptionRequestInput) {
    const result = await this.prisma.$transaction(async (tx) => {
      const user = await tx.user.findUnique({
        where: { id: input.userId },
        select: { id: true, name: true, companyId: true },
      });
      if (!user) throw new NotFoundException("사용자를 찾을 수 없습니다.");
      const co = user.companyId ?? 1n; // 멀티테넌시: 원장·신청을 신청자 회사로 태깅

      const item = await tx.redemptionItem.findUnique({ where: { id: input.itemId } });
      if (!item) throw new NotFoundException(`상품 #${input.itemId}을 찾을 수 없습니다.`);
      if (!item.active) throw new ConflictException("판매 중단된 상품입니다.");
      if (item.stock !== null && item.stock <= 0) throw new ConflictException("재고가 소진되었습니다.");

      // 재고 잠금 — -1.
      await tx.redemptionItem.update({
        where: { id: item.id },
        data: { stock: { decrement: 1 } },
      });

      // 지갑 차감.
      const wallet = await tx.wallet.findUnique({
        where: { uq_wallet_user_currency: { userId: user.id, currency: "WELFARE_POINT" } },
      });
      if (!wallet || wallet.balance < item.priceP) {
        throw new BadRequestException("콘이 부족합니다.");
      }
      const newBalance = wallet.balance - item.priceP;
      await tx.wallet.update({
        where: { uq_wallet_user_currency: { userId: user.id, currency: "WELFARE_POINT" } },
        data: { balance: newBalance },
      });

      // REDEEM ledger(음수). DB-RULE-1: INSERT only.
      await tx.ledgerEntry.create({
        data: {
          userId: user.id,
          currency: "WELFARE_POINT",
          actionType: "REDEEM",
          amount: -item.priceP,
          balanceAfter: newBalance,
          refNote: `교환 신청 — ${item.name}`,
          companyId: co,
        },
      });

      // 신청 INSERT.
      const req = await tx.redemptionRequest.create({
        data: {
          userId: user.id,
          itemId: item.id,
          pricePAtRequest: item.priceP,
          note: input.note ?? null,
          status: "PENDING",
          companyId: co,
        },
      });

      return { req, user, item };
    });

    this.events.emit(
      REDEMPTION_EVENTS.SUBMITTED,
      new RedemptionRequestSubmittedEvent(
        result.req.id,
        result.user.id,
        result.user.name,
        result.item.name,
        result.item.priceP,
      ),
    );

    return {
      id: result.req.id,
      itemId: result.item.id,
      itemName: result.item.name,
      pricePAtRequest: result.req.pricePAtRequest.toString(),
      status: result.req.status,
      createdAt: result.req.createdAt,
    };
  }
}
