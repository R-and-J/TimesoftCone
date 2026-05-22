// LoginUseCase — 중앙 인증 위임(ADR-019).
//
// 흐름:
//   1. AuthProvider(ezpass)에 자격증명 검증 위임 (비번은 우리가 저장 안 함)
//   2. 성공 시 외부 신원의 email로 우리 users 조회
//   3. 없으면 자동 프로비저닝(EMPLOYEE)
//   4. 우리 사용자 정보 반환 (프론트는 userId를 저장 — 기존 흐름 유지)
//
// 우리 자체 JWT/가드는 아직 없음(scope-cuts CUT-8) — 후속 과제.

import { Inject, Injectable, UnauthorizedException } from "@nestjs/common";
import { PrismaService } from "@/adapters/persistence/prisma.service";
import {
  AUTH_PROVIDER,
  AuthFailedError,
  type AuthProvider,
} from "@/ports/auth-provider";

export type LoginResult = {
  userId: bigint;
  empId: string;
  name: string;
  role: "EMPLOYEE" | "ADMIN";
  team: string | null;
  email: string | null;
  /** 이 로그인으로 우리 users 행이 새로 생성됐는지. */
  provisioned: boolean;
};

@Injectable()
export class LoginUseCase {
  constructor(
    @Inject(AUTH_PROVIDER) private readonly auth: AuthProvider,
    private readonly prisma: PrismaService,
  ) {}

  async execute(id: string, password: string, cmpnyNo?: string): Promise<LoginResult> {
    // 1. 외부 인증 위임
    let identity;
    try {
      identity = await this.auth.authenticate(id, password, cmpnyNo);
    } catch (e) {
      if (e instanceof AuthFailedError) throw new UnauthorizedException(e.message);
      throw e;
    }

    // 2. email로 우리 사용자 매핑
    let user = await this.prisma.user.findUnique({ where: { email: identity.email } });
    let provisioned = false;

    // 3. 없으면 자동 프로비저닝
    if (!user) {
      const empId = `EZP-${identity.externalUserNo ?? Date.now()}`;
      user = await this.prisma.user.create({
        data: {
          empId,
          email: identity.email,
          name: identity.name ?? identity.email.split("@")[0],
          role: identity.isAdmin ? "ADMIN" : "EMPLOYEE",
        },
      });
      provisioned = true;
    }

    // 4. 우리 사용자 정보 반환
    return {
      userId: user.id,
      empId: user.empId,
      name: user.name,
      role: user.role,
      team: user.team,
      email: user.email,
      provisioned,
    };
  }
}
