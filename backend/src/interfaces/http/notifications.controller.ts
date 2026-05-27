// 사용자 알림 — 종 아이콘 피드 + 읽음 처리. (ADR-013 Observer 구독 결과)
// RBAC는 아직 없음(scope-cuts CUT-8) — 본인 알림만 봐야 하는 가드는 후속.

import { Body, Controller, Get, Param, Post } from "@nestjs/common";
import { ListNotificationsUseCase } from "@/application/notification/list-notifications.use-case";
import { MarkNotificationsReadUseCase } from "@/application/notification/mark-notifications-read.use-case";

@Controller("api/users/:userId/notifications")
export class NotificationsController {
  constructor(
    private readonly list: ListNotificationsUseCase,
    private readonly markRead: MarkNotificationsReadUseCase,
  ) {}

  @Get()
  async listNotifications(@Param("userId") userId: string) {
    return this.list.execute(userId);
  }

  @Post("read")
  async readNotifications(@Param("userId") userId: string, @Body() body: { ids?: string[] }) {
    return this.markRead.execute(userId, body?.ids);
  }
}
