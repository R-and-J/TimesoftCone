// MsaportalHrLeaveClient — ADR-025 ezpass 연차 직접 쓰기 어댑터.
// AUCTION 낙찰 시 OutboxRelay에서 호출 → tbl_user_yryc.mdat_yryc_day_qty += days.
//
// 안전장치:
//   - cmpny_no = 7 (타임소프트콘) 한정. 다른 회사 회원은 throw → DLQ로 격리.
//   - email → user_no 매핑은 tbl_user_info 조회로 검증.
//   - 우리 Prisma는 sqlite-생성이라 mysql2로 직접 붙음(MsaportalMemberDirectoryAdapter 패턴).
//
// type 구분 안 함 (ADR-025) — ezpass엔 REGULAR/AUCTION/EVENT 개념 없음, 단일 mdat 카운트만 ↑.

import { Inject, Injectable, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import * as mysql from "mysql2/promise";
import type { HrLeaveClient, HrLeaveGrant } from "@/ports/hr-leave-client.port";

const TARGET_CMPNY = 7;
const TARGET_CMPNY_LABEL = "타임소프트콘";

@Injectable()
export class MsaportalHrLeaveClient implements HrLeaveClient {
  private readonly logger = new Logger(MsaportalHrLeaveClient.name);

  constructor(@Inject(ConfigService) private readonly config: ConfigService) {}

  async grantLeave(grant: HrLeaveGrant): Promise<void> {
    const url = this.config.get<string>("MSAPORTAL_URL");
    if (!url) throw new Error("MSAPORTAL_URL이 설정되지 않았습니다 (.env)");
    if (!grant.email) {
      throw new Error(`email이 없어 user_no를 매핑할 수 없습니다 (userId=${grant.userId})`);
    }

    const conn = await mysql.createConnection(url);
    try {
      // 1) email → (user_no, cmpny_no) 매핑 + cmpny 가드 (ADR-025 안전장치)
      const [rows] = await conn.query(
        `SELECT user_no, cmpny_no FROM tbl_user_info WHERE user_id = ? LIMIT 1`,
        [grant.email],
      );
      const r = (rows as { user_no: number; cmpny_no: number }[])[0];
      if (!r) {
        throw new Error(`tbl_user_info에 user_id=${grant.email} 없음`);
      }
      const userNo = Number(r.user_no);
      const cmpnyNo = Number(r.cmpny_no);
      if (cmpnyNo !== TARGET_CMPNY) {
        throw new Error(
          `cmpny ${cmpnyNo} 회원은 쓰기 대상 아님 (cmpny ${TARGET_CMPNY}=${TARGET_CMPNY_LABEL} 한정 — ADR-025)`,
        );
      }

      // 2) UPDATE 먼저(대부분 경로). yryc_year는 varchar(4) "2026".
      const yearStr = String(grant.year);
      const [upd] = await conn.execute(
        `UPDATE tbl_user_yryc
            SET mdat_yryc_day_qty = COALESCE(mdat_yryc_day_qty, 0) + ?,
                updt_dt = NOW(),
                updt_user_no = ?
          WHERE cmpny_no = ? AND user_no = ? AND yryc_year = ?`,
        [grant.days, userNo, TARGET_CMPNY, userNo, yearStr],
      );
      const affected = (upd as { affectedRows?: number }).affectedRows ?? 0;
      if (affected === 0) {
        // 해당 연도 row 없음 → 새로 만듦 (atmc=0, mdat에만 +N).
        await conn.execute(
          `INSERT INTO tbl_user_yryc
              (cmpny_no, user_no, yryc_year,
               atmc_yryc_day_qty, mdat_yryc_day_qty,
               by_tot_day, by_rmd_day,
               regist_dt, regist_user_no, updt_dt, updt_user_no)
           VALUES (?, ?, ?, 0, ?, 0, 0, NOW(), ?, NOW(), ?)`,
          [TARGET_CMPNY, userNo, yearStr, grant.days, userNo, userNo],
        );
        this.logger.log(
          `[ezpass mdat INSERT] ${grant.email} user_no=${userNo} ${yearStr} +${grant.days}일 (경매 ${grant.auctionId})`,
        );
      } else {
        this.logger.log(
          `[ezpass mdat +=] ${grant.email} user_no=${userNo} ${yearStr} +${grant.days}일 (경매 ${grant.auctionId})`,
        );
      }
    } finally {
      await conn.end().catch((e) => this.logger.warn(`close: ${(e as Error).message}`));
    }
  }
}
