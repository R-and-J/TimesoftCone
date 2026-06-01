// SubmitChargeRequest — 사용자 주도 충전 요청 등록(ADR-024).
// 토큰 주체가 요청자(컨트롤러에서 @CurrentUser로 주입). PENDING으로 적재 →
// ChargeRequestSubmittedEvent 발행(NotificationObserver가 관리자들에게 알림).

import { BadRequestException, Injectable } from "@nestjs/common";
import { EventEmitter2 } from "@nestjs/event-emitter";
import { PrismaService } from "@/adapters/persistence/prisma.service";
import { CHARGE_EVENTS, ChargeRequestSubmittedEvent } from "@/application/events/charge-events";

export type SubmitChargeRequestInput = {
  userId: bigint;
  amount: bigint | number | string;
  note?: string | null;
};

@Injectable()
export class SubmitChargeRequestUseCase {
  constructor(
    private readonly prisma: PrismaService,
    private readonly events: EventEmitter2,
  ) {}

  async execute(input: SubmitChargeRequestInput) {
    const amount = BigInt(input.amount);
    if (amount <= 0n) throw new BadRequestException("금액은 1P 이상이어야 합니다.");

    const user = await this.prisma.user.findUnique({
      where: { id: input.userId },
      select: { id: true, name: true },
    });
    if (!user) throw new BadRequestException("사용자를 찾을 수 없습니다.");

    // 요청 등록 + 감사 ledger INSERT는 단일 트랜잭션 — 둘 중 하나만 남는 일 방지.
    const { req, currentBalance } = await this.prisma.$transaction(async (tx) => {
      const created = await tx.chargeRequest.create({
        data: {
          userId: input.userId,
          amount,
          note: input.note ?? null,
          status: "PENDING",
        },
      });
      // 현재 잔액 — entry에 balanceAfter로 박는다(이 entry는 잔액을 바꾸지 않음).
      const wallet = await tx.wallet.findUnique({
        where: { uq_wallet_user_currency: { userId: input.userId, currency: "WELFARE_POINT" } },
      });
      const balance = wallet?.balance ?? 0n;
      await tx.ledgerEntry.create({
        data: {
          userId: input.userId,
          currency: "WELFARE_POINT",
          actionType: "CHARGE_REQUESTED",
          amount,
          balanceAfter: balance,
          refNote: `충전요청 #${created.id} 등록` + (input.note ? ` — ${input.note}` : ""),
        },
      });
      return { req: created, currentBalance: balance };
    });

    this.events.emit(
      CHARGE_EVENTS.SUBMITTED,
      new ChargeRequestSubmittedEvent(req.id, user.id, user.name, amount, input.note ?? null),
    );

    return {
      id: req.id,
      amount: req.amount.toString(),
      status: req.status,
      balance: currentBalance.toString(),
      createdAt: req.createdAt,
    };
  }
}
