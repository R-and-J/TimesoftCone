// NotificationObserver — 도메인 이벤트(ADR-013)의 첫 실구독자.
// PlaceBid/SettleAuction이 발행한 이벤트를 받아 notification 행을 적재한다.
// 핫패스(입찰/정산)는 이 핸들러를 모른다(Use Case는 구독자 무지).
//
// 원칙: 핸들러 실패가 입찰/정산을 깨면 안 된다 → throw 금지, 로그만. 발행은 커밋
// 후라 여기서 DB 쓰기는 별도 작업(트랜잭션 분리).

import { Injectable, Logger } from "@nestjs/common";
import { EventEmitter2, OnEvent } from "@nestjs/event-emitter";
import { PrismaService } from "@/adapters/persistence/prisma.service";
import {
  NOTIFICATION_EVENTS,
  NotificationCreatedEvent,
} from "@/application/events/notification-events";
import {
  AUCTION_EVENTS,
  type BidPlacedEvent,
  type AuctionWonEvent,
  type AuctionInventoryCreatedEvent,
} from "@/application/events/auction-events";
import {
  CHARGE_EVENTS,
  type ChargeRequestSubmittedEvent,
  type ChargeApprovedEvent,
  type ChargeRejectedEvent,
} from "@/application/events/charge-events";
import {
  REDEMPTION_EVENTS,
  type RedemptionRequestSubmittedEvent,
  type RedemptionApprovedEvent,
  type RedemptionRejectedEvent,
  type RedemptionReceivedEvent,
} from "@/application/events/redemption-events";

const won = (n: bigint) => Number(n).toLocaleString("ko-KR");

@Injectable()
export class NotificationObserver {
  private readonly logger = new Logger(NotificationObserver.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly events: EventEmitter2,
  ) {}

  /** DB 적재 후 SSE 스트림(NotificationStream)에 신호 push. */
  private notify(
    userId: bigint,
    type: string,
    title: string,
    message: string,
    linkPath: string | null = null,
  ): void {
    try {
      this.events.emit(
        NOTIFICATION_EVENTS.CREATED,
        new NotificationCreatedEvent(userId, type, title, message, linkPath),
      );
    } catch (err) {
      this.logger.warn(`SSE push 실패 (${type}, user=${userId}): ${(err as Error).message}`);
    }
  }

  /** 여러 수신자(예: 모든 ADMIN)에게 한꺼번에 push. */
  private notifyMany(
    userIds: bigint[],
    type: string,
    title: string,
    message: string,
    linkPath: string | null = null,
  ): void {
    for (const userId of userIds) this.notify(userId, type, title, message, linkPath);
  }

  /** 멀티테넌시: 특정 회사 관리자 + 최고관리자(super, role=ADMIN·무소속) id 목록.
   *  companyId=null이면 전 회사 관리자(super 수집 등). */
  private async adminRecipients(
    companyId: bigint | null,
  ): Promise<{ id: bigint; companyId: bigint | null }[]> {
    const where =
      companyId == null
        ? { active: true, role: { in: ["ADMIN", "EZPASS_ADMIN", "EXAM_ADMIN"] } }
        : {
            active: true,
            OR: [
              { role: "ADMIN" }, // 최고관리자는 전 회사 알림 수신
              { role: { in: ["EZPASS_ADMIN", "EXAM_ADMIN"] }, companyId },
            ],
          };
    return this.prisma.user.findMany({ where, select: { id: true, companyId: true } });
  }

