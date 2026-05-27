// CompositeAuthProvider — 위임형(ezpass) 배포의 기본 AuthProvider (ADR-019/022).
//
// "로컬 우선" 합성: 우리가 직접 관리하는 계정(users.password_hash 보유)은 로컬 bcrypt로
// 검증하고, 그 외 계정은 ezpass에 위임한다. 덕분에 단일 ezpass 데모를 유지하면서도,
// 외부 IdP에 의존하지 않는 전용 관리자(admin@) 계정을 우리 쪽에서 운용할 수 있다.
// (ezpass admin 계정이 외부 사유로 인증 불가가 된 사고가 계기 — ADR-020 개정.)
//
// 주의: 로컬 비번이 있는 계정은 로컬 검증이 *정본* — 비번 불일치 시 ezpass로 폴백하지
// 않는다(폴백하면 로컬 비번 우회가 됨).

import { Injectable } from "@nestjs/common";
import { PrismaService } from "@/adapters/persistence/prisma.service";
import { LocalAuthProvider } from "./local-auth.provider";
import { EzpassAuthProvider } from "./ezpass-auth.provider";
import type { AuthProvider, ExternalIdentity } from "@/ports/auth-provider";

@Injectable()
export class CompositeAuthProvider implements AuthProvider {
  constructor(
    private readonly prisma: PrismaService,
    private readonly local: LocalAuthProvider,
    private readonly ezpass: EzpassAuthProvider,
  ) {}

  async authenticate(id: string, password: string, cmpnyNo?: string): Promise<ExternalIdentity> {
    const u = await this.prisma.user.findUnique({
      where: { email: id },
      select: { passwordHash: true },
    });
    // 로컬 비번을 가진 계정 → 우리가 검증(정본). 그 외 → ezpass 위임.
    // (LocalAuthProvider는 cmpnyNo를 쓰지 않음 — 외부 회사 식별 불필요.)
    if (u?.passwordHash) return this.local.authenticate(id, password);
    return this.ezpass.authenticate(id, password, cmpnyNo);
  }
}
