// PrismaWalletRepository — maps between the Wallet aggregate and the wallet row.
// The domain stays oblivious to Prisma; mapping happens here at the boundary.

import { Injectable } from "@nestjs/common";
import type { Prisma, Currency as PrismaCurrency } from "@prisma/client";
import { PrismaService } from "./prisma.service";
import type { WalletRepository } from "@/ports/wallet-repository";
import { Wallet } from "@/domain/wallet/wallet";
import { UserId } from "@/domain/shared/value-objects/user-id";
import { Currency } from "@/domain/shared/value-objects/currency";
import { Point } from "@/domain/shared/value-objects/point";

@Injectable()
export class PrismaWalletRepository implements WalletRepository {
  constructor(private readonly prisma: PrismaService) {}

  async find(userId: UserId, currency: Currency): Promise<Wallet | null> {
    const row = await this.prisma.wallet.findUnique({
      where: {
        uq_wallet_user_currency: {
          userId: userId.toBigInt(),
          currency: currency.code as PrismaCurrency,
        },
      },
    });
    if (!row) return null;
    return Wallet.rehydrate(userId, currency, Point.of(row.balance));
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
    await tx.wallet.upsert({
      where: {
        uq_wallet_user_currency: {
          userId: wallet.userId.toBigInt(),
          currency: wallet.currency.code as PrismaCurrency,
        },
      },
      update: { balance: wallet.balance.toBigInt() },
      create: {
        userId: wallet.userId.toBigInt(),
        currency: wallet.currency.code as PrismaCurrency,
        balance: wallet.balance.toBigInt(),
      },
    });
  }
}
