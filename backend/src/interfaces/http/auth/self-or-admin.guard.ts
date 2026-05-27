// ABAC 소유자 가드 — @SelfParam('userId')가 붙은 라우트에서만 동작한다.
// 경로 파라미터의 사용자 == 토큰 주체이거나, 호출자가 ADMIN이어야 통과.
// (permission-matrix "✅ (self)" / 타인 리소스는 ADMIN만.)

import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import { SELF_PARAM_KEY, type AuthUser } from "./auth.decorators";

@Injectable()
export class SelfOrAdminGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(ctx: ExecutionContext): boolean {
    const paramName = this.reflector.getAllAndOverride<string | undefined>(
      SELF_PARAM_KEY,
      [ctx.getHandler(), ctx.getClass()],
    );
    if (!paramName) return true;

    const req = ctx.switchToHttp().getRequest<{
      user?: AuthUser;
      params: Record<string, string>;
    }>();
    if (!req.user) throw new ForbiddenException("인증이 필요합니다");
    if (req.user.role === "ADMIN") return true;

    // 토큰 주체와 경로의 대상이 같을 때만 허용. 숫자 아닌 파라미터는 403으로 떨어뜨림(500 방지).
    try {
      const target = req.params[paramName];
      if (target != null && BigInt(target) === req.user.userId) return true;
    } catch {
      /* fall through to 403 */
    }
    throw new ForbiddenException("본인 리소스만 접근할 수 있습니다");
  }
}
