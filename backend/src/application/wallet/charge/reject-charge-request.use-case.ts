// RejectChargeRequest — 관리자 반려(ADR-024). 잔액 변화 없음.

import { ConflictException, Injectable, NotFoundException } from "@nestjs/common";
import { EventEmitter2 } from "@nestjs/event-emitter";
import { PrismaService } from "@/adapters/persistence/prisma.service";
import { CHARGE_EVENTS, ChargeRejectedEvent } from "@/application/events/charge-events";

@Injectable()
export class RejectChargeRequestUseCase {
  constructor(
    private readonly prisma: PrismaService,
    private readonly events: EventEmitter2,
  ) {}

  async execute(requestId: number, adminUserId: bigint, decisionNote?: string | null) {
    const req = await this.prisma.chargeRequest.findUnique({ where: { id: requestId } });
    if (!req) throw new NotFoundException(`요청 #${requestId} 를 찾을 수 없습니다.`);
    if (req.status !== "PENDING") {
      throw new ConflictException(`이미 처리된 요청입니다 (status=${req.status}).`);
    }
    await this.prisma.chargeRequest.update({
      where: { id: requestId },
      data: {
        status: "REJECTED",
        decidedBy: adminUserId,
        decidedAt: new Date(),
        decisionNote: decisionNote ?? null,
      },
    });

    this.events.emit(
      CHARGE_EVENTS.REJECTED,
      new ChargeRejectedEvent(requestId, req.userId, req.amount, decisionNote ?? null),
    );

    return { requestId, status: "REJECTED" as const };
  }
}
