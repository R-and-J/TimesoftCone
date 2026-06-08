// RejectRedemptionRequest — 관리자 반려 + 콘 환불 (ADR-023 v2).
// 단일 트랜잭션:
//   redemption_request → REJECTED + decisionNote
//   wallet 환불(+priceP) + REDEEM_REFUND ledger(보상 INSERT, DB-RULE-1)
//   item.stock +1 (재고 복구)
// 커밋 후 RedemptionRejectedEvent 발행(요청자에게 사유 알림).

import { ConflictException, Injectable, NotFoundException } from "@nestjs/common";
import { EventEmitter2 } from "@nestjs/event-emitter";
import { PrismaService } from "@/adapters/persistence/prisma.service";
import { REDEMPTION_EVENTS, RedemptionRejectedEvent } from "@/application/events/redemption-events";

export type RejectResult = {
  requestId: number;
  userId: string;
  refundedP: string;
  newBalance: string;
};

@Injectable()
export class RejectRedemptionRequestUseCase {
  constructor(
    private readonly prisma: PrismaService,
    private readonly events: EventEmitter2,
  ) {}

  async execute(
    requestId: number,
    adminUserId: bigint,
    decisionNote: string,
  ): Promise<RejectResult> {
    const note = decisionNote.trim();
    if (!note) throw new ConflictException("반려 사유가 필요합니다.");

    const result = await this.prisma.$transaction(async (tx) => {
      const req = await tx.redemptionRequest.findUnique({
        where: { id: requestId },
        include: { item: { select: { name: true } } },
      });
      if (!req) throw new NotFoundException(`요청 #${requestId} 를 찾을 수 없습니다.`);
      if (req.status !== "PENDING") {
        throw new ConflictException(`이미 처리된 요청입니다 (status=${req.status}).`);
      }

      await tx.redemptionRequest.update({
        where: { id: requestId },
        data: {
          status: "REJECTED",
          decidedBy: adminUserId,
          decidedAt: new Date(),
          decisionNote: note,
        },
      });

      // 콘 환불 + REDEEM_REFUND ledger.
      const wallet = await tx.wallet.findUnique({
        where: { uq_wallet_user_currency: { userId: req.userId, currency: "WELFARE_POINT" } },
      });
      const prevBalance = wallet?.balance ?? 0n;
      const newBalance = prevBalance + req.pricePAtRequest;
      if (wallet) {
        await tx.wallet.update({
          where: { uq_wallet_user_currency: { userId: req.userId, currency: "WELFARE_POINT" } },
          data: { balance: newBalance },
        });
      } else {
        await tx.wallet.create({
          data: { userId: req.userId, currency: "WELFARE_POINT", balance: newBalance, companyId: req.companyId },
        });
      }
      await tx.ledgerEntry.create({
        data: {
          userId: req.userId,
          currency: "WELFARE_POINT",
          actionType: "REDEEM_REFUND",
          amount: req.pricePAtRequest,
          balanceAfter: newBalance,
          refNote: `교환 신청 #${requestId} 반려 — ${note}`,
          companyId: req.companyId, // 멀티테넌시: 신청자 회사로 태깅
        },
      });

      // 재고 복구.
      await tx.redemptionItem.update({
        where: { id: req.itemId },
        data: { stock: { increment: 1 } },
      });

      return { req, newBalance };
    });

    this.events.emit(
      REDEMPTION_EVENTS.REJECTED,
      new RedemptionRejectedEvent(
        requestId,
        result.req.userId,
        result.req.item.name,
        result.req.pricePAtRequest,
        note,
      ),
    );

    return {
      requestId,
      userId: String(result.req.userId),
      refundedP: result.req.pricePAtRequest.toString(),
      newBalance: result.newBalance.toString(),
    };
  }
}
