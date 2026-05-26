// GetUserLeave — reads the ADR-002 three-flag leave balance for one user.
//
// Leave master is this system (ADR-016): balances live in `leave_balance`
// (per user / year / type), modeled on ezpass tbl_user_yryc. Remaining per
// type = granted + adjusted − used, summed across years.

import { Injectable, NotFoundException } from "@nestjs/common";
import type { LeaveType } from "@prisma/client";
import { PrismaService } from "@/adapters/persistence/prisma.service";
import { UserId } from "@/domain/shared/value-objects/user-id";

export type UserLeaveResult = {
  userId: bigint;
  regular: number;
  auction: number;
  event: number;
  total: number;
};

@Injectable()
export class GetUserLeaveUseCase {
  constructor(private readonly prisma: PrismaService) {}

  async execute(userIdRaw: string | bigint | number): Promise<UserLeaveResult> {
    const userId = UserId.of(userIdRaw).toBigInt();
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { id: true },
    });
    if (!user) throw new NotFoundException(`User ${userIdRaw} not found`);

    const rows = await this.prisma.leaveBalance.findMany({
      where: { userId },
      select: { leaveType: true, grantedDays: true, adjustedDays: true, usedDays: true },
    });

    const byType: Record<LeaveType, number> = { REGULAR: 0, AUCTION: 0, EVENT: 0 };
    for (const r of rows) {
      byType[r.leaveType] += r.grantedDays + r.adjustedDays - r.usedDays;
    }

    return {
      userId: user.id,
      regular: byType.REGULAR,
      auction: byType.AUCTION,
      event: byType.EVENT,
      total: byType.REGULAR + byType.AUCTION + byType.EVENT,
    };
  }
}
