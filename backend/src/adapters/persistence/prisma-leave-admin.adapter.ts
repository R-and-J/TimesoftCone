// PrismaLeaveAdminAdapter — LeaveAdminPort 구현.
// 세 메서드 모두 prisma.$transaction으로 단일 트랜잭션 보장.

import { ConflictException, Injectable, NotFoundException } from "@nestjs/common";
import { PrismaService } from "./prisma.service";
import {
  InsufficientLeaveError,
  planLeaveDeduction,
} from "@/domain/leave/leave-deduction";
import type {
  DeductPriorityInput,
  DeductPriorityResult,
  GrantEventInput,
  GrantEventResult,
  LeaveAdminPort,
} from "@/ports/leave-admin.port";

@Injectable()
export class PrismaLeaveAdminAdapter implements LeaveAdminPort {
  constructor(private readonly prisma: PrismaService) {}

  async deductPriority(input: DeductPriorityInput): Promise<DeductPriorityResult> {
    return this.prisma.$transaction(async (tx) => {
      const rows = await tx.leaveBalance.findMany({
        where: { userId: input.userId, year: input.year },
      });
      const r = { AUCTION: 0, EVENT: 0, REGULAR: 0 };
      for (const b of rows) {
        const rem = b.grantedDays + b.adjustedDays - b.usedDays;
        if (b.leaveType === "AUCTION") r.AUCTION = rem;
        else if (b.leaveType === "EVENT") r.EVENT = rem;
        else if (b.leaveType === "REGULAR") r.REGULAR = rem;
      }

      // 도메인 규칙(AUCTION→EVENT→REGULAR)을 그대로 호출 — 영속화는 아래.
      let consumed;
      try {
        consumed = planLeaveDeduction(r, input.days);
      } catch (e) {
        if (e instanceof InsufficientLeaveError) {
          throw new ConflictException(e.message);
        }
        throw e;
      }

      // 차감 — leaveType별로 usedDays += consumed[type]. 행이 없으면 0 차감 case라 생략 가능.
      for (const t of ["AUCTION", "EVENT", "REGULAR"] as const) {
        if (consumed[t] === 0) continue;
        await tx.leaveBalance.update({
          where: {
            uq_leave_user_year_type: { userId: input.userId, year: input.year, leaveType: t },
          },
          data: { usedDays: { increment: consumed[t] } },
        });
      }

      return {
        consumed,
        remainingAfter: {
          AUCTION: r.AUCTION - consumed.AUCTION,
          EVENT: r.EVENT - consumed.EVENT,
          REGULAR: r.REGULAR - consumed.REGULAR,
        },
      };
    });
  }

  async grantEventFromUnsold(input: GrantEventInput): Promise<GrantEventResult> {
    return this.prisma.$transaction(async (tx) => {
      const a = await tx.auction.findUnique({ where: { id: input.auctionId } });
      if (!a) throw new NotFoundException(`Auction ${input.auctionId} not found`);
      if (a.status !== "UNSOLD") {
        // UNSOLD만 EVENT 변환 가능 — 진행 중/낙찰을 잘못 변환하지 못하게 가드.
        throw new ConflictException(
          `Auction ${input.auctionId} status is ${a.status}; only UNSOLD can be granted as EVENT`,
        );
      }
      const year = a.endsAt.getFullYear();
      const days = a.leaveDays;

      // EVENT 잔액 +days (없으면 생성).
      await tx.leaveBalance.upsert({
        where: {
          uq_leave_user_year_type: { userId: input.userId, year, leaveType: "EVENT" },
        },
        create: { userId: input.userId, year, leaveType: "EVENT", adjustedDays: days },
        update: { adjustedDays: { increment: days } },
      });

      // 인벤토리 소진 — 경매 행 영구 삭제. UNSOLD라 BidEvent 없음.
      await tx.auction.delete({ where: { id: input.auctionId } });

      return { auctionId: input.auctionId, userId: input.userId, year, days };
    });
  }

  async purgeUnsold(input: { upToYear: number }): Promise<{ deleted: number }> {
    // 연도 추출: id가 A-YYYY-NNN이라 lexicographic 비교로 깔끔. (endsAt 기반은
    // anti-snipe 연장으로 흔들릴 수 있으니 id 쪽이 결정적.)
    // upToYear=2026이면 id < 'A-2027-' 가 A-2026/2025/... 전부 포함.
    const r = await this.prisma.auction.deleteMany({
      where: { status: "UNSOLD", id: { lt: `A-${input.upToYear + 1}-` } },
    });
    return { deleted: r.count };
  }
}
