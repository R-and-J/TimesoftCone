// MsaportalMemberDirectoryAdapter — reads the cmpny roster from ezpass org DB
// (msaportal) over mysql2. 우리 Prisma는 sqlite라 MySQL 클라이언트로 못 붙어서
// mysql2로 직접 읽는다. 접속정보는 .env MSAPORTAL_URL에서만(크리덴셜 커밋 금지).
//
// 이건 "지금 동기화" 버튼이 호출하는 런타임 경로다. 핫패스(입찰/정산)는 절대
// 이 어댑터를 타지 않는다 — 관리자가 명시적으로 누를 때만 실행.

import { Inject, Injectable, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import * as mysql from "mysql2/promise";
import type { DirectoryMember, MemberDirectory } from "@/ports/member-directory";

@Injectable()
export class MsaportalMemberDirectoryAdapter implements MemberDirectory {
  private readonly logger = new Logger(MsaportalMemberDirectoryAdapter.name);

  constructor(@Inject(ConfigService) private readonly config: ConfigService) {}

  async listCompanyMembers(): Promise<DirectoryMember[]> {
    const url = this.config.get<string>("MSAPORTAL_URL");
    if (!url) {
      throw new Error(
        "MSAPORTAL_URL이 설정되지 않았습니다. 위임형(ezpass) 회원 동기화에는 org DB 접속정보가 필요합니다.",
      );
    }
    const cmpny = Number(this.config.get<string>("MSAPORTAL_CMPNY_NO") ?? "7");

    const conn = await mysql.createConnection(url);
    try {
      const [rows] = await conn.query(
        `SELECT u.user_no, u.user_id AS email, u.user_nm AS name, u.emp_no,
                u.mngr_author_no, d.dept_nm AS team,
                c.clsf_nm AS job_rank, o.ofcsprtps_nm AS job_title,
                (SELECT ROUND(COALESCE(y.atmc_yryc_day_qty,0) + COALESCE(y.mdat_yryc_day_qty,0))
                   FROM tbl_user_yryc y
                  WHERE y.user_no = u.user_no AND y.cmpny_no = u.cmpny_no
                  ORDER BY y.yryc_year DESC LIMIT 1) AS regular_days
           FROM tbl_user_info u
           LEFT JOIN tbl_dept_info d ON d.dept_no = u.dept_no
           LEFT JOIN tbl_cmpny_clsf_info c ON c.cmpny_no = u.cmpny_no AND c.clsf_no = u.clsf_no
           LEFT JOIN tbl_cmpny_ofcsprtps_info o ON o.cmpny_no = u.cmpny_no AND o.ofcsprtps_no = u.ofcsprtps_no
          WHERE u.cmpny_no = ? AND u.user_id IS NOT NULL
          ORDER BY u.user_id`,
        [cmpny],
      );
      return (rows as any[]).map((m) => ({
        externalUserNo: String(m.user_no),
        email: String(m.email),
        name: m.name ? String(m.name) : String(m.email).split("@")[0],
        empNo: m.emp_no && String(m.emp_no).trim() ? String(m.emp_no).trim() : null,
        isAdmin: !!(m.mngr_author_no && String(m.mngr_author_no).trim()),
        team: m.team ? String(m.team) : null,
        jobRank: m.job_rank ? String(m.job_rank) : null,
        jobTitle: m.job_title ? String(m.job_title) : null,
        regularLeaveDays: m.regular_days != null ? Number(m.regular_days) : 0,
      }));
    } finally {
      await conn.end().catch((e) => this.logger.warn(`msaportal close: ${(e as Error).message}`));
    }
  }
}
