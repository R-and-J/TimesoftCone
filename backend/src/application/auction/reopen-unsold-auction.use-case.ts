// FR-4.2 확장(2026-06-04 결정) — UNSOLD 매물을 새 1일권 경매로 재오픈.
// EVENT 휴가 지급(GrantEventFromUnsoldUseCase)과 동일한 "인벤토리 소진" 패턴 위에,
// 같은 트랜잭션에서 신규 매물 1개를 만든다. 시작가는 정책 고정 30,000 P, leaveDays 1.
// 새 매물은 CREATED 상태 — OpenDueAuctionsScheduler가 startedAt 도래 시 자동 OPEN.

import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { PrismaService } from "@/adapters/persistence/prisma.service";

const FIXED_START_PRICE = 30000n;
const FIXED_MIN_INCREMENT = 100n;

export type ReopenUnsoldInput = {
  auctionId: string;
  startedAt: Date | string;
  endsAt: Date | string;
};

export type ReopenUnsoldResult = {
  sourceId: string;
  newId: string;
  startedAt: Date;
  endsAt: Date;
};

@Injectable()
export class ReopenUnsoldAuctionUseCase {
  constructor(private readonly prisma: PrismaService) {}

  async execute(input: ReopenUnsoldInput): Promise<ReopenUnsoldResult> {
    const startedAt = new Date(input.startedAt);
    const endsAt = new Date(input.endsAt);
    if (Number.isNaN(startedAt.getTime()) || Number.isNaN(endsAt.getTime())) {
      throw new BadRequestException("startedAt/endsAt이 유효한 시각이 아닙니다");
    }
    if (!(endsAt.getTime() > startedAt.getTime())) {
      throw new BadRequestException("endsAt은 startedAt보다 늦어야 합니다");
    }

    return this.prisma.$transaction(async (tx) => {
      const a = await tx.auction.findUnique({ where: { id: input.auctionId } });
      if (!a) throw new NotFoundException(`Auction ${input.auctionId} not found`);
      if (a.status !== "UNSOLD") {
        throw new ConflictException(
          `Auction ${input.auctionId} status is ${a.status}; only UNSOLD can be reopened`,
        );
      }

      // 새 매물 ID 채번 — startedAt 기준 연도의 A-YYYY-NNN 중 최대 시퀀스 다음.
      const year = startedAt.getFullYear();
      const prefix = `A-${year}-`;
      const existing = await tx.auction.findMany({
        where: { id: { startsWith: prefix } },
        select: { id: true },
      });
      const maxSeq = existing.reduce((max, x) => {
        const n = Number(x.id.slice(prefix.length));
        return Number.isFinite(n) && n > max ? n : max;
      }, 0);
      const newId = `${prefix}${String(maxSeq + 1).padStart(3, "0")}`;

      await tx.auction.create({
        data: {
          id: newId,
          status: "CREATED",
          startPrice: FIXED_START_PRICE,
          highest: FIXED_START_PRICE,
          minIncrement: FIXED_MIN_INCREMENT,
          leaveDays: 1,
          startedAt,
          endsAt,
          companyId: a.companyId,
        },
      });

      // 원본 UNSOLD 매물 소진 — UNSOLD는 BidEvent도 낙찰자도 없어 그냥 delete 가능.
      await tx.auction.delete({ where: { id: a.id } });

      return { sourceId: a.id, newId, startedAt, endsAt };
    });
  }
}
