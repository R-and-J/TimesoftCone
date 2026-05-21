// GetUserLeave — reads the ADR-002 three-flag leave balance for one user.
//
// Read-only at this point — bid settlement does NOT yet credit
// auctionLeaveDays. See scope-cuts.md CUT-9 (Leave context partial revival).

import { Injectable, NotFoundException } from "@nestjs/common";
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
      select: {
        id: true,
        regularLeaveDays: true,
        auctionLeaveDays: true,
        eventLeaveDays: true,
      },
    });
    if (!user) throw new NotFoundException(`User ${userIdRaw} not found`);

    return {
      userId: user.id,
      regular: user.regularLeaveDays,
      auction: user.auctionLeaveDays,
      event: user.eventLeaveDays,
      total: user.regularLeaveDays + user.auctionLeaveDays + user.eventLeaveDays,
    };
  }
}
