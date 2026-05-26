// LocalAuthProvider — 자립형(AUTH_MODE=local) 배포의 AuthProvider 구현 (ADR-022).
//
// 그룹웨어/SSO가 없는 회사용. 외부에 위임하지 않고 우리 users 테이블의
// bcrypt 비밀번호 해시로 직접 검증한다. 위임형(ezpass)의 EzpassAuthProvider와
// 같은 AuthProvider 포트를 구현 — app.module이 AUTH_MODE로 둘 중 하나를 바인딩.
//
// 위임형과 달리 자동 프로비저닝을 하지 않는다: 없는 계정/비활성/해시없음은 곧 실패.
// 계정 생성은 관리자 회원관리 CRUD(ManageMembersUseCase)로만.

import { Injectable } from "@nestjs/common";
import * as bcrypt from "bcryptjs";
import { PrismaService } from "@/adapters/persistence/prisma.service";
import {
  AuthFailedError,
  type AuthProvider,
  type ExternalIdentity,
} from "@/ports/auth-provider";

@Injectable()
export class LocalAuthProvider implements AuthProvider {
  constructor(private readonly prisma: PrismaService) {}

  async authenticate(id: string, password: string): Promise<ExternalIdentity> {
    const user = await this.prisma.user.findUnique({ where: { email: id } });
    if (!user || !user.active || !user.passwordHash) {
      throw new AuthFailedError("아이디 또는 비밀번호가 올바르지 않습니다");
    }
    const ok = await bcrypt.compare(password, user.passwordHash);
    if (!ok) {
      throw new AuthFailedError("아이디 또는 비밀번호가 올바르지 않습니다");
    }
    return {
      email: user.email!,
      name: user.name,
      isAdmin: user.role === "ADMIN",
      externalUserNo: user.empId,
    };
  }
}
