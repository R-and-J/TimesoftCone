// ReconcileUserLeave — 단일 사용자에 한해 ezpass mdat을 우리 leave_balance.AUCTION 값으로
// 강제 동기. 비상조치(관리자 전용). 호출 후 ezpass mdat = 우리 누적값.
// ezpass의 streYryc는 자동으로 이력 행 적재 → 감사 추적성 보장.

import { Injectable, NotFoundException } from "@nestjs/common";
import { PrismaService } from "@/adapters/persistence/prisma.service";
import { EzpassHrLeaveClient } from "@/adapters/hr/ezpass-hr-leave.client";

export type ReconcileResult = {
  userId: string;
  email: string;
  year: number;
  ourValue: number;
  ezpassPrevious: number;
  ezpassApplied: number;
};

@Injectable()
export class ReconcileUserLeaveUseCase {
  constructor(
    private readonly prisma: PrismaService,
    private readonly ezpass: EzpassHrLeaveClient,
  ) {}

  async execute(userId: bigint, yearArg?: number): Promise<ReconcileResult> {
    const year = yearArg ?? new Date().getFullYear();
    const user = await this.prisma.user.findUnique({ where: { id: userId }, select: { email: true } });
    if (!user || !user.email) throw new NotFoundException("사용자/이메일 없음");

    const lb = await this.prisma.leaveBalance.findFirst({
      where: { userId, year, leaveType: "AUCTION" },
    });
    const ourValue = lb ? lb.grantedDays + lb.adjustedDays - lb.usedDays : 0;

    const { previous, applied } = await this.ezpass.setMdatAbsolute(
      user.email,
      year,
      ourValue,
      `관리자 동기(연차경매시스템 ↔ ezpass 정합) — userId=${userId}`,
    );

    return {
      userId: String(userId),
      email: user.email,
      year,
      ourValue,
      ezpassPrevious: previous,
      ezpassApplied: applied,
    };
  }
}
