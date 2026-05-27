// MarkNotificationsRead — 알림 읽음 처리. ids 주면 그것만, 없으면 전체.

import { Injectable } from "@nestjs/common";
import { PrismaService } from "@/adapters/persistence/prisma.service";
import { UserId } from "@/domain/shared/value-objects/user-id";

@Injectable()
export class MarkNotificationsReadUseCase {
  constructor(private readonly prisma: PrismaService) {}

  async execute(userIdRaw: string | bigint | number, ids?: string[]): Promise<{ updated: number }> {
    const userId = UserId.of(userIdRaw).toBigInt();
    const idFilter =
      ids && ids.length > 0
        ? { id: { in: ids.filter((s) => /^\d+$/.test(s)).map((s) => BigInt(s)) } }
        : {};
    const r = await this.prisma.notification.updateMany({
      where: { userId, read: false, ...idFilter },
      data: { read: true },
    });
    return { updated: r.count };
  }
}
