// NotificationObserver — 도메인 이벤트(ADR-013)의 첫 실구독자.
// PlaceBid/SettleAuction이 발행한 이벤트를 받아 notification 행을 적재한다.
// 핫패스(입찰/정산)는 이 핸들러를 모른다(Use Case는 구독자 무지).
//
// 원칙: 핸들러 실패가 입찰/정산을 깨면 안 된다 → throw 금지, 로그만. 발행은 커밋
// 후라 여기서 DB 쓰기는 별도 작업(트랜잭션 분리).

import { Injectable, Logger } from "@nestjs/common";
import { OnEvent } from "@nestjs/event-emitter";
import { PrismaService } from "@/adapters/persistence/prisma.service";
import {
  AUCTION_EVENTS,
  type BidPlacedEvent,
  type AuctionWonEvent,
  type AuctionInventoryCreatedEvent,
} from "@/application/events/auction-events";

const won = (n: bigint) => Number(n).toLocaleString("ko-KR");

@Injectable()
export class NotificationObserver {
  private readonly logger = new Logger(NotificationObserver.name);

  constructor(private readonly prisma: PrismaService) {}

  /** 입찰 밀림 → 직전 최고가 입찰자에게 알림. */
  @OnEvent(AUCTION_EVENTS.BID_PLACED)
  async onBidPlaced(e: BidPlacedEvent): Promise<void> {
    if (e.previousHighBidderId === null) return; // 첫 입찰 — 밀린 사람 없음
    try {
      await this.prisma.notification.create({
        data: {
          userId: e.previousHighBidderId,
          type: "OUTBID",
          title: "입찰이 밀렸어요",
          message: `경매 ${e.auctionId}에서 더 높은 입찰이 나왔습니다. 현재가 ${won(e.amount)}P — 다시 입찰하시겠어요?`,
          auctionId: e.auctionId,
        },
      });
    } catch (err) {
      this.logger.warn(`OUTBID 알림 적재 실패 (${e.auctionId}): ${(err as Error).message}`);
    }
  }

  /** 연말 풀 수집 → 모든 ADMIN에게 운영 알림 (ADR-017). */
  @OnEvent(AUCTION_EVENTS.INVENTORY_CREATED)
  async onInventoryCreated(e: AuctionInventoryCreatedEvent): Promise<void> {
    try {
      const admins = await this.prisma.user.findMany({
        where: { role: "ADMIN", active: true },
        select: { id: true },
      });
      if (admins.length === 0) return;
      const message = `${e.targetYear}년 경매 매물 ${e.auctionsCreated}개가 생성되었습니다 (기여자 ${e.contributorCount}명).`;
      await this.prisma.notification.createMany({
        data: admins.map((u) => ({
          userId: u.id,
          type: "INVENTORY_CREATED",
          title: "연말 풀 수집 완료",
          message,
          auctionId: null,
        })),
      });
    } catch (err) {
      this.logger.warn(
        `INVENTORY_CREATED 알림 적재 실패 (${e.targetYear}): ${(err as Error).message}`,
      );
    }
  }

  /** 낙찰 → 낙찰자에게 알림. */
  @OnEvent(AUCTION_EVENTS.WON)
  async onAuctionWon(e: AuctionWonEvent): Promise<void> {
    try {
      await this.prisma.notification.create({
        data: {
          userId: e.winnerId,
          type: "AUCTION_WON",
          title: "낙찰됐어요 🎉",
          message: `경매 ${e.auctionId} 낙찰 — 연차 ${e.leaveDays}일권을 ${won(e.amount)}P에 획득했습니다.`,
          auctionId: e.auctionId,
        },
      });
    } catch (err) {
      this.logger.warn(`AUCTION_WON 알림 적재 실패 (${e.auctionId}): ${(err as Error).message}`);
    }
  }
}
