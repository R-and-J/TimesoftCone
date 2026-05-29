// OutboxRelayScheduler — 트랜잭션 아웃박스 relay 워커 (ADR-005, CUT-4·7 부활).
//
// PENDING 메시지를 주기적으로 polling(기본 10s, OUTBOX_RELAY_INTERVAL_MS)하여
// 외부 HR로 전송한다. 성공 → SENT. 실패 → attempts++ & 지수 백오프로 nextAttemptAt
// 미룸. maxAttempts 초과 → DEAD(=DLQ, admin stats의 dlqDepth로 노출).
//
// setInterval 사용(@nestjs/schedule 미도입, 다른 스케줄러와 동일 패턴). 동시 tick 가드.

import {
  Inject,
  Injectable,
  Logger,
  OnApplicationShutdown,
  OnModuleInit,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { PrismaService } from "@/adapters/persistence/prisma.service";
import { HR_LEAVE_CLIENT, type HrLeaveClient } from "@/ports/hr-leave-client.port";

const DEFAULT_INTERVAL_MS = 10_000;
const BATCH = 20;
const BACKOFF_BASE_MS = 15_000; // 15s, 30s, 60s, … (지수, 30분 캡)
const BACKOFF_CAP_MS = 30 * 60_000;

@Injectable()
export class OutboxRelayScheduler implements OnModuleInit, OnApplicationShutdown {
  private readonly logger = new Logger(OutboxRelayScheduler.name);
  private timer: NodeJS.Timeout | null = null;
  private running = false;

  constructor(
    private readonly config: ConfigService,
    private readonly prisma: PrismaService,
    @Inject(HR_LEAVE_CLIENT) private readonly hr: HrLeaveClient,
  ) {}

  onModuleInit() {
    const raw = this.config.get<string>("OUTBOX_RELAY_INTERVAL_MS");
    const intervalMs = raw === undefined ? DEFAULT_INTERVAL_MS : Number(raw);
    if (!Number.isFinite(intervalMs) || intervalMs <= 0) {
      this.logger.warn("OUTBOX_RELAY_INTERVAL_MS=0/invalid; outbox relay disabled.");
      return;
    }
    this.logger.log(`Outbox relay enabled (every ${intervalMs}ms)`);
    this.timer = setInterval(() => void this.tick(), intervalMs);
  }

  onApplicationShutdown() {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
  }

  private async tick(): Promise<void> {
    if (this.running) return;
    this.running = true;
    try {
      const due = await this.prisma.outboxMessage.findMany({
        where: { status: "PENDING", nextAttemptAt: { lte: new Date() } },
        orderBy: { nextAttemptAt: "asc" },
        take: BATCH,
      });
      let sent = 0;
      let dead = 0;
      for (const msg of due) {
        try {
          await this.dispatch(msg.topic, msg.payload);
          await this.prisma.outboxMessage.update({
            where: { id: msg.id },
            data: { status: "SENT", sentAt: new Date(), lastError: null },
          });
          sent++;
        } catch (err) {
          const attempts = msg.attempts + 1;
          const errMsg = (err as Error).message?.slice(0, 300) ?? "unknown";
          if (attempts >= msg.maxAttempts) {
            await this.prisma.outboxMessage.update({
              where: { id: msg.id },
              data: { status: "DEAD", attempts, lastError: errMsg },
            });
            dead++;
            this.logger.warn(`Outbox #${msg.id} DEAD (${attempts}회 실패): ${errMsg}`);
          } else {
            const backoff = Math.min(BACKOFF_BASE_MS * 2 ** (attempts - 1), BACKOFF_CAP_MS);
            await this.prisma.outboxMessage.update({
              where: { id: msg.id },
              data: { attempts, lastError: errMsg, nextAttemptAt: new Date(Date.now() + backoff) },
            });
          }
        }
      }
      if (sent || dead) this.logger.log(`Outbox relay: sent=${sent} dead=${dead}`);
    } catch (err) {
      this.logger.error(`Outbox tick errored: ${(err as Error).message}`);
    } finally {
      this.running = false;
    }
  }

  /** topic별 디스패치. 현재 HR_LEAVE_GRANT 하나. payload는 userId만 담고 여기서 enrich. */
  private async dispatch(topic: string, payloadJson: string): Promise<void> {
    if (topic !== "HR_LEAVE_GRANT") {
      throw new Error(`알 수 없는 outbox topic: ${topic}`);
    }
    const p = JSON.parse(payloadJson) as {
      userId: string;
      year: number;
      days: number;
      leaveType: "AUCTION";
      auctionId: string;
    };
    const user = await this.prisma.user.findUnique({
      where: { id: BigInt(p.userId) },
      select: { empId: true, email: true },
    });
    await this.hr.grantLeave({
      userId: p.userId,
      empId: user?.empId ?? null,
      email: user?.email ?? null,
      year: p.year,
      days: p.days,
      leaveType: p.leaveType,
      auctionId: p.auctionId,
    });
  }
}
