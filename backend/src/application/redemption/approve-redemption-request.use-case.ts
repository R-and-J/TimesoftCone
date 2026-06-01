// ApproveRedemptionRequest — 관리자 승인 + 쿠폰 발급 (ADR-023 v2).
// 단일 트랜잭션: redemption_request → APPROVED + couponCode 박음.
// (포인트/재고는 신청 시 이미 잠긴 상태라 이 단계에선 추가 변경 없음.)
// 커밋 후 RedemptionApprovedEvent 발행(요청자에게 "수령 가능" 알림).

import { BadRequestException, ConflictException, Injectable, NotFoundException } from "@nestjs/common";
import { EventEmitter2 } from "@nestjs/event-emitter";
import { PrismaService } from "@/adapters/persistence/prisma.service";
import { REDEMPTION_EVENTS, RedemptionApprovedEvent } from "@/application/events/redemption-events";

export type ApproveResult = {
  requestId: number;
  userId: string;
  itemName: string;
  couponCode: string;
};

@Injectable()
export class ApproveRedemptionRequestUseCase {
  constructor(
    private readonly prisma: PrismaService,
    private readonly events: EventEmitter2,
  ) {}

  async execute(
    requestId: number,
    adminUserId: bigint,
    couponCode: string,
    decisionNote?: string | null,
  ): Promise<ApproveResult> {
    const code = couponCode.trim();
    if (!code) throw new BadRequestException("쿠폰/안내문 텍스트가 필요합니다.");

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
          status: "APPROVED",
          couponCode: code,
          decidedBy: adminUserId,
          decidedAt: new Date(),
          decisionNote: decisionNote ?? null,
        },
      });

      return { req };
    });

    this.events.emit(
      REDEMPTION_EVENTS.APPROVED,
      new RedemptionApprovedEvent(
        requestId,
        result.req.userId,
        result.req.item.name,
        code,
      ),
    );

    return {
      requestId,
      userId: String(result.req.userId),
      itemName: result.req.item.name,
      couponCode: code,
    };
  }
}
