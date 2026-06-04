// 사용자 알림 — 종 아이콘 피드 + 읽음 처리 + 실시간 SSE 스트림.
// ABAC: 본인(:userId == 토큰 주체)이거나 ADMIN만 (SelfOrAdminGuard가 강제).
// SSE: EventSource는 헤더 못 보내서 ?token= 쿼리로 JWT 인증(JwtAuthGuard가 지원).

import { Body, Controller, Get, Param, Post, Sse, type MessageEvent } from "@nestjs/common";
import type { Observable } from "rxjs";
import { ListNotificationsUseCase } from "@/application/notification/list-notifications.use-case";
import { MarkNotificationsReadUseCase } from "@/application/notification/mark-notifications-read.use-case";
import { NotificationStream } from "@/adapters/realtime/notification-stream";
import { SelfParam } from "./auth/auth.decorators";

@SelfParam("userId")
@Controller("api/users/:userId/notifications")
export class NotificationsController {
  constructor(
    private readonly list: ListNotificationsUseCase,
    private readonly markRead: MarkNotificationsReadUseCase,
    private readonly stream: NotificationStream,
  ) {}

  @Get()
  async listNotifications(@Param("userId") userId: string) {
    return this.list.execute(userId);
  }

  @Post("read")
  async readNotifications(@Param("userId") userId: string, @Body() body: { ids?: string[] }) {
    return this.markRead.execute(userId, body?.ids);
  }

  /** SSE — 실시간 알림 push. 클라가 EventSource로 연결 → 새 알림 적재 시 즉시 수신.
   *  메시지는 신호만(type/title/message/linkPath). 클라는 GET 으로 정본 다시 불러옴. */
  @Sse("stream")
  streamNotifications(@Param("userId") userId: string): Observable<MessageEvent> {
    return this.stream.streamFor(userId);
  }
}
