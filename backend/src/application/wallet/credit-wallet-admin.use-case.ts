// CreditWalletAdmin — ADR-011 §"신규 API" 관리자 잔액 조정 endpoint.
// 양수=충전, 음수=차감. 둘 다 CREDIT_ADMIN ledger entry로 적재(reason 필수 —
// DB CHECK + LedgerEntry 팩토리에서도 강제). 차감 시 잔액이 음수가 되면 거부.
// Cone VO가 음수를 받지 못해 BiddingCurrency 포트를 우회하고 prisma를 직접 다룬다
// (ChargeRequest Approve/Reject와 동일 패턴).

import { BadRequestException, ConflictException, Injectable } from "@nestjs/common";
import { PrismaService } from "@/adapters/persistence/prisma.service";

export type CreditWalletAdminInput = {
  userId: bigint | number | string;
  amount: bigint | number | string;
  reason: string;
};

export type CreditWalletAdminResult = {
  userId: bigint;
  newBalance: bigint;
  delta: bigint;
};

@Injectable()
export class CreditWalletAdminUseCase {
  constructor(private readonly prisma: PrismaService) {}

  async execute(input: CreditWalletAdminInput): Promise<CreditWalletAdminResult> {
    if (!input.reason || input.reason.trim().length === 0) {
      throw new BadRequestException("CREDIT_ADMIN requires a non-empty reason");
    }
    const userId = BigInt(input.userId);
    const amount = BigInt(input.amount);
    if (amount === 0n) throw new BadRequestException("amount는 0이 될 수 없습니다");

    const newBalance = await this.prisma.$transaction(async (tx) => {
      const wallet = await tx.wallet.findUnique({
        where: { uq_wallet_user_currency: { userId, currency: "WELFARE_POINT" } },
      });
      const before = wallet?.balance ?? 0n;
      const after = before + amount;
      if (after < 0n) {
        throw new ConflictException(
          `잔액 부족 — 현재 ${before}콘, 차감 요청 ${amount}P`,
        );
      }
      // 멀티테넌시: 지갑/원장을 대상 사용자 회사로 태깅(지갑 있으면 그 값, 없으면 user 조회).
      const co =
        wallet?.companyId ??
        (await tx.user.findUnique({ where: { id: userId }, select: { companyId: true } }))?.companyId ??
        1n;
      if (wallet) {
        await tx.wallet.update({
          where: { uq_wallet_user_currency: { userId, currency: "WELFARE_POINT" } },
          data: { balance: after },
        });
      } else {
        await tx.wallet.create({
          data: { userId, currency: "WELFARE_POINT", balance: after, companyId: co },
        });
      }
      await tx.ledgerEntry.create({
        data: {
          userId,
          currency: "WELFARE_POINT",
          actionType: "CREDIT_ADMIN",
          amount,
          balanceAfter: after,
          refNote: input.reason.trim(),
          companyId: co,
        },
      });
      return after;
    });

    return { userId, newBalance, delta: amount };
  }
}
