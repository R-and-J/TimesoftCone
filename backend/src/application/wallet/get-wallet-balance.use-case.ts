// GetWalletBalance — read the current point balance for a user.
// Depends on the BiddingCurrency port (not on Prisma) so domain test mocks
// can substitute an in-memory implementation.

import { Inject, Injectable } from "@nestjs/common";
import { BIDDING_CURRENCY, type BiddingCurrency } from "@/ports/bidding-currency";
import { UserId } from "@/domain/shared/value-objects/user-id";
import { Point } from "@/domain/shared/value-objects/point";

export type GetWalletBalanceResult = {
  userId: bigint;
  currency: string;
  balance: bigint;
};

@Injectable()
export class GetWalletBalanceUseCase {
  constructor(
    @Inject(BIDDING_CURRENCY)
    private readonly bidding: BiddingCurrency,
  ) {}

  async execute(userIdRaw: bigint | number | string): Promise<GetWalletBalanceResult> {
    const userId = UserId.of(userIdRaw);
    const balance: Point = await this.bidding.getBalance(userId);
    return {
      userId: userId.toBigInt(),
      currency: this.bidding.currencyCode,
      balance: balance.toBigInt(),
    };
  }
}
