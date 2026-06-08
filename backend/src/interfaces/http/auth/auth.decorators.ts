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

// ADMIN: 최고관리자(둘 다 관리). EZPASS_ADMIN/EXAM_ADMIN: 영역별 관리자.
// EZPASS/EXAM: 일반 사용자. RBAC는 관리자 계열(ADMIN_ROLES)과 일반을 구분한다.
export type Role = "ADMIN" | "EZPASS_ADMIN" | "EXAM_ADMIN" | "EZPASS" | "EXAM";

/** 관리자 계열 role(모든 /admin 영역 접근 가능). 세부 스코프는 메서드 단위 @Roles로 좁힌다. */
export const ADMIN_ROLES: Role[] = ["ADMIN", "EZPASS_ADMIN", "EXAM_ADMIN"];

/** 검증된 JWT에서 뽑은 요청 주체. 가드가 req.user에 심는다. */
export type AuthUser = {
  userId: bigint;
  role: Role;
  empId: string;
  /** 소속 회사 id(멀티테넌시). super ADMIN은 null(전 회사). */
  companyId: bigint | null;
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

/** 멀티테넌시 유효 회사 스코프(핸들러 인자 주입).
 *   - 일반 role: 자기 회사(user.companyId)로 고정.
 *   - super ADMIN: 요청 헤더 X-Company-Id(스위처 선택) → 그 회사, 없으면 null(전 회사).
 * use-case에 그대로 넘기면 됨(null=전 회사 미필터). */
export const CompanyScope = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): bigint | null => {
    const req = ctx
      .switchToHttp()
      .getRequest<{ user: AuthUser; headers: Record<string, string | undefined> }>();
    const u = req.user;
    if (u.role === "ADMIN") {
      const h = req.headers["x-company-id"];
      if (h && /^\d+$/.test(h)) return BigInt(h);
      return null; // 전 회사 통합
    }
    return u.companyId;
  },
);
