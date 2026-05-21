// CreditWalletAdmin — ADR-011 §"신규 API" admin credit endpoint.
// Appends a CREDIT_ADMIN ledger entry; reason is REQUIRED for audit
// (also enforced at the DB check constraint and the LedgerEntry factory).

import { Inject, Injectable } from "@nestjs/common";
import { BIDDING_CURRENCY, type BiddingCurrency } from "@/ports/bidding-currency";
import { UserId } from "@/domain/shared/value-objects/user-id";
import { Point } from "@/domain/shared/value-objects/point";

export type CreditWalletAdminInput = {
  userId: bigint | number | string;
  amount: bigint | number | string;
  reason: string;
};

export type CreditWalletAdminResult = {
  userId: bigint;
  newBalance: bigint;
};

@Injectable()
export class CreditWalletAdminUseCase {
  constructor(
    @Inject(BIDDING_CURRENCY)
    private readonly bidding: BiddingCurrency,
  ) {}

  async execute(input: CreditWalletAdminInput): Promise<CreditWalletAdminResult> {
    if (!input.reason || input.reason.trim().length === 0) {
      throw new Error("CREDIT_ADMIN requires a non-empty reason");
    }
    const userId = UserId.of(input.userId);
    const amount = Point.of(input.amount);

    await this.bidding.credit(userId, amount, {
      actionType: "CREDIT_ADMIN",
      reason: input.reason.trim(),
    });

    const after = await this.bidding.getBalance(userId);
    return { userId: userId.toBigInt(), newBalance: after.toBigInt() };
  }
}
