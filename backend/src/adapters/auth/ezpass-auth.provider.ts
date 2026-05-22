// EzpassAuthProvider — 사내 ezpass 로그인 API에 자격증명 검증을 위임하는 어댑터.
//
// 계약 (ezpass LgnBfe0020MController 분석):
//   POST {base}/v1/lgn/bfe/LgnBfe0020M/login
//   Header: locale (필수), Content-Type: application/json
//   Body:   { id(이메일), password, cmpnyNo }
//   200 →   { userToken(JWT), tokenEndDt, cmpnyNo }   (신원은 JWT claims 안)
//   422 →   { code, type, message, detail }            (인증 실패)
//
// TLS: dev 서버는 사내 자체서명 CA라 Node가 신뢰 거부. EZPASS_TLS_INSECURE=true면
//      이 호출에 한해 검증을 끈다(전역 아님). 운영에선 CA를 트러스트에 추가.

import * as https from "node:https";
import { Inject, Injectable, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import {
  AuthFailedError,
  type AuthProvider,
  type ExternalIdentity,
} from "@/ports/auth-provider";

type HttpJsonResult = { status: number; body: string };

@Injectable()
export class EzpassAuthProvider implements AuthProvider {
  private readonly logger = new Logger(EzpassAuthProvider.name);

  constructor(@Inject(ConfigService) private readonly config: ConfigService) {}

  async authenticate(id: string, password: string, cmpnyNo?: string): Promise<ExternalIdentity> {
    const base = this.config.get<string>("EZPASS_BASE_URL");
    if (!base) throw new AuthFailedError("EZPASS_BASE_URL not configured");
    const locale = this.config.get<string>("EZPASS_LOCALE") ?? "ko-KR";
    const insecure = this.config.get<string>("EZPASS_TLS_INSECURE") === "true";

    // 회사번호 결정: 명시값 > selectCmpnyInfo 자동조회 > env 기본값.
    // ezpass는 같은 이메일이 여러 회사에 있을 수 있어 cmpnyNo로 사용자를 특정한다
    // (로그인 화면 제목이 "회사 선택"). 우리는 이메일로 회사번호를 자동 조회한다.
    let company = cmpnyNo;
    if (!company) company = (await this.resolveCmpnyNo(base, locale, insecure, id, password)) ?? undefined;
    if (!company) company = this.config.get<string>("EZPASS_CMPNY_NO") || undefined;
    if (!company) throw new AuthFailedError("회사 정보를 찾을 수 없습니다");

    const url = `${base}/v1/lgn/bfe/LgnBfe0020M/login`;
    let res: HttpJsonResult;
    try {
      res = await this.postJson(
        url,
        { locale },
        { id, password, cmpnyNo: company },
        insecure,
      );
    } catch (e) {
      this.logger.error(`ezpass login transport error: ${(e as Error).message}`);
      throw new AuthFailedError("인증 서버에 연결할 수 없습니다");
    }

    if (res.status !== 200) {
      // 422 = 자격증명/상태 오류. 그 외도 인증 실패로 취급.
      this.logger.warn(`ezpass login failed (status=${res.status}): ${res.body?.slice(0, 400)}`);
      throw new AuthFailedError("아이디 또는 비밀번호가 올바르지 않습니다");
    }

    let token: string | null = null;
    try {
      const parsed = JSON.parse(res.body) as { userToken?: string };
      token = parsed.userToken ?? null;
    } catch {
      throw new AuthFailedError("인증 응답을 해석할 수 없습니다");
    }

    // 신원은 우리가 이미 아는 email(id) + JWT claims(best-effort)로 구성.
    // JWT claim 키 구조에 의존하지 않도록, 없으면 안전하게 폴백.
    const claims = token ? this.decodeJwtClaims(token) : {};
    return {
      email: id,
      name: pickString(claims, ["userNm", "name", "userName"]),
      isAdmin: pickString(claims, ["mngrAuthorAt"]) === "Y",
      externalUserNo: pickString(claims, ["userNo", "userNumber"]),
    };
  }

  /** 이메일(id)로 회사번호 자동 조회. selectCmpnyInfo → [{cmpnyNo, cmpnyNm}].
   *  주의: selectCmpnyInfo도 로그인과 동일한 VO(@NotBlank id+password)를 받으므로
   *  password도 함께 보내야 함(검증용 — 회사 조회 자체는 id로만 함). */
  private async resolveCmpnyNo(
    base: string,
    locale: string,
    insecure: boolean,
    id: string,
    password: string,
  ): Promise<string | null> {
    try {
      const res = await this.postJson(
        `${base}/v1/lgn/bfe/LgnBfe0020M/selectCmpnyInfo`,
        { locale },
        { id, password },
        insecure,
      );
      if (res.status !== 200) {
        this.logger.warn(`selectCmpnyInfo failed (status=${res.status}): ${res.body?.slice(0, 200)}`);
        return null;
      }
      const arr = JSON.parse(res.body) as Array<Record<string, unknown>>;
      if (Array.isArray(arr) && arr.length > 0) {
        const v = arr[0]["cmpnyNo"] ?? arr[0]["cmpny_no"];
        return v != null ? String(v) : null;
      }
      return null;
    } catch (e) {
      this.logger.warn(`selectCmpnyInfo failed: ${(e as Error).message}`);
      return null;
    }
  }

  /** JWT payload(가운데 세그먼트)만 base64url 디코드 — 서명 검증 안 함(읽기 전용). */
  private decodeJwtClaims(token: string): Record<string, unknown> {
    try {
      const seg = token.split(".")[1];
      if (!seg) return {};
      const json = Buffer.from(seg.replace(/-/g, "+").replace(/_/g, "/"), "base64").toString("utf8");
      return JSON.parse(json) as Record<string, unknown>;
    } catch {
      return {};
    }
  }

  private postJson(
    urlStr: string,
    headers: Record<string, string>,
    bodyObj: unknown,
    insecure: boolean,
  ): Promise<HttpJsonResult> {
    return new Promise((resolve, reject) => {
      const url = new URL(urlStr);
      const payload = JSON.stringify(bodyObj);
      const req = https.request(
        {
          method: "POST",
          hostname: url.hostname,
          port: url.port || 443,
          path: url.pathname + url.search,
          headers: {
            "Content-Type": "application/json",
            "Content-Length": Buffer.byteLength(payload),
            ...headers,
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
      req.on("timeout", () => req.destroy(new Error("ezpass login timeout")));
      req.write(payload);
      req.end();
    });
  }
}

function pickString(obj: Record<string, unknown>, keys: string[]): string | null {
  for (const k of keys) {
    const v = obj[k];
    if (typeof v === "string" && v.length > 0) return v;
  }
  return null;
}
