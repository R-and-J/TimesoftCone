// ADR-010 BiddingCurrency implementation for WELFARE_POINT.
// Wraps wallet debit/credit AND ledger append in a single Prisma transaction
// so the auction-settlement invariant from ADR-018 holds at this layer too:
// either both writes commit or neither does.
//
// This is the *only* adapter the bid path needs to touch for points;
// the domain never sees Prisma.

import { Inject, Injectable } from "@nestjs/common";
import { PrismaService } from "../persistence/prisma.service";
import { PrismaWalletRepository } from "../persistence/prisma-wallet.repository";
import { PrismaLedgerRepository } from "../persistence/prisma-ledger.repository";
import type { BiddingCurrency } from "@/ports/bidding-currency";
import { UserId } from "@/domain/shared/value-objects/user-id";
import { Point } from "@/domain/shared/value-objects/point";
import { Currency } from "@/domain/shared/value-objects/currency";
import { Wallet } from "@/domain/wallet/wallet";
import { LedgerEntry } from "@/domain/ledger/ledger-entry";
import {
  isCreditAction,
  isDebitAction,
} from "@/domain/ledger/ledger-action-type";
import type { TransactionRef } from "@/domain/ledger/transaction-ref";

@Injectable()
export class WelfarePointProvider implements BiddingCurrency {
  readonly currencyCode = "WELFARE_POINT";
  private readonly currency = Currency.WELFARE_POINT;

  constructor(
    private readonly prisma: PrismaService,
    @Inject(PrismaWalletRepository)
    private readonly wallets: PrismaWalletRepository,
    @Inject(PrismaLedgerRepository)
    private readonly ledger: PrismaLedgerRepository,
  ) {}

  async getBalance(userId: UserId): Promise<Point> {
    const wallet = await this.wallets.find(userId, this.currency);
    return wallet?.balance ?? Point.ZERO;
  }

  async debit(
    userId: UserId,
    amount: Point,
    ref: TransactionRef,
  ): Promise<void> {
    if (!isDebitAction(ref.actionType)) {
      throw new Error(
        `debit() called with non-debit action type: ${ref.actionType}`,
      );
    }
    await this.prisma.$transaction(async (tx) => {
      const wallet =
        (await this.wallets.find(userId, this.currency)) ??
        Wallet.openEmpty(userId, this.currency);

      wallet.debit(amount);
      await this.wallets.saveWith(tx, wallet);

      await this.ledger.appendWith(
        tx,
        LedgerEntry.create({
          userId,
          currency: this.currency,
          actionType: ref.actionType,
          amount: -amount.toBigInt(),
          balanceAfter: wallet.balance,
          auctionId: ref.auctionId,
          refNote: ref.reason,
        }),
      );
    });
  }

  async credit(
    userId: UserId,
    amount: Point,
    ref: TransactionRef,
  ): Promise<void> {
    if (!isCreditAction(ref.actionType)) {
      throw new Error(
        `credit() called with non-credit action type: ${ref.actionType}`,
      );
    }
    await this.prisma.$transaction(async (tx) => {
      const wallet =
        (await this.wallets.find(userId, this.currency)) ??
        Wallet.openEmpty(userId, this.currency);

      wallet.credit(amount);
      await this.wallets.saveWith(tx, wallet);

      await this.ledger.appendWith(
        tx,
        LedgerEntry.create({
          userId,
          currency: this.currency,
          actionType: ref.actionType,
          amount: amount.toBigInt(),
          balanceAfter: wallet.balance,
          auctionId: ref.auctionId,
          refNote: ref.reason,
        }),
      );
    });
  }
}
