import { Body, Controller, Post, UsePipes } from "@nestjs/common";
import { z } from "zod";
import { LoginByEmpIdUseCase } from "@/application/auth/login-by-emp-id.use-case";
import { ZodValidationPipe } from "./zod.pipe";

const loginSchema = z.object({
  empId: z.string().min(1, "empId is required"),
});

@Controller("api/auth")
export class AuthController {
  constructor(private readonly login: LoginByEmpIdUseCase) {}

  @Post("login")
  @UsePipes(new ZodValidationPipe(loginSchema))
  async loginByEmpId(@Body() body: z.infer<typeof loginSchema>) {
    return this.login.execute(body.empId);
  }
}
