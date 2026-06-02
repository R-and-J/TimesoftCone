// ApproveChargeRequest — 관리자 승인 (ADR-024).
// 단일 트랜잭션: charge_request → APPROVED + wallet 적립 + CREDIT_ADMIN ledger.
// 커밋 후 ChargeApprovedEvent 발행(요청자 알림).

import { BadRequestException, ConflictException, Injectable, NotFoundException } from "@nestjs/common";
import { EventEmitter2 } from "@nestjs/event-emitter";
import { PrismaService } from "@/adapters/persistence/prisma.service";
import { CHARGE_EVENTS, ChargeApprovedEvent } from "@/application/events/charge-events";

export type ApproveResult = {
  requestId: number;
  userId: string;
  amount: string;
  newBalance: string;
};

@Injectable()
export class ApproveChargeRequestUseCase {
  constructor(
    private readonly prisma: PrismaService,
    private readonly events: EventEmitter2,
  ) {}

  async execute(requestId: number, adminUserId: bigint, decisionNote?: string | null): Promise<ApproveResult> {
    const result = await this.prisma.$transaction(async (tx) => {
      const req = await tx.chargeRequest.findUnique({ where: { id: requestId } });
      if (!req) throw new NotFoundException(`요청 #${requestId} 를 찾을 수 없습니다.`);
      if (req.status !== "PENDING") {
        throw new ConflictException(`이미 처리된 요청입니다 (status=${req.status}).`);
      }

      // 1) charge_request 갱신
      await tx.chargeRequest.update({
        where: { id: requestId },
        data: {
          status: "APPROVED",
          decidedBy: adminUserId,
          decidedAt: new Date(),
          decisionNote: decisionNote ?? null,
        },
      });

      // 2) 지갑 적립 (없으면 생성) + CREDIT_ADMIN ledger INSERT (DB-RULE-1 그대로 — INSERT only)
      const existing = await tx.wallet.findUnique({
        where: { uq_wallet_user_currency: { userId: req.userId, currency: "WELFARE_POINT" } },
      });
      const newBalance = (existing?.balance ?? 0n) + req.amount;
      if (existing) {
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
          actionType: "CREDIT_ADMIN",
          amount: req.amount,
          balanceAfter: newBalance,
          refNote: `충전요청 #${requestId} 승인` + (decisionNote ? ` — ${decisionNote}` : ""),
          companyId: req.companyId, // 멀티테넌시: 요청자 회사로 태깅
        },
      });

      return { req, newBalance };
    });

    // 커밋 후 이벤트 발행 — 요청자에게 승인 알림.
    this.events.emit(
      CHARGE_EVENTS.APPROVED,
      new ChargeApprovedEvent(requestId, result.req.userId, result.req.amount),
    );

    return {
      requestId,
      userId: String(result.req.userId),
      amount: result.req.amount.toString(),
      newBalance: result.newBalance.toString(),
    };
  }
}
