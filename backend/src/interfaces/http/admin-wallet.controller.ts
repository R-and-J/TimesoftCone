// Admin wallet endpoints — RBAC is NOT implemented in this PR
// (auth/session is out of scope for the wallet/ledger foundation).
// A later PR will protect this route with an ADMIN role guard.

import {
  BadRequestException,
  Body,
  Controller,
  Post,
  UsePipes,
} from "@nestjs/common";
import { z } from "zod";
import { CreditWalletAdminUseCase } from "@/application/wallet/credit-wallet-admin.use-case";
import { DomainError } from "@/domain/shared/errors";
import { ZodValidationPipe } from "./zod.pipe";

const creditBodySchema = z.object({
  // Accept stringified bigint or numeric; the use case re-parses via UserId.of.
  userId: z.union([z.string(), z.number()]),
  amount: z.union([z.string(), z.number()]).refine(
    (v) => {
      try {
        return BigInt(v) > 0n;
      } catch {
        return false;
      }
    },
    { message: "amount must be a positive integer" },
  ),
  reason: z.string().min(1, "reason is required (audit trail)"),
});

type CreditBody = z.infer<typeof creditBodySchema>;

@Controller("api/admin/wallet")
export class AdminWalletController {
  constructor(private readonly creditAdmin: CreditWalletAdminUseCase) {}

  @Post("credit")
  @UsePipes(new ZodValidationPipe(creditBodySchema))
  async credit(@Body() body: CreditBody) {
    try {
      return await this.creditAdmin.execute(body);
    } catch (e) {
      if (e instanceof DomainError) {
        throw new BadRequestException(e.message);
      }
      throw e;
    }
  }
}
