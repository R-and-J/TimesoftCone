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
import type { PayoutChannel, DividendPayout } from "@/ports/payout-channel";
import { UserId } from "@/domain/shared/value-objects/user-id";
import { Cone } from "@/domain/shared/value-objects/cone";
import { Currency } from "@/domain/shared/value-objects/currency";
import { Wallet } from "@/domain/wallet/wallet";
import { LedgerEntry } from "@/domain/ledger/ledger-entry";
import {
  isCreditAction,
  isDebitAction,
} from "@/domain/ledger/ledger-action-type";
import type { TransactionRef } from "@/domain/ledger/transaction-ref";

// 통화 추상화(ADR-010, invariant #8): 입찰 결제(BiddingCurrency)와 배당 지급
// (PayoutChannel)을 같은 한 구현체가 제공한다(현재 단일 구현 WELFARE_POINT).
@Injectable()
export class WelfarePointProvider implements BiddingCurrency, PayoutChannel {
  readonly currencyCode = "WELFARE_POINT";
  readonly channelCode = "WELFARE_POINT";
  private readonly currency = Currency.WELFARE_POINT;

  constructor(
    private readonly prisma: PrismaService,
    @Inject(PrismaWalletRepository)
    private readonly wallets: PrismaWalletRepository,
    @Inject(PrismaLedgerRepository)
    private readonly ledger: PrismaLedgerRepository,
  ) {}

  async getBalance(userId: UserId): Promise<Cone> {
    const wallet = await this.wallets.find(userId, this.currency);
    return wallet?.balance ?? Cone.ZERO;
  }

  async debit(
    userId: UserId,
    amount: Cone,
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
    amount: Cone,
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

  // ── PayoutChannel (ADR-008 연말 배당) ─────────────────────────────
  // 전체 배당을 단일 트랜잭션에서 지급한다: 각 수혜자 지갑 credit + DIVIDEND 원장
  // INSERT. NFR-2 등식상 부분 지급이 남으면 안 되므로 all-or-nothing.
  async payout(payouts: DividendPayout[]): Promise<void> {
    if (payouts.length === 0) return;
    await this.prisma.$transaction(async (tx) => {
      for (const p of payouts) {
        const wallet =
          (await this.wallets.find(p.userId, this.currency)) ??
          Wallet.openEmpty(p.userId, this.currency);
        wallet.credit(p.amount);
        await this.wallets.saveWith(tx, wallet);

        await this.ledger.appendWith(
          tx,
          LedgerEntry.create({
            userId: p.userId,
            currency: this.currency,
            actionType: "DIVIDEND",
            amount: p.amount.toBigInt(),
            balanceAfter: wallet.balance,
            refNote: p.refNote,
          }),
        );
      }
    });
  }
}
