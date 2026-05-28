import { BadRequestException, Controller, Get, Param, Query } from "@nestjs/common";
import { GetMyDividendUseCase } from "@/application/dividend/get-my-dividend.use-case";
import { DomainError } from "@/domain/shared/errors";
import { SelfParam } from "./auth/auth.decorators";

@SelfParam("userId")
@Controller("api/dividend")
export class DividendController {
  constructor(private readonly getMyDividend: GetMyDividendUseCase) {}

  @Get("me/:userId")
  async myDividend(
    @Param("userId") userId: string,
    @Query("year") year?: string,
  ) {
    try {
      // ?year= 미지정 시 현재 연도(=배당 대상 연도)로 자동 — stake는 연도별이다(ADR-017).
      const y = year ? Number(year) : undefined;
      return await this.getMyDividend.execute(userId, y);
    } catch (e) {
      if (e instanceof DomainError) throw new BadRequestException(e.message);
      throw e;
    }
  }
}
