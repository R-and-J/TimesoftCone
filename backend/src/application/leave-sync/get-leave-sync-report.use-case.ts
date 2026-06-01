// GetLeaveSyncReport — cmpny 7 사용자별로 우리 leave_balance.AUCTION 누적 vs ezpass mdat 비교.
// 결과: drift 있는 사용자 목록(관리자 비상조치용).
// 점검 자체는 무거움(N명 × ezpass API 호출 1회) → 명시 트리거(점검 버튼)에서만 호출.

import { Injectable, Logger } from "@nestjs/common";
import { PrismaService } from "@/adapters/persistence/prisma.service";
import { EzpassHrLeaveClient } from "@/adapters/hr/ezpass-hr-leave.client";

export type LeaveSyncRow = {
  userId: string;
  empId: string;
  name: string;
  email: string;
  year: number;
  ourAuctionDays: number;
  ezpassMdat: number | null;
  inSync: boolean;
  /** 점검 실패(ezpass 호출 에러 등) 시 사유. ok면 null. */
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
      const lb = await this.prisma.leaveBalance.findFirst({
        where: { userId: u.id, year, leaveType: "AUCTION" },
      });
      const ourAuctionDays = lb ? lb.grantedDays + lb.adjustedDays - lb.usedDays : 0;
      let ezpassMdat: number | null = null;
      let err: string | null = null;
      try {
        const r = await this.ezpass.getCurrentMdat(u.email!, year);
        ezpassMdat = r.mdat;
      } catch (e) {
        err = (e as Error).message;
        this.logger.warn(`drift check fail ${u.email}: ${err}`);
      }
      const inSync = err === null && Number(ezpassMdat) === Number(ourAuctionDays);
      if (!inSync && err === null) driftCount++;
      rows.push({
        userId: String(u.id),
        empId: u.empId,
        name: u.name,
        email: u.email!,
        year,
        ourAuctionDays,
        ezpassMdat,
        inSync,
        error: err,
      });
    }
    return { year, checkedAt: new Date(), rows, driftCount };
  }
}
