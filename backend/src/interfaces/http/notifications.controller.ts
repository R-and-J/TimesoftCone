// 사용자 알림 — 종 아이콘 피드 + 읽음 처리. (ADR-013 Observer 구독 결과)
// ABAC: 본인(:userId == 토큰 주체)이거나 ADMIN만 (SelfOrAdminGuard가 강제).

import { Body, Controller, Get, Param, Post } from "@nestjs/common";
import { ListNotificationsUseCase } from "@/application/notification/list-notifications.use-case";
import { MarkNotificationsReadUseCase } from "@/application/notification/mark-notifications-read.use-case";
import { SelfParam } from "./auth/auth.decorators";

@SelfParam("userId")
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
