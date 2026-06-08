// SyncMembers — "지금 동기화" 버튼이 호출. 외부 디렉터리(ezpass)에서 회원 명단을
// 읽어 우리 users에 미러하고 REGULAR 연차를 갱신한다(ADR-020).
//
// 미러 키 = email. role/name/team/직급/직책은 ezpass 기준으로 재동기화.
// 신규 회원은 자동 생성(empId = emp_no 또는 EZP-{userNo}). 돈/경매/AUCTION연차는
// 손대지 않는다 — 그건 우리 DB 고유 데이터다.

import { Inject, Injectable, Logger } from "@nestjs/common";
import { PrismaService } from "@/adapters/persistence/prisma.service";
import { MEMBER_DIRECTORY, type MemberDirectory } from "@/ports/member-directory";

const YEAR = 2026;

export type SyncResult = {
  synced: number;
  created: number;
  updated: number;
  total: number;
  at: string;
  errors: string[];
};

@Injectable()
export class SyncMembersUseCase {
  private readonly logger = new Logger(SyncMembersUseCase.name);

  constructor(
    private readonly prisma: PrismaService,
    @Inject(MEMBER_DIRECTORY) private readonly directory: MemberDirectory,
  ) {}

  async execute(): Promise<SyncResult> {
    const members = await this.directory.listCompanyMembers();
    let created = 0;
    let updated = 0;
    const errors: string[] = [];

    const ADMIN_FAMILY = ["ADMIN", "EXAM_ADMIN", "EZPASS_ADMIN"];
    for (const m of members) {
      const empId = m.empNo ?? `EZP-${m.externalUserNo}`;
      try {
        const existing = await this.prisma.user.findUnique({ where: { email: m.email } });
        // 관리자 계열 role은 동기화로 덮어쓰지 않는다(전용 admin·지정 관리자 보존).
        // 그 외에는 ezpass mngr_author면 EZPASS_ADMIN, 아니면 EZPASS.
        const role =
          existing && ADMIN_FAMILY.includes(existing.role)
            ? existing.role
            : m.isAdmin
              ? "EZPASS_ADMIN"
              : "EZPASS";
        const user = await this.prisma.user.upsert({
          where: { email: m.email },
          update: { name: m.name, team: m.team, role, jobRank: m.jobRank, jobTitle: m.jobTitle },
          create: {
            empId,
            email: m.email,
            name: m.name,
            team: m.team,
            role,
            jobRank: m.jobRank,
            jobTitle: m.jobTitle,
          },
        });
        if (existing) updated++;
        else created++;

        // REGULAR 연차(법정)는 ezpass 값으로 동기화. AUCTION/EVENT는 우리 소유라 유지.
        await this.prisma.leaveBalance.upsert({
          where: { uq_leave_user_year_type: { userId: user.id, year: YEAR, leaveType: "REGULAR" } },
          update: { grantedDays: m.regularLeaveDays },
          create: {
            userId: user.id,
            year: YEAR,
            leaveType: "REGULAR",
            grantedDays: m.regularLeaveDays,
            adjustedDays: 0,
            usedDays: 0,
          },
        });
      } catch (e) {
        errors.push(`${m.email}: ${(e as Error).message?.split("\n").pop()}`);
      }
    }

    const result: SyncResult = {
      synced: created + updated,
      created,
      updated,
      total: members.length,
      at: new Date().toISOString(),
      errors,
    };
    this.logger.log(`members synced: ${result.synced}/${result.total} (new ${created}, upd ${updated})`);
    return result;
  }
}
