import { Body, Controller, HttpCode, Post, UsePipes } from "@nestjs/common";
import { z } from "zod";
import { LoginUseCase } from "@/application/auth/login.use-case";
import { ZodValidationPipe } from "./zod.pipe";

// 중앙 인증 위임(ADR-019): 이메일(id) + 비밀번호를 받아 사내 ezpass로 검증 위임.
const loginSchema = z.object({
  id: z.string().min(1, "id(email) is required"),
  password: z.string().min(1, "password is required"),
  cmpnyNo: z.string().optional(),
});

@Controller("api/auth")
export class AuthController {
  constructor(private readonly login: LoginUseCase) {}

  @Post("login")
  @HttpCode(200)
  @UsePipes(new ZodValidationPipe(loginSchema))
  async loginByCredentials(@Body() body: z.infer<typeof loginSchema>) {
    return this.login.execute(body.id, body.password, body.cmpnyNo);
  }
}
