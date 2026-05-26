// ManageMembers — 자립형(AUTH_MODE=local) 배포의 회원 CRUD (ADR-022).
//
// 위임형(ezpass)에선 신원 정본이 ezpass라 로컬 CRUD가 이중 원본을 만든다 →
// local 모드가 아니면 거부(409). 자립형에선 우리 users가 정본이므로 추가/수정/
// 비번재설정/비활성을 여기서 한다.

import { ConflictException, Inject, Injectable, NotFoundException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import * as bcrypt from "bcryptjs";
import { PrismaService } from "@/adapters/persistence/prisma.service";

const BCRYPT_ROUNDS = 10;

export type CreateMemberInput = {
  email: string;
  name: string;
  password: string;
  role: "EMPLOYEE" | "ADMIN";
  empId?: string;
  team?: string | null;
  jobRank?: string | null;
  jobTitle?: string | null;
};

export type UpdateMemberInput = {
  name?: string;
  role?: "EMPLOYEE" | "ADMIN";
  team?: string | null;
  jobRank?: string | null;
  jobTitle?: string | null;
  active?: boolean;
  /** 있으면 비밀번호 재설정. */
  password?: string;
};

@Injectable()
export class ManageMembersUseCase {
  constructor(
    private readonly prisma: PrismaService,
    @Inject(ConfigService) private readonly config: ConfigService,
  ) {}

  /** 자립형 배포에서만 회원 직접 변경 허용. */
  private assertLocalMode() {
    const mode = this.config.get<string>("AUTH_MODE") ?? "ezpass";
    if (mode !== "local") {
      throw new ConflictException(
        "위임형(ezpass) 모드에서는 회원을 직접 추가·수정할 수 없습니다. 회원 변경은 ezpass에서 한 뒤 「지금 동기화」를 사용하세요.",
      );
    }
  }

  async create(input: CreateMemberInput) {
    this.assertLocalMode();
    const dup = await this.prisma.user.findUnique({ where: { email: input.email } });
    if (dup) throw new ConflictException(`이미 존재하는 이메일입니다: ${input.email}`);

    const passwordHash = await bcrypt.hash(input.password, BCRYPT_ROUNDS);
    const user = await this.prisma.user.create({
      data: {
        empId: input.empId?.trim() || `LOCAL-${Date.now()}`,
        email: input.email,
        name: input.name,
        role: input.role,
        team: input.team ?? null,
        jobRank: input.jobRank ?? null,
        jobTitle: input.jobTitle ?? null,
        passwordHash,
        active: true,
      },
    });
    return this.toRow(user);
  }

  async update(userId: bigint, input: UpdateMemberInput) {
    this.assertLocalMode();
    const existing = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!existing) throw new NotFoundException(`회원을 찾을 수 없습니다: ${userId}`);

    const data: Record<string, unknown> = {};
    if (input.name !== undefined) data.name = input.name;
    if (input.role !== undefined) data.role = input.role;
    if (input.team !== undefined) data.team = input.team;
    if (input.jobRank !== undefined) data.jobRank = input.jobRank;
    if (input.jobTitle !== undefined) data.jobTitle = input.jobTitle;
    if (input.active !== undefined) data.active = input.active;
    if (input.password) data.passwordHash = await bcrypt.hash(input.password, BCRYPT_ROUNDS);

    const user = await this.prisma.user.update({ where: { id: userId }, data });
    return this.toRow(user);
  }

  private toRow(u: {
    id: bigint; empId: string; name: string; email: string | null;
    team: string | null; jobRank: string | null; jobTitle: string | null;
    role: string; active: boolean;
  }) {
    return {
      userId: String(u.id),
      empId: u.empId,
      name: u.name,
      email: u.email,
      team: u.team,
      jobRank: u.jobRank,
      jobTitle: u.jobTitle,
      role: u.role as "EMPLOYEE" | "ADMIN",
      active: u.active,
    };
  }
}
