// ListNotifications — 종 아이콘 피드. 최근 알림 + 안 읽음 수.

import { Injectable } from "@nestjs/common";
import { PrismaService } from "@/adapters/persistence/prisma.service";
import { UserId } from "@/domain/shared/value-objects/user-id";

export type NotificationRow = {
  id: string;
  type: string;
  title: string;
  message: string;
  auctionId: string | null;
  /** 클릭 시 이동할 프론트엔드 경로(예: "/auction/detail/A-2026-110"). 없으면 이동 X. */
  linkPath: string | null;
  read: boolean;
  createdAt: Date;
};

export type NotificationList = {
  unread: number;
  items: NotificationRow[];
};

@Injectable()
export class ListNotificationsUseCase {
  constructor(private readonly prisma: PrismaService) {}

  async execute(userIdRaw: string | bigint | number, limit = 30): Promise<NotificationList> {
    const userId = UserId.of(userIdRaw).toBigInt();
    const [rows, unread] = await Promise.all([
      this.prisma.notification.findMany({
        where: { userId },
        orderBy: { createdAt: "desc" },
        take: limit,
      }),
      this.prisma.notification.count({ where: { userId, read: false } }),
    ]);
    return {
      unread,
      items: rows.map((n) => ({
        id: String(n.id),
        type: n.type,
        title: n.title,
        message: n.message,
        auctionId: n.auctionId,
        linkPath: n.linkPath,
        read: n.read,
        createdAt: n.createdAt,
      })),
    };
  }
}
