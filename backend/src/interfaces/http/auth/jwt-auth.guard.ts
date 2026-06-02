// 전역 인증 가드 — 모든 요청에 토큰을 요구하되, @Public()이 붙은 라우트는 통과.
// Bearer 토큰을 우리 자체 JWT(JwtService)로 검증하고, 검증된 주체를 req.user에 심는다.
// (위변조 불가: ezpass가 아니라 우리가 서명한 토큰을 우리 비밀키로 검증.)

import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import { JwtService } from "@nestjs/jwt";
import { IS_PUBLIC_KEY, type AuthUser } from "./auth.decorators";

type JwtPayload = { sub: string; role: AuthUser["role"]; empId: string; companyId?: string | null };

@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly jwt: JwtService,
  ) {}

  canActivate(ctx: ExecutionContext): boolean {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      ctx.getHandler(),
      ctx.getClass(),
    ]);
    if (isPublic) return true;

    const req = ctx.switchToHttp().getRequest<{
      headers: Record<string, string | undefined>;
      user?: AuthUser;
    }>();
    const auth = req.headers["authorization"];
    if (!auth || !auth.startsWith("Bearer ")) {
      throw new UnauthorizedException("인증 토큰이 필요합니다");
    }

    try {
      const payload = this.jwt.verify<JwtPayload>(auth.slice(7));
      req.user = {
        userId: BigInt(payload.sub),
        role: payload.role,
        empId: payload.empId,
        companyId: payload.companyId != null ? BigInt(payload.companyId) : null,
      };
      return true;
    } catch {
      throw new UnauthorizedException("토큰이 만료되었거나 유효하지 않습니다");
    }
  }
}
