// HrLeaveClientAdapter — HrLeaveClient 구현 (ADR-005 Outbox가 호출).
//
// 두 가지 모드:
//   - HR_API_URL 설정됨 → 그 엔드콘으로 실제 POST (회사 HR API 연동).
//   - 미설정 → Mock: 로그만 남김(연동 시연용). 외부 의존 0.
// 데모용 실패 주입: HR_FAIL_RATE(0~1) 확률로 throw → Outbox 재시도/DLQ 시연.
//
// 어떤 경우에도 ezpass 연차 테이블엔 쓰지 않는다(읽기 전용 정책 — ADR-016/020).

import * as https from "node:https";
import * as http from "node:http";
import { Inject, Injectable, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import type { HrLeaveClient, HrLeaveGrant } from "@/ports/hr-leave-client.port";

@Injectable()
export class HrLeaveClientAdapter implements HrLeaveClient {
  private readonly logger = new Logger(HrLeaveClientAdapter.name);

  constructor(@Inject(ConfigService) private readonly config: ConfigService) {}

  async grantLeave(grant: HrLeaveGrant): Promise<void> {
    // 데모용 실패 주입 (재시도/DLQ 시연).
    const failRate = Number(this.config.get<string>("HR_FAIL_RATE") ?? "0");
    if (failRate > 0 && Math.random() < failRate) {
      throw new Error(`주입된 실패 (HR_FAIL_RATE=${failRate})`);
    }

    const url = this.config.get<string>("HR_API_URL");
    if (!url) {
      // Mock 모드 — 외부 호출 없이 로그만. "연동했다면 이런 호출이 나갔다"를 보여줌.
      this.logger.log(
        `[MOCK HR] 연차 부여 통지 — emp=${grant.empId ?? grant.userId} ${grant.year}년 ${grant.leaveType} ${grant.days}일 (경매 ${grant.auctionId})`,
      );
      return;
    }
    await this.post(url, grant);
    this.logger.log(`[HR] 연차 부여 통지 전송 — emp=${grant.empId ?? grant.userId} 경매 ${grant.auctionId}`);
  }

  private post(urlStr: string, body: unknown): Promise<void> {
    return new Promise((resolve, reject) => {
      const url = new URL(urlStr);
      const payload = JSON.stringify(body);
      const lib = url.protocol === "https:" ? https : http;
      const insecure = this.config.get<string>("HR_TLS_INSECURE") === "true";
      const req = lib.request(
        {
          method: "POST",
          hostname: url.hostname,
          port: url.port || (url.protocol === "https:" ? 443 : 80),
          path: url.pathname + url.search,
          headers: { "Content-Type": "application/json", "Content-Length": Buffer.byteLength(payload) },
          timeout: 10000,
          ...(url.protocol === "https:" ? { agent: new https.Agent({ rejectUnauthorized: !insecure }) } : {}),
        },
        (resp) => {
          const code = resp.statusCode ?? 0;
          resp.resume(); // drain
          if (code >= 200 && code < 300) resolve();
          else reject(new Error(`HR API ${code}`));
        },
      );
      req.on("error", reject);
      req.on("timeout", () => req.destroy(new Error("HR API timeout")));
      req.write(payload);
      req.end();
    });
  }
}
