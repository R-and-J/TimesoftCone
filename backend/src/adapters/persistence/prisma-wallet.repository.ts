// PrismaWalletRepository — maps between the Wallet aggregate and the wallet row.
// The domain stays oblivious to Prisma; mapping happens here at the boundary.

import { Injectable } from "@nestjs/common";
import type { Prisma } from "@prisma/client";
import { PrismaService } from "./prisma.service";
import type { WalletRepository } from "@/ports/wallet-repository";
import { Wallet } from "@/domain/wallet/wallet";
import { UserId } from "@/domain/shared/value-objects/user-id";
import { Currency } from "@/domain/shared/value-objects/currency";
import { Cone } from "@/domain/shared/value-objects/cone";

@Injectable()
export class PrismaWalletRepository implements WalletRepository {
  constructor(private readonly prisma: PrismaService) {}

  async find(userId: UserId, currency: Currency): Promise<Wallet | null> {
    const row = await this.prisma.wallet.findUnique({
      where: {
        uq_wallet_user_currency: {
          userId: userId.toBigInt(),
          currency: currency.code,
        },
      },
    });
    if (!row) return null;
    return Wallet.rehydrate(userId, currency, Cone.of(row.balance));
  }

  async save(wallet: Wallet): Promise<void> {
    await this.saveWith(this.prisma, wallet);
  }

  /**
   * Internal helper used by transactional adapters (e.g. WelfarePointProvider)
   * so they can write wallet + ledger in one Prisma transaction.
   */
  async saveWith(
    tx: PrismaService | Prisma.TransactionClient,
    wallet: Wallet,
  ): Promise<void> {
    const userId = wallet.userId.toBigInt();
    // 멀티테넌시: 지갑 신규 생성 시 사용자 회사로 태깅(@default 1 대신).
    const u = await tx.user.findUnique({ where: { id: userId }, select: { companyId: true } });
    await tx.wallet.upsert({
      where: {
        uq_wallet_user_currency: {
          userId,
          currency: wallet.currency.code,
        },
      },
      update: { balance: wallet.balance.toBigInt() },
      create: {
        userId,
        currency: wallet.currency.code,
        balance: wallet.balance.toBigInt(),
        companyId: u?.companyId ?? 1n,
      },
    });
  }
}
