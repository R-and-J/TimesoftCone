// Admin wallet endpoints — ADMIN 전용 (permission-matrix WA-5, CREDIT_ADMIN).

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
import { Roles } from "./auth/auth.decorators";

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

@Roles("ADMIN")
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
