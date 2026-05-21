// Wallet HTTP endpoints. Wraps GetWalletBalance use case.
// Routes:
//   GET /api/wallet/:userId        — current balance for the default currency

import {
  BadRequestException,
  Controller,
  Get,
  Param,
} from "@nestjs/common";
import { GetWalletBalanceUseCase } from "@/application/wallet/get-wallet-balance.use-case";
import { DomainError } from "@/domain/shared/errors";

@Controller("api/wallet")
export class WalletController {
  constructor(private readonly getBalance: GetWalletBalanceUseCase) {}

  @Get(":userId")
  async balance(@Param("userId") userId: string) {
    try {
      return await this.getBalance.execute(userId);
    } catch (e) {
      if (e instanceof DomainError) {
        throw new BadRequestException(e.message);
      }
      throw e;
    }
  }
}
