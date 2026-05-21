import { BadRequestException, Controller, Get, Param } from "@nestjs/common";
import { GetMyDividendUseCase } from "@/application/dividend/get-my-dividend.use-case";
import { DomainError } from "@/domain/shared/errors";

@Controller("api/dividend")
export class DividendController {
  constructor(private readonly getMyDividend: GetMyDividendUseCase) {}

  @Get("me/:userId")
  async myDividend(@Param("userId") userId: string) {
    try {
      return await this.getMyDividend.execute(userId);
    } catch (e) {
      if (e instanceof DomainError) throw new BadRequestException(e.message);
      throw e;
    }
  }
}
