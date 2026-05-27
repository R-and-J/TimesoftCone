// RBAC 역할 가드 — @Roles(...)가 붙은 라우트에서만 동작한다.
// 메타데이터가 없으면 통과(인증은 JwtAuthGuard가 이미 보장). 있으면 req.user.role 검사.

import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import { ROLES_KEY, type AuthUser, type Role } from "./auth.decorators";

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(ctx: ExecutionContext): boolean {
    const roles = this.reflector.getAllAndOverride<Role[] | undefined>(ROLES_KEY, [
      ctx.getHandler(),
      ctx.getClass(),
    ]);
    if (!roles || roles.length === 0) return true;

    const req = ctx.switchToHttp().getRequest<{ user?: AuthUser }>();
    if (!req.user || !roles.includes(req.user.role)) {
      throw new ForbiddenException("이 작업에는 권한이 없습니다");
    }
    return true;
  }
}
