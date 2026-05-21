// /api/me/* — endpoints scoped to the authenticated user.
// Auth is NOT yet implemented (scope-cuts.md CUT-8); we accept userId in the
// path for now. Switch to a Guard-injected request user once auth lands.

import { BadRequestException, Controller, Get, Param } from "@nestjs/common";
import { ListMyActivityUseCase } from "@/application/user/list-my-activity.use-case";
import { GetWalletBalanceUseCase } from "@/application/wallet/get-wallet-balance.use-case";
import { GetUserLeaveUseCase } from "@/application/user/get-user-leave.use-case";
import { DomainError } from "@/domain/shared/errors";

@Controller("api/users")
export class MeController {
  constructor(
    private readonly activityUC: ListMyActivityUseCase,
    private readonly balanceUC: GetWalletBalanceUseCase,
    private readonly leaveUC: GetUserLeaveUseCase,
  ) {}

  @Get(":userId/activity")
  async activity(@Param("userId") userId: string) {
    try {
      return await this.activityUC.execute(userId);
    } catch (e) {
      if (e instanceof DomainError) throw new BadRequestException(e.message);
      throw e;
    }
  }

  @Get(":userId/balance")
  async balance(@Param("userId") userId: string) {
    try {
      return await this.balanceUC.execute(userId);
    } catch (e) {
      if (e instanceof DomainError) throw new BadRequestException(e.message);
      throw e;
    }
  }

  @Get(":userId/leave")
  async leave(@Param("userId") userId: string) {
    try {
      return await this.leaveUC.execute(userId);
    } catch (e) {
      if (e instanceof DomainError) throw new BadRequestException(e.message);
      throw e;
    }
  }
}