  /** 회사 미상인 수령자 회사 조회(개인 알림 태깅용). */
  private async companyOf(userId: bigint): Promise<bigint | null> {
    const u = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { companyId: true },
    });
    return u?.companyId ?? null;
  }

  /** 입찰 밀림 → 직전 최고가 입찰자에게 알림. */
  @OnEvent(AUCTION_EVENTS.BID_PLACED)
  async onBidPlaced(e: BidPlacedEvent): Promise<void> {
    if (e.previousHighBidderId === null) return; // 첫 입찰 — 밀린 사람 없음
    try {
      const link = `/auction/detail/${e.auctionId}`;
      const title = "입찰이 밀렸어요";
      const message = `경매 ${e.auctionId}에서 더 높은 입찰이 나왔습니다. 현재가 ${won(e.amount)}콘 — 다시 입찰하시겠어요?`;
      await this.prisma.notification.create({
        data: {
          userId: e.previousHighBidderId,
          type: "OUTBID",
          title,
          message,
          auctionId: e.auctionId,
          linkPath: link,
          companyId: (await this.companyOf(e.previousHighBidderId)) ?? 1n,
        },
      });
      this.notify(e.previousHighBidderId, "OUTBID", title, message, link);
    } catch (err) {
      this.logger.warn(`OUTBID 알림 적재 실패 (${e.auctionId}): ${(err as Error).message}`);
    }
  }

  /** 연말 풀 수집 → 모든 ADMIN에게 운영 알림 (ADR-017). */
  @OnEvent(AUCTION_EVENTS.INVENTORY_CREATED)
  async onInventoryCreated(e: AuctionInventoryCreatedEvent): Promise<void> {
    try {
      const source = e.companyId ?? 1n;
      const admins = await this.adminRecipients(e.companyId);
      if (admins.length === 0) return;
      const message = `${e.targetYear}년 경매 매물 ${e.auctionsCreated}개가 생성되었습니다 (기여자 ${e.contributorCount}명).`;
      const title = "연말 풀 수집 완료";
      const link = "/admin/auctions";
      await this.prisma.notification.createMany({
        data: admins.map((u) => ({
          userId: u.id,
          type: "INVENTORY_CREATED",
          title,
          message,
          auctionId: null,
          linkPath: link,
          companyId: source,
        })),
      });
      this.notifyMany(admins.map((u) => u.id), "INVENTORY_CREATED", title, message, link);
    } catch (err) {
      this.logger.warn(
        `INVENTORY_CREATED 알림 적재 실패 (${e.targetYear}): ${(err as Error).message}`,
      );
    }
  }

  /** 충전 요청 등록 → 모든 ADMIN에게 알림(ADR-024). */
  @OnEvent(CHARGE_EVENTS.SUBMITTED)
  async onChargeRequestSubmitted(e: ChargeRequestSubmittedEvent): Promise<void> {
    try {
      const source = (await this.companyOf(e.requesterId)) ?? 1n;
      const admins = await this.adminRecipients(source);
      if (admins.length === 0) return;
      const msg = `${e.requesterName} — ${won(e.amount)}콘 충전 요청` + (e.note ? ` (사유: ${e.note})` : "");
      const title = "새 충전 요청";
      const link = `/admin/members?chargeRequest=${e.requestId}`;
      await this.prisma.notification.createMany({
        data: admins.map((u) => ({
          userId: u.id,
          type: "CHARGE_REQUEST_SUBMITTED",
          title,
          message: msg,
          linkPath: link,
          companyId: source,
        })),
      });
      this.notifyMany(admins.map((u) => u.id), "CHARGE_REQUEST_SUBMITTED", title, msg, link);
    } catch (err) {
      this.logger.warn(`CHARGE_REQUEST_SUBMITTED 알림 적재 실패 (#${e.requestId}): ${(err as Error).message}`);
    }
  }

  /** 충전 승인 → 요청자에게 알림. */
  @OnEvent(CHARGE_EVENTS.APPROVED)
  async onChargeApproved(e: ChargeApprovedEvent): Promise<void> {
    try {
      const title = "충전 승인됨 ✅";
      const message = `+${won(e.amount)}콘 가 지갑에 적립되었습니다.`;
      await this.prisma.notification.create({
        data: {
          userId: e.requesterId,
          type: "CHARGE_APPROVED",
          title,
          message,
          linkPath: "/activity",
          companyId: (await this.companyOf(e.requesterId)) ?? 1n,
        },
      });
      this.notify(e.requesterId, "CHARGE_APPROVED", title, message, "/activity");
    } catch (err) {
      this.logger.warn(`CHARGE_APPROVED 알림 적재 실패 (#${e.requestId}): ${(err as Error).message}`);
    }
  }

  /** 충전 반려 → 요청자에게 알림(사유 포함). */
  @OnEvent(CHARGE_EVENTS.REJECTED)
  async onChargeRejected(e: ChargeRejectedEvent): Promise<void> {
    try {
      const tail = e.decisionNote ? ` — ${e.decisionNote}` : "";
      const title = "충전 요청 반려";
      const message = `${won(e.amount)}콘 충전 요청이 반려되었습니다.${tail}`;
      await this.prisma.notification.create({
        data: {
          userId: e.requesterId,
          type: "CHARGE_REJECTED",
          title,
          message,
          linkPath: "/activity",
          companyId: (await this.companyOf(e.requesterId)) ?? 1n,
        },
      });
      this.notify(e.requesterId, "CHARGE_REJECTED", title, message, "/activity");
    } catch (err) {
      this.logger.warn(`CHARGE_REJECTED 알림 적재 실패 (#${e.requestId}): ${(err as Error).message}`);
    }
  }

  /** 교환 신청 등록 → 모든 ADMIN에게 알림 (ADR-023 v2). */
  @OnEvent(REDEMPTION_EVENTS.SUBMITTED)
  async onRedemptionSubmitted(e: RedemptionRequestSubmittedEvent): Promise<void> {
    try {
      const source = (await this.companyOf(e.requesterId)) ?? 1n;
      const admins = await this.adminRecipients(source);
      if (admins.length === 0) return;
      const title = "새 교환 신청";
      const message = `${e.requesterName} — ${e.itemName} (${won(e.priceP)}콘) 신청`;
      const link = "/admin/redemption";
      await this.prisma.notification.createMany({
        data: admins.map((u) => ({
          userId: u.id,
          type: "REDEMPTION_REQUEST_SUBMITTED",
          title,
          message,
          linkPath: link,
          companyId: source,
        })),
      });
      this.notifyMany(admins.map((u) => u.id), "REDEMPTION_REQUEST_SUBMITTED", title, message, link);
    } catch (err) {
      this.logger.warn(`REDEMPTION_REQUEST_SUBMITTED 알림 적재 실패 (#${e.requestId}): ${(err as Error).message}`);
    }
  }

  /** 교환 승인 + 쿠폰 발급 → 요청자에게 알림(/redemption에서 쿠폰 확인 후 수령 컨펌). */
  @OnEvent(REDEMPTION_EVENTS.APPROVED)
  async onRedemptionApproved(e: RedemptionApprovedEvent): Promise<void> {
    try {
      const title = "교환 승인됨 — 쿠폰 발급";
      const message = `${e.itemName} 신청이 승인됐어요. 쿠폰을 확인하고 수령 완료를 눌러주세요.`;
      await this.prisma.notification.create({
        data: {
          userId: e.requesterId,
          type: "REDEMPTION_APPROVED",
          title,
          message,
          linkPath: "/redemption",
          companyId: (await this.companyOf(e.requesterId)) ?? 1n,
        },
      });
      this.notify(e.requesterId, "REDEMPTION_APPROVED", title, message, "/redemption");
    } catch (err) {
      this.logger.warn(`REDEMPTION_APPROVED 알림 적재 실패 (#${e.requestId}): ${(err as Error).message}`);
    }
  }

  /** 교환 반려 → 요청자에게 알림(환불됨 + 사유). */
  @OnEvent(REDEMPTION_EVENTS.REJECTED)
  async onRedemptionRejected(e: RedemptionRejectedEvent): Promise<void> {
    try {
      const tail = e.decisionNote ? ` — ${e.decisionNote}` : "";
      const title = "교환 신청 반려";
      const message = `${e.itemName} 신청이 반려됐어요. ${won(e.refundP)}콘 환불 완료.${tail}`;
      await this.prisma.notification.create({
        data: {
          userId: e.requesterId,
          type: "REDEMPTION_REJECTED",
          title,
          message,
          linkPath: "/redemption",
          companyId: (await this.companyOf(e.requesterId)) ?? 1n,
        },
      });
      this.notify(e.requesterId, "REDEMPTION_REJECTED", title, message, "/redemption");
    } catch (err) {
      this.logger.warn(`REDEMPTION_REJECTED 알림 적재 실패 (#${e.requestId}): ${(err as Error).message}`);
    }
  }

  /** 사용자 수령 컨펌 → 모든 ADMIN에게 알림(처리 종결). */
  @OnEvent(REDEMPTION_EVENTS.RECEIVED)
  async onRedemptionReceived(e: RedemptionReceivedEvent): Promise<void> {
    try {
      const source = (await this.companyOf(e.requesterId)) ?? 1n;
      const admins = await this.adminRecipients(source);
      if (admins.length === 0) return;
      const title = "교환 수령 확인";
      const message = `${e.requesterName} — ${e.itemName} 수령 완료`;
      const link = "/admin/redemption";
      await this.prisma.notification.createMany({
        data: admins.map((u) => ({
          userId: u.id,
          type: "REDEMPTION_RECEIVED",
          title,
          message,
          linkPath: link,
          companyId: source,
        })),
      });
      this.notifyMany(admins.map((u) => u.id), "REDEMPTION_RECEIVED", title, message, link);
    } catch (err) {
      this.logger.warn(`REDEMPTION_RECEIVED 알림 적재 실패 (#${e.requestId}): ${(err as Error).message}`);
    }
  }

  /** 낙찰 → 낙찰자에게 알림. */
  @OnEvent(AUCTION_EVENTS.WON)
  async onAuctionWon(e: AuctionWonEvent): Promise<void> {
    try {
      const title = "낙찰됐어요 🎉";
      const message = `경매 ${e.auctionId} 낙찰 — 연차 ${e.leaveDays}일권을 ${won(e.amount)}P에 획득했습니다.`;
      const link = `/auction/detail/${e.auctionId}`;
      await this.prisma.notification.create({
        data: {
          userId: e.winnerId,
          type: "AUCTION_WON",
          title,
          message,
          auctionId: e.auctionId,
          linkPath: link,
          companyId: (await this.companyOf(e.winnerId)) ?? 1n,
        },
      });
      this.notify(e.winnerId, "AUCTION_WON", title, message, link);
    } catch (err) {
      this.logger.warn(`AUCTION_WON 알림 적재 실패 (${e.auctionId}): ${(err as Error).message}`);
    }
  }
}
