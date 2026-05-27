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
import { JwtService } from "@nestjs/jwt";
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
  /** 직급 (ezpass clsf_nm) — 배치 동기화로 채워진 표시용 값. */
  jobRank: string | null;
  /** 직책 (ezpass ofcsprtps_nm). */
  jobTitle: string | null;
  email: string | null;
  /** 이 로그인으로 우리 users 행이 새로 생성됐는지. */
  provisioned: boolean;
  /** 자체 발급 JWT(RBAC) — 프론트가 Authorization: Bearer로 재전송. */
  token: string;
};

@Injectable()
export class LoginUseCase {
  constructor(
    @Inject(AUTH_PROVIDER) private readonly auth: AuthProvider,
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
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

    const name = identity.name ?? identity.email.split("@")[0];

    if (!user) {
      // 3. 없으면 자동 프로비저닝. role 초기값만 ezpass 관리자권한에서 힌트로 가져온다 —
      //    이후 role(EMP/ADM)은 우리 시스템이 소유하고 ezpass로 재동기화하지 않는다 (ADR-020 개정).
      //    권한(authorization)은 앱 고유 관심사라, 신원(이름/부서/직급)만 ezpass가 정본.
      const empId = `EZP-${identity.externalUserNo ?? Date.now()}`;
      user = await this.prisma.user.create({
        data: {
          empId,
          email: identity.email,
          name,
          role: identity.isAdmin ? "ADMIN" : "EMPLOYEE",
        },
      });
      provisioned = true;
    } else if (user.name !== name) {
      // 3-b. 이름(신원)만 ezpass 기준 동기화. role은 우리 DB가 소유 — 덮어쓰지 않음.
      user = await this.prisma.user.update({
        where: { id: user.id },
        data: { name },
      });
    }

    // 4. 우리 자체 JWT 서명 — 주체/역할을 담아 위변조 불가하게. 가드가 이 토큰을 검증.
    //    role을 토큰에 박으므로 매 요청 DB 조회 없이 RBAC 판정 가능(만료까지 유효).
    const token = this.jwt.sign({
      sub: String(user.id),
      role: user.role,
      empId: user.empId,
    });

    // 5. 우리 사용자 정보 + 토큰 반환 (직급/직책은 배치 동기화로 채워진 값)
    return {
      userId: user.id,
      empId: user.empId,
      name: user.name,
      role: user.role as "EMPLOYEE" | "ADMIN",
      team: user.team,
      jobRank: user.jobRank,
      jobTitle: user.jobTitle,
      email: user.email,
      provisioned,
      token,
    };
  }
}
