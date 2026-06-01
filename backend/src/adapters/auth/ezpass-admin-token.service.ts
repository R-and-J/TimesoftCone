// EzpassAdminTokenService — 시스템 호출용 admin 토큰 캐시.
//
// 낙찰 통지를 OutboxRelay가 ezpass REST(AdmDlz0070M/streYryc 등)로 부를 때
// 사용자 컨텍스트가 없으므로, 시스템용 admin 계정으로 한번 로그인해서 받은
// userToken을 메모리에 캐싱한다. 만료 시각 가까워지면 자동 재로그인.
//
// admin 자격은 .env(`EZPASS_SYSTEM_USER` / `EZPASS_SYSTEM_PW`)에서만 읽고
// 코드/로그에 노출하지 않는다. cmpny_no는 토큰 자체에 박혀 있으므로
// REST 호출 시 cmpny 가드는 토큰에서 자동 적용된다.

import * as https from "node:https";
import { Inject, Injectable, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";

type HttpJsonResult = { status: number; body: string };

@Injectable()
export class EzpassAdminTokenService {
  private readonly logger = new Logger(EzpassAdminTokenService.name);
  private token: string | null = null;
  private expiresAt = 0; // epoch ms; 0이면 만료된 것으로 간주.
  private inflight: Promise<string> | null = null;

  constructor(@Inject(ConfigService) private readonly config: ConfigService) {}

  /** 유효한 토큰을 반환. 만료 1분 전부터는 미리 재로그인. */
  async getToken(): Promise<string> {
    const skewMs = 60_000;
    if (this.token && Date.now() < this.expiresAt - skewMs) return this.token;
    if (this.inflight) return this.inflight;
    this.inflight = this.login().finally(() => (this.inflight = null));
    return this.inflight;
  }

  /** 401 응답을 받았을 때 호출 — 캐시 무효화 후 한 번 재로그인. */
  async refreshOnUnauthorized(): Promise<string> {
    this.token = null;
    this.expiresAt = 0;
    return this.getToken();
  }

  private async login(): Promise<string> {
    const base = this.requireConfig("EZPASS_BASE_URL");
    const id = this.requireConfig("EZPASS_SYSTEM_USER");
    const password = this.requireConfig("EZPASS_SYSTEM_PW");
    const locale = this.config.get<string>("EZPASS_LOCALE") ?? "ko-KR";
    const insecure = this.config.get<string>("EZPASS_TLS_INSECURE") === "true";
    const cmpnyNo = this.config.get<string>("EZPASS_SYSTEM_CMPNY_NO") ?? "7";

    const res = await this.postJson(
      `${base}/v1/lgn/bfe/LgnBfe0020M/login`,
      { locale },
      { id, password, cmpnyNo },
      insecure,
    );
    if (res.status !== 200) {
      this.logger.error(`ezpass admin login failed (status=${res.status}): ${res.body.slice(0, 300)}`);
      throw new Error(`ezpass admin login failed (status=${res.status})`);
    }
    const parsed = JSON.parse(res.body) as { userToken?: string; tokenEndDt?: string };
    if (!parsed.userToken) throw new Error("ezpass admin login: userToken 없음");
    this.token = parsed.userToken;
    this.expiresAt = parsed.tokenEndDt ? Date.parse(parsed.tokenEndDt) : Date.now() + 3600_000;
    if (!Number.isFinite(this.expiresAt) || this.expiresAt <= Date.now()) {
      this.expiresAt = Date.now() + 3600_000;
    }
    this.logger.log(`ezpass admin token 획득 (만료 ${new Date(this.expiresAt).toISOString()})`);
    return this.token;
  }

  private requireConfig(key: string): string {
    const v = this.config.get<string>(key);
    if (!v) throw new Error(`${key}가 설정되지 않았습니다 (.env)`);
    return v;
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
