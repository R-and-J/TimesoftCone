// NotificationStream — 사용자별 알림 SSE 브로드캐스터.
// NotificationObserver가 DB 적재 직후 emit 하는 NOTIFICATION_EVENTS.CREATED 이벤트를
// 받아 Subject에 흘려보내고, 컨트롤러의 @Sse 핸들러가 userId 필터 후 Observable로 반환.
//
// 패턴은 AuctionStream과 동일. 의존성 추가 0(NestJS 내장 SSE).
//
// 원칙: 핸들러가 도메인 핫패스를 깨면 안 된다 → throw 금지.

import { Injectable, Logger, type MessageEvent } from "@nestjs/common";
import { OnEvent } from "@nestjs/event-emitter";
import { Subject, type Observable } from "rxjs";
import { filter, map } from "rxjs/operators";
import {
  NOTIFICATION_EVENTS,
  NotificationCreatedEvent,
} from "@/application/events/notification-events";

type NotificationUpdate = {
  userId: string;
  type: string;
  title: string;
  message: string;
  linkPath: string | null;
};

@Injectable()
export class NotificationStream {
  private readonly logger = new Logger(NotificationStream.name);
  private readonly updates = new Subject<NotificationUpdate>();

  @OnEvent(NOTIFICATION_EVENTS.CREATED)
  onCreated(e: NotificationCreatedEvent): void {
    try {
      this.updates.next({
        userId: e.userId.toString(),
        type: e.type,
        title: e.title,
        message: e.message,
        linkPath: e.linkPath,
      });
    } catch (err) {
      this.logger.warn(`알림 SSE 브로드캐스트 실패 (user=${e.userId}): ${(err as Error).message}`);
    }
  }

  /** 특정 사용자에게 가는 알림만 거른 SSE 스트림. 컨트롤러의 @Sse 핸들러가 반환. */
  streamFor(userId: string): Observable<MessageEvent> {
    return this.updates.asObservable().pipe(
      filter((u) => u.userId === userId),
      map((u) => ({ data: u }) as MessageEvent),
    );
  }
}
