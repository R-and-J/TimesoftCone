// RBAC 데코레이터 (permission-matrix.md 매핑 지점).
//   @Public()        — 인증 불필요 (로그인 등). JwtAuthGuard가 통과시킴.
//   @Roles('ADMIN')  — 해당 역할만. RolesGuard가 검사.
//   @SelfParam('userId') — 경로 파라미터의 사용자와 토큰 주체가 같아야 함(또는 ADMIN).
//   @CurrentUser()   — 검증된 요청 주체({ userId, role })를 핸들러 인자로 주입.

import {
  SetMetadata,
  createParamDecorator,
  type ExecutionContext,
} from "@nestjs/common";

export const IS_PUBLIC_KEY = "rbac:isPublic";
export const ROLES_KEY = "rbac:roles";
export const SELF_PARAM_KEY = "rbac:selfParam";

export type Role = "EMPLOYEE" | "ADMIN";

/** 검증된 JWT에서 뽑은 요청 주체. 가드가 req.user에 심는다. */
export type AuthUser = {
  userId: bigint;
  role: Role;
  empId: string;
};

export const Public = () => SetMetadata(IS_PUBLIC_KEY, true);

export const Roles = (...roles: Role[]) => SetMetadata(ROLES_KEY, roles);

/** 경로 파라미터 이름을 지정 — 그 값이 토큰 주체와 같거나 호출자가 ADMIN이어야 함. */
export const SelfParam = (paramName: string) =>
  SetMetadata(SELF_PARAM_KEY, paramName);

export const CurrentUser = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): AuthUser => {
    const req = ctx.switchToHttp().getRequest<{ user: AuthUser }>();
    return req.user;
  },
);
