// EzpassHrLeaveClient — 정식 ezpass REST API로 낙찰 연차를 통지하는 어댑터.
//
// ADR-025 (개정: 2026-06-01) — 초안의 msaportal 직쓰기 어댑터를 본 어댑터로 교체.
// 분석으로 정식 REST 엔드포인트 발견(ezpass 메뉴 "관리자 > 근태 관리 > 개인별
// 휴가 관리"가 사용):
//
//   - POST {base}/v1/cmn/dlz/CmnDlz0020P/selectUserYrycInfo  → 현재 mdat 조회
//   - PUT  {base}/v1/adm/dlz/AdmDlz0070M/streYryc            → (현재+delta) 덮어쓰기
//
// 정식 API의 이점:
//   - cmpny_no는 토큰에서 주입 → 우리가 가드할 필요 없음(구조적 안전).
//   - 회계년도(accnut_start_de)는 회사 정책(Y1=회계년도/Y2=입사일)에 따라
//     서버가 자동 계산 — 직쓰기 SQL의 yryc_year 기준은 정책 회피였음.
//   - 이력 row(tbl_user_yryc_creat_history)가 자동 적재 → 감사 추적성 확보.
//
// 흐름:
//   1) tbl_user_info에서 email → (user_no, cmpny_no) 일회성 lookup (시드와 동일 패턴, READ-ONLY).
//   2) cmpny가 7(타임소프트콘)이 아니면 throw — 운영 시 ezpass에 의도치 않은 쓰기 방지.
//   3) selectUserYrycInfo로 현재 mdat 절대값을 가져온다.
//   4) (현재 + grant.days) 절대값을 streYryc로 PUT — content에 경매 ID를 남긴다(감사).
//   5) 401 → 토큰 만료로 보고 한 번 재로그인 후 1회 재시도.
//
// 실패 시 throw → OutboxRelay가 재시도/DLQ 처리(ADR-005).

