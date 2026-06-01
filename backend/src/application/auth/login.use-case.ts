// LoginUseCase — 중앙 인증 위임(ADR-019).
//
// 흐름:
//   1. AuthProvider(ezpass)에 자격증명 검증 위임 (비번은 우리가 저장 안 함)
//   2. 성공 시 외부 신원의 email로 우리 users 조회
//   3. 없으면 자동 프로비저닝(role은 이메일 도메인으로 EZPASS/EXAM 분기, 관리자 힌트면 ADMIN)
//   4. 우리 사용자 정보 반환 (프론트는 userId를 저장 — 기존 흐름 유지)
//
// 우리 자체 JWT/가드는 아직 없음(scope-cuts CUT-8) — 후속 과제.

import { Inject, Injectable, UnauthorizedException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
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
  role: "ADMIN" | "EZPASS_ADMIN" | "EXAM_ADMIN" | "EZPASS" | "EXAM";
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
    private readonly config: ConfigService,
  ) {}

  /**
   * 로그인 시 role을 이메일 도메인으로 분기한다.
   *   - 기존이 ADMIN이면 ADMIN 고정(전용 관리자는 sticky — 도메인으로 강등하지 않음).
   *   - 신규 + ezpass 관리자 힌트면 ADMIN.
   *   - 그 외: 회사 도메인(EZPASS_EMAIL_DOMAIN) → EZPASS, 나머지 → EXAM.
   */
  private resolveRole(
    email: string,
    existingRole: string | undefined,
    isAdminHint: boolean,
  ): "ADMIN" | "EZPASS_ADMIN" | "EXAM_ADMIN" | "EZPASS" | "EXAM" {
    // 관리자 계열은 고정(도메인으로 강등하지 않음).
    if (existingRole === "ADMIN") return "ADMIN";
    if (existingRole === "EZPASS_ADMIN") return "EZPASS_ADMIN";
    if (existingRole === "EXAM_ADMIN") return "EXAM_ADMIN";
    const domain = (email.split("@")[1] ?? "").toLowerCase();
    const ezpassDomain = (
      this.config.get<string>("EZPASS_EMAIL_DOMAIN") ?? "timesoftcone.com"
    ).toLowerCase();
    const isEzpass = domain === ezpassDomain;
    // 신규 관리자(ezpass mngrAuthorAt 등) → 도메인에 따라 영역 관리자.
    if (isAdminHint) return isEzpass ? "EZPASS_ADMIN" : "EXAM_ADMIN";
    return isEzpass ? "EZPASS" : "EXAM";
  }

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
    // role은 매 로그인 이메일 도메인으로 재계산(ADMIN은 고정). 회사 도메인=EZPASS, 그 외=EXAM.
    const role = this.resolveRole(identity.email, user?.role, identity.isAdmin);

    if (!user) {
      // 3. 없으면 자동 프로비저닝. 신원(이름/부서/직급)은 ezpass가 정본.
      const empId = `EZP-${identity.externalUserNo ?? Date.now()}`;
      user = await this.prisma.user.create({
        data: {
          empId,
          email: identity.email,
          name,
          role,
        },
      });
      provisioned = true;
    } else if (user.name !== name || user.role !== role) {
      // 3-b. 이름(신원)은 ezpass 기준, role은 도메인 기준으로 동기화.
      user = await this.prisma.user.update({
        where: { id: user.id },
        data: { name, role },
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
      role: user.role as "ADMIN" | "EZPASS_ADMIN" | "EXAM_ADMIN" | "EZPASS" | "EXAM",
      team: user.team,
      jobRank: user.jobRank,
      jobTitle: user.jobTitle,
      email: user.email,
      provisioned,
      token,
    };
  }
}
