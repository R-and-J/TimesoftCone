// RedeemItem — 포인트 교환(ADR-023). 단일 트랜잭션:
//   1) 재고 원자적 감소(SQLite write 락 + 조건부 UPDATE, 오버셀 방지).
//   2) 지갑 잔액 확인 + 차감.
//   3) ledger REDEEM INSERT(음수 amount).
//   4) redemption_order INSERT (PENDING).
//   5) RedemptionChannel.deliver()로 발송 — 내부 카탈로그는 즉시 FULFILLED + ref.
//   6) order 갱신(status, deliveryRef).
// 인바리언트: DB-RULE-1(insert-only ledger), wallet balance_after ≥ 0(CHECK).

import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { PrismaService } from "@/adapters/persistence/prisma.service";
import {
  REDEMPTION_CHANNEL,
  type RedemptionChannel,
} from "@/ports/redemption-channel.port";

export type RedeemResult = {
  orderId: number;
  itemId: number;
  itemName: string;
  pricePAtRedeem: string;
  status: "FULFILLED" | "PENDING" | "FAILED";
  deliveryRef: string | null;
  newBalance: string;
};

@Injectable()
export class RedeemItemUseCase {
  constructor(
    private readonly prisma: PrismaService,
    @Inject(REDEMPTION_CHANNEL) private readonly channel: RedemptionChannel,
  ) {}

  async execute(userIdRaw: bigint | string | number, itemId: number): Promise<RedeemResult> {
    const userId = BigInt(userIdRaw);

    // 트랜잭션 안에서 1~4까지 처리. 5는 외부의존 없는 내부 채널이라 같이 묶음.
    const result = await this.prisma.$transaction(async (tx) => {
      // 1) 재고 원자적 감소. stock=NULL(무제한)이면 그대로 유지. active=true 한정.
      const dec = await tx.$executeRaw`
        UPDATE redemption_item
           SET stock = CASE WHEN stock IS NULL THEN NULL ELSE stock - 1 END
         WHERE id = ${itemId}
           AND active = 1
           AND (stock IS NULL OR stock > 0)
      `;
      if (dec === 0) {
        // 미존재/비활성/품절. 어떤 케이스인지 확인해 에러 분기.
        const it = await tx.redemptionItem.findUnique({ where: { id: itemId } });
        if (!it) throw new NotFoundException(`상품을 찾을 수 없습니다 (id ${itemId})`);
        if (!it.active) throw new BadRequestException("판매 중지된 상품입니다.");
        throw new ConflictException("재고가 모두 소진되었습니다.");
      }
      const item = await tx.redemptionItem.findUniqueOrThrow({ where: { id: itemId } });

      // 2) 지갑 잔액 확인. WELFARE_POINT 1개로 단일화 가정(ADR-011).
      const wallet = await tx.wallet.findUnique({
        where: { uq_wallet_user_currency: { userId, currency: "WELFARE_POINT" } },
      });
      if (!wallet) throw new BadRequestException("지갑이 없습니다.");
      const co = wallet.companyId; // 멀티테넌시: 원장·주문을 지갑(사용자) 회사로 태깅
      const newBalance = wallet.balance - item.priceP;
      if (newBalance < 0n) {
        throw new ConflictException(
          `잔액 부족 (현재 ${wallet.balance}P, 필요 ${item.priceP}P)`,
        );
      }

      // 3) 지갑 차감 + REDEEM ledger INSERT(amount=-price, 음수).
      await tx.wallet.update({
        where: { uq_wallet_user_currency: { userId, currency: "WELFARE_POINT" } },
        data: { balance: newBalance },
      });
      await tx.ledgerEntry.create({
        data: {
          userId,
          currency: "WELFARE_POINT",
          actionType: "REDEEM",
          amount: -item.priceP,
          balanceAfter: newBalance,
          refNote: `스토어 교환: ${item.name}`,
          companyId: co,
        },
      });

      // 4) 주문 INSERT (PENDING).
      const order = await tx.redemptionOrder.create({
        data: {
          userId,
          itemId: item.id,
          pricePAtRedeem: item.priceP,
          status: "PENDING",
          companyId: co,
        },
      });

      // 5) 발송 (내부 채널은 즉시 ref 발급).
      const delivery = await this.channel.deliver({
        orderId: order.id,
        userId,
        itemSku: item.sku,
        itemName: item.name,
        priceP: item.priceP,
      });

      // 6) 주문 상태 갱신.
      await tx.redemptionOrder.update({
        where: { id: order.id },
        data: { status: delivery.status, deliveryRef: delivery.ref },
      });

      return {
        orderId: order.id,
        itemId: item.id,
        itemName: item.name,
        pricePAtRedeem: item.priceP.toString(),
        status: delivery.status,
        deliveryRef: delivery.ref,
        newBalance: newBalance.toString(),
      };
    });

    return result;
  }
}