import * as https from "node:https";
import * as mysql from "mysql2/promise";
import { Inject, Injectable, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import type { HrLeaveClient, HrLeaveGrant } from "@/ports/hr-leave-client.port";
import { EzpassAdminTokenService } from "@/adapters/auth/ezpass-admin-token.service";

const TARGET_CMPNY = 7;
const TARGET_CMPNY_LABEL = "타임소프트콘";

type HttpJsonResult = { status: number; body: string };

@Injectable()
export class EzpassHrLeaveClient implements HrLeaveClient {
  private readonly logger = new Logger(EzpassHrLeaveClient.name);
  /** 회사 정책 캐시 — 회계년도 계산에 필요. lifecycle: 모듈 메모리. */
  private cmpnyInfo: { yrycStdrCode: string; fsyrStdrMonth: string } | null = null;

  constructor(
    @Inject(ConfigService) private readonly config: ConfigService,
    private readonly admin: EzpassAdminTokenService,
  ) {}

  /** 회사 정책 한 번 가져와 캐시 (CmnDlz0020P/selectCmpnyInfo). */
  private async getCmpnyInfo(): Promise<{ yrycStdrCode: string; fsyrStdrMonth: string }> {
    if (this.cmpnyInfo) return this.cmpnyInfo;
    const token = await this.admin.getToken();
    const base = this.requireBase();
    const r = await this.callJson("POST", `${base}/v1/cmn/dlz/CmnDlz0020P/selectCmpnyInfo`, {}, token);
    if (r.status !== 200) {
      throw new Error(`selectCmpnyInfo 실패 (status=${r.status}): ${r.body.slice(0, 200)}`);
    }
    this.cmpnyInfo = JSON.parse(r.body);
    this.logger.log(`ezpass cmpnyInfo 캐시: ${JSON.stringify(this.cmpnyInfo)}`);
    return this.cmpnyInfo!;
  }

  /** ezpass CmnDlz0000Service.getAccnutStartDe와 동일 로직 — 회사 정책 기반 회계년도 시작일. */
  private async computeAccnutStartDe(year: number): Promise<string> {
    const info = await this.getCmpnyInfo();
    const fmt = (d: Date) =>
      `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
    if (info.yrycStdrCode === "Y1") {
      const month = Number(info.fsyrStdrMonth);
      const stdDe = new Date(year, month - 1, 1);
      const now = new Date();
      const nowYear = now.getFullYear();
      let accnutDe: Date;
      if (nowYear === year) {
        accnutDe = now < stdDe ? new Date(year - 1, month - 1, 1) : stdDe;
      } else {
        accnutDe = stdDe;
      }
      return fmt(accnutDe);
    }
    // Y2 (입사일 기준) — 해당 연도 1월 1일
    return `${year}-01-01`;
  }

  async grantLeave(grant: HrLeaveGrant): Promise<void> {
    if (!grant.email) {
      throw new Error(`email이 없어 user_no를 매핑할 수 없습니다 (userId=${grant.userId})`);
    }

    const userNo = await this.resolveUserNo(grant.email);
    const token = await this.admin.getToken();
    const currentMdat = await this.fetchCurrentMdat(userNo, grant.year, token);
    const newMdat = round3(currentMdat + grant.days);

    await this.putStreYryc(userNo, grant.year, newMdat, `낙찰 적립 (경매 ${grant.auctionId})`, token);
    this.logger.log(
      `[ezpass mdat ${currentMdat} → ${newMdat}] ${grant.email} user_no=${userNo} ${grant.year} (+${grant.days}일, 경매 ${grant.auctionId})`,
    );
  }

  /** 관리자 비상조치 — 현재 mdat을 절대값 N으로 덮어씀.
   *  drift 발견 시 우리 leave_balance.AUCTION 값에 맞춰 ezpass mdat을 강제 동기.
   *  return: { previous, applied } 로 변화량 노출(감사용). */
  async setMdatAbsolute(
    email: string,
    year: number,
    days: number,
    content: string,
  ): Promise<{ userNo: number; previous: number; applied: number }> {
    const userNo = await this.resolveUserNo(email);
    const token = await this.admin.getToken();
    const previous = await this.fetchCurrentMdat(userNo, year, token);
    const applied = round3(days);
    await this.putStreYryc(userNo, year, applied, content, token);
    this.logger.log(
      `[ezpass mdat reconcile ${previous} → ${applied}] ${email} user_no=${userNo} ${year} (${content})`,
    );
    return { userNo, previous, applied };
  }

  /** drift 점검용 — 단일 사용자 현재 mdat 조회. */
  async getCurrentMdat(email: string, year: number): Promise<{ userNo: number; mdat: number }> {
    const userNo = await this.resolveUserNo(email);
    const token = await this.admin.getToken();
    const mdat = await this.fetchCurrentMdat(userNo, year, token);
    return { userNo, mdat };
  }

  /** email → (user_no, cmpny_no) 일회성 READ-ONLY 매핑.
   *  시드(prisma/seed.ts)가 회원 미러를 만들 때 쓰는 것과 동일한 SELECT 패턴.
   *  cmpny가 7이 아니면 throw(타 회사 쓰기 방지). */
  private async resolveUserNo(email: string): Promise<number> {
    const url = this.config.get<string>("MSAPORTAL_URL");
    if (!url) throw new Error("MSAPORTAL_URL이 설정되지 않았습니다 (.env)");
    const conn = await mysql.createConnection(url);
    try {
      const [rows] = await conn.query(
        `SELECT user_no, cmpny_no FROM tbl_user_info WHERE user_id = ? LIMIT 1`,
        [email],
      );
      const r = (rows as { user_no: number; cmpny_no: number }[])[0];
      if (!r) throw new Error(`tbl_user_info에 user_id=${email} 없음`);
      if (Number(r.cmpny_no) !== TARGET_CMPNY) {
        throw new Error(
          `cmpny ${r.cmpny_no} 회원은 쓰기 대상 아님 (cmpny ${TARGET_CMPNY}=${TARGET_CMPNY_LABEL} 한정)`,
        );
      }
      return Number(r.user_no);
    } finally {
      await conn.end().catch(() => undefined);
    }
  }

  /** CmnDlz0020P/selectUserYrycInfo — 단일 사용자 mdat 절대값 조회. */
  private async fetchCurrentMdat(userNo: number, year: number, token: string): Promise<number> {
    const base = this.requireBase();
    const url = `${base}/v1/cmn/dlz/CmnDlz0020P/selectUserYrycInfo`;
    // ezpass selectUserYrycInfo는 accnut_start_de로 매칭 — 회사 정책(Y1/Y2 + fsyrStdrMonth)
    // 기반으로 정확한 회계년도 시작일 계산해야 row가 잡힘. 우리는 그냥 ${year}-01-01를
    // 보내선 안 되고(cmpny 7은 3월 시작), ezpass의 getAccnutStartDe 로직 재현.
    const startDe = await this.computeAccnutStartDe(year);
    const body = { submitUserNo: userNo, startDe };
    const res = await this.callJson("POST", url, body, token);
    const handled = await this.handleAuthRetry(res, () => this.callJson("POST", url, body, token));
    if (handled.status !== 200) {
      throw new Error(
        `selectUserYrycInfo 실패 (status=${handled.status}): ${handled.body.slice(0, 300)}`,
      );
    }
    // 해당 연도 row가 없으면 200 + 빈 body(또는 "null")로 응답. mdat=0으로 처리.
    const resp = handled.body?.trim() ?? "";
    if (!resp || resp === "null") return 0;
    const parsed = JSON.parse(resp) as { mdatYryc?: number };
    return Number(parsed.mdatYryc ?? 0);
  }

  /** AdmDlz0070M/streYryc — List<UpdtYrycVo>를 PUT. mdat를 절대값으로 덮어씀.
   *  서버가 회계년도/이력/cmpnyNo를 토큰·회사정보에서 자동 계산. */
  private async putStreYryc(
    userNo: number,
    year: number,
    newMdat: number,
    content: string,
    token: string,
  ): Promise<void> {
    const base = this.requireBase();
    const url = `${base}/v1/adm/dlz/AdmDlz0070M/streYryc`;
    const body = [
      {
        userNo,
        mdatYrycDayQty: newMdat,
        mdatYrycDayQtyMinute: 0,
        yrycYear: year,
        content,
      },
    ];
    const res = await this.callJson("PUT", url, body, token);
    const handled = await this.handleAuthRetry(res, () => this.callJson("PUT", url, body, token));
    if (handled.status !== 200) {
      throw new Error(
        `streYryc 실패 (status=${handled.status}): ${handled.body.slice(0, 300)}`,
      );
    }
  }

  private async handleAuthRetry(
    first: HttpJsonResult,
    retry: () => Promise<HttpJsonResult>,
  ): Promise<HttpJsonResult> {
    if (first.status !== 401) return first;
    this.logger.warn("ezpass 401 — admin 토큰 재발급 후 1회 재시도");
    await this.admin.refreshOnUnauthorized();
    return retry();
  }

  private callJson(
    method: "POST" | "PUT",
    urlStr: string,
    bodyObj: unknown,
    token: string,
  ): Promise<HttpJsonResult> {
    const locale = this.config.get<string>("EZPASS_LOCALE") ?? "ko-KR";
    const insecure = this.config.get<string>("EZPASS_TLS_INSECURE") === "true";
    return new Promise((resolve, reject) => {
      const url = new URL(urlStr);
      const payload = JSON.stringify(bodyObj);
      const req = https.request(
        {
          method,
          hostname: url.hostname,
          port: url.port || 443,
          path: url.pathname + url.search,
          headers: {
            "Content-Type": "application/json",
            "Content-Length": Buffer.byteLength(payload),
            Authorization: `Bearer ${token}`,
            locale,
          },
          agent: new https.Agent({ rejectUnauthorized: !insecure }),
          timeout: 15000,
        },
        (resp) => {
          let data = "";
          resp.on("data", (c) => (data += c));
          resp.on("end", () => resolve({ status: resp.statusCode ?? 0, body: data }));
        },
      );
      req.on("error", reject);
      req.on("timeout", () => req.destroy(new Error("ezpass request timeout")));
      req.write(payload);
      req.end();
    });
  }

  private requireBase(): string {
    const base = this.config.get<string>("EZPASS_BASE_BSNS_URL")
      ?? this.config.get<string>("EZPASS_BASE_URL")?.replace(/cmmn$/, "bsns");
    if (!base) throw new Error("EZPASS_BASE_BSNS_URL(또는 EZPASS_BASE_URL)이 설정되지 않았습니다");
    return base;
  }
}

function round3(n: number): number {
  return Math.round(n * 1000) / 1000;
}
