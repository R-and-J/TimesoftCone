// ConfirmRedemptionReceived — 사용자가 "수령 완료" 버튼으로 최종 컨펌 (ADR-023 v2).
// APPROVED 상태에서만 가능. 본인만 가능(컨트롤러에서 SelfOrAdminGuard로 보장).
// 단순 상태 전이 — 콘 영향 없음(이미 신청 시 차감 완료).
// 커밋 후 RedemptionReceivedEvent 발행(관리자들에게 처리 종결 알림).

import { ConflictException, ForbiddenException, Injectable, NotFoundException } from "@nestjs/common";
import { EventEmitter2 } from "@nestjs/event-emitter";
import { PrismaService } from "@/adapters/persistence/prisma.service";
import { REDEMPTION_EVENTS, RedemptionReceivedEvent } from "@/application/events/redemption-events";

export type ConfirmResult = {
  requestId: number;
  receivedAt: Date;
};

@Injectable()
export class ConfirmRedemptionReceivedUseCase {
  constructor(
    private readonly prisma: PrismaService,
    private readonly events: EventEmitter2,
  ) {}

  async execute(requestId: number, userId: bigint): Promise<ConfirmResult> {
    const result = await this.prisma.$transaction(async (tx) => {
      const req = await tx.redemptionRequest.findUnique({
        where: { id: requestId },
        include: {
          item: { select: { name: true } },
          user: { select: { id: true, name: true } },
        },
      });
      if (!req) throw new NotFoundException(`요청 #${requestId} 를 찾을 수 없습니다.`);
      if (req.userId !== userId) throw new ForbiddenException("본인 신청만 수령 처리할 수 있습니다.");
      if (req.status !== "APPROVED") {
        throw new ConflictException(`수령 처리할 수 없는 상태입니다 (status=${req.status}).`);
      }

      const now = new Date();
      await tx.redemptionRequest.update({
        where: { id: requestId },
        data: { status: "RECEIVED", receivedAt: now },
      });

      return { req, now };
    });

    this.events.emit(
      REDEMPTION_EVENTS.RECEIVED,
      new RedemptionReceivedEvent(
        requestId,
        result.req.user.id,
        result.req.user.name,
        result.req.item.name,
      ),
    );

    return { requestId, receivedAt: result.now };
  }
}
