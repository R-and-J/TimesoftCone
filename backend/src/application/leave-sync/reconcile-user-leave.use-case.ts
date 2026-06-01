// ReconcileUserLeave — 단일 사용자, ezpass mdat을 (우리 합 − ezpass atmc) 절대값으로 박음.
//
// 운영 안전성: atmc는 ezpass 자동 계산 컬럼(정본)이라 절대 안 건드림. mdat(조정)만 다룬다.
// ezpass의 streYryc는 자동으로 이력 행 적재 → 감사 추적성 보장.
//
// 정합 결과: atmc + mdat === ourRegular + ourAuctionDays (= ourTotal)

import { Injectable, NotFoundException } from "@nestjs/common";
import { PrismaService } from "@/adapters/persistence/prisma.service";
import { EzpassHrLeaveClient } from "@/adapters/hr/ezpass-hr-leave.client";

export type ReconcileResult = {
  userId: string;
  email: string;
  year: number;
  ourRegular: number;
  ourAuctionDays: number;
  ourTotal: number;
  ezpassAtmc: number;
  ezpassMdatBefore: number;
  ezpassMdatApplied: number;
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

    // 우리 합 = REGULAR + AUCTION
    const lbs = await this.prisma.leaveBalance.findMany({ where: { userId, year } });
    const reg = lbs.find((l) => l.leaveType === "REGULAR");
    const auc = lbs.find((l) => l.leaveType === "AUCTION");
    const ourRegular = reg ? reg.grantedDays + reg.adjustedDays - reg.usedDays : 0;
    const ourAuctionDays = auc ? auc.grantedDays + auc.adjustedDays - auc.usedDays : 0;
    const ourTotal = ourRegular + ourAuctionDays;

    // ezpass 현재값 (atmc + mdat)
    const ez = await this.ezpass.getCurrentLeave(user.email, year);

    // target mdat = (우리 합) − atmc — atmc는 절대 안 건드림.
    const targetMdat = ourTotal - ez.atmc;

    const r = await this.ezpass.setMdatAbsolute(
      user.email,
      year,
      targetMdat,
      `관리자 동기(연차경매시스템 합 ${ourTotal} − atmc ${ez.atmc} = mdat ${targetMdat}) — userId=${userId}`,
    );

    return {
      userId: String(userId),
      email: user.email,
      year,
      ourRegular,
      ourAuctionDays,
      ourTotal,
      ezpassAtmc: ez.atmc,
      ezpassMdatBefore: r.previous,
      ezpassMdatApplied: r.applied,
    };
  }
}
