// GetLeaveSyncReport — cmpny 7 사용자별 우리 합산 vs ezpass 합산 비교.
//
// ezpass 운영 룰: atmc(자동, 정본)는 ezpass가 자동 계산하므로 건드리지 않는다.
// 우리가 다루는 컬럼은 mdat(조정)만. 정합 공식:
//
//   ezpassAtmc + ezpassMdat  ===  ourRegular + ourAuctionDays
//        ↑              ↑                ↑              ↑
//   ezpass 정본    우리가 박음        ADR-002 3-flag (우리 내부)
//
// drift 발생 시: 우리 합 − ezpass atmc 를 mdat 절대값으로 streYryc → 합산 일치.

import { Injectable, Logger } from "@nestjs/common";
import { PrismaService } from "@/adapters/persistence/prisma.service";
import { EzpassHrLeaveClient } from "@/adapters/hr/ezpass-hr-leave.client";

export type LeaveSyncRow = {
  userId: string;
  empId: string;
  name: string;
  email: string;
  year: number;
  /** 우리 REGULAR.granted+adj-used */
  ourRegular: number;
  /** 우리 AUCTION.granted+adj-used */
  ourAuctionDays: number;
  /** 우리 합 (= REGULAR + AUCTION) */
  ourTotal: number;
  /** ezpass atmc (자동, 정본 — 안 건드림) */
  ezpassAtmc: number | null;
  /** ezpass mdat (조정 — 우리가 streYryc로 박는 컬럼) */
  ezpassMdat: number | null;
  /** ezpass 합 */
  ezpassTotal: number | null;
  inSync: boolean;
  error: string | null;
};

export type LeaveSyncReport = {
  year: number;
  checkedAt: Date;
  rows: LeaveSyncRow[];
  driftCount: number;
};

@Injectable()
export class GetLeaveSyncReportUseCase {
  private readonly logger = new Logger(GetLeaveSyncReportUseCase.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly ezpass: EzpassHrLeaveClient,
  ) {}

  async execute(yearArg?: number): Promise<LeaveSyncReport> {
    const year = yearArg ?? new Date().getFullYear();
    const users = await this.prisma.user.findMany({
      where: { active: true, email: { not: null } },
      select: { id: true, empId: true, name: true, email: true },
      orderBy: { id: "asc" },
    });

    const rows: LeaveSyncRow[] = [];
    let driftCount = 0;
    for (const u of users) {
      const lbs = await this.prisma.leaveBalance.findMany({ where: { userId: u.id, year } });
      const reg = lbs.find((l) => l.leaveType === "REGULAR");
      const auc = lbs.find((l) => l.leaveType === "AUCTION");
      const ourRegular = reg ? reg.grantedDays + reg.adjustedDays - reg.usedDays : 0;
      const ourAuctionDays = auc ? auc.grantedDays + auc.adjustedDays - auc.usedDays : 0;
      const ourTotal = ourRegular + ourAuctionDays;

      let ezpassAtmc: number | null = null;
      let ezpassMdat: number | null = null;
      let err: string | null = null;
      try {
        const r = await this.ezpass.getCurrentLeave(u.email!, year);
        ezpassAtmc = r.atmc;
        ezpassMdat = r.mdat;
      } catch (e) {
        err = (e as Error).message;
        this.logger.warn(`drift check fail ${u.email}: ${err}`);
      }
      const ezpassTotal = ezpassAtmc !== null && ezpassMdat !== null ? ezpassAtmc + ezpassMdat : null;
      const inSync = err === null && Number(ezpassTotal) === Number(ourTotal);
      if (!inSync && err === null) driftCount++;
      rows.push({
        userId: String(u.id),
        empId: u.empId,
        name: u.name,
        email: u.email!,
        year,
        ourRegular,
        ourAuctionDays,
        ourTotal,
        ezpassAtmc,
        ezpassMdat,
        ezpassTotal,
        inSync,
        error: err,
      });
    }
    return { year, checkedAt: new Date(), rows, driftCount };
  }
}
