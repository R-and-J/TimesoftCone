// AuctionStream — 도메인 이벤트(ADR-013)를 받아 SSE로 브로드캐스트하는 구독자.
// NotificationObserver와 같은 부류의 이벤트 구독자다(Use Case는 이 존재를 모름).
// CUT-6(WebSocket 실시간)의 대체 구현: 우리 케이스는 서버→클라 단방향
// 브로드캐스트뿐이라 양방향 소켓(socket.io) 대신 내장 SSE로 충분 — 새 의존성 0,
// 기존 /api 프록시 그대로 통과.
//
// 페이로드는 "무엇이 바뀌었다"는 *신호*만 담는다(민감정보 없음 → 스트림은 @Public).
// 프론트는 이 신호를 받으면 인증된 GET /auctions/:id 로 정본 상태를 다시 읽는다.
//
// 원칙(관찰자 공통): 핸들러가 입찰/정산 핫패스를 깨면 안 된다 → throw 금지.

import { Injectable, Logger, type MessageEvent } from "@nestjs/common";
import { OnEvent } from "@nestjs/event-emitter";
import { Subject, type Observable } from "rxjs";
import { filter, map } from "rxjs/operators";
import {
  AUCTION_EVENTS,
  type BidPlacedEvent,
  type AuctionWonEvent,
} from "@/application/events/auction-events";
import type { AuctionStreamPort } from "@/ports/auction-stream.port";

type AuctionUpdate =
  | { auctionId: string; type: "bid"; highest: string }
  | { auctionId: string; type: "settled" };

@Injectable()
export class AuctionStream implements AuctionStreamPort {
  private readonly logger = new Logger(AuctionStream.name);
  private readonly updates = new Subject<AuctionUpdate>();

  @OnEvent(AUCTION_EVENTS.BID_PLACED)
  onBidPlaced(e: BidPlacedEvent): void {
    try {
      this.updates.next({ auctionId: e.auctionId, type: "bid", highest: e.amount.toString() });
    } catch (err) {
      this.logger.warn(`bid 브로드캐스트 실패 (${e.auctionId}): ${(err as Error).message}`);
    }
  }

  @OnEvent(AUCTION_EVENTS.WON)
  onAuctionWon(e: AuctionWonEvent): void {
    try {
      this.updates.next({ auctionId: e.auctionId, type: "settled" });
    } catch (err) {
      this.logger.warn(`settled 브로드캐스트 실패 (${e.auctionId}): ${(err as Error).message}`);
    }
  }

  /** 특정 경매의 업데이트만 거른 SSE 스트림. 컨트롤러의 @Sse 핸들러가 반환. */
  streamFor(auctionId: string): Observable<MessageEvent> {
    return this.updates.asObservable().pipe(
      filter((u) => u.auctionId === auctionId),
      map((u) => ({ data: u }) as MessageEvent),
    );
  }
}
