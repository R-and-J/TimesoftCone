// ManageMembers — 회원 CRUD (ADR-022, 3-role 개정).
//
// 게이트는 배포 모드(AUTH_MODE)가 아니라 "대상 회원의 종류"로 판단한다:
//   - EZPASS(회사 도메인 연동) 회원: 신원 정본이 ezpass → 로컬 수정 거부(409). 동기화로만.
//   - EXAM(비연동 독립) / ADMIN(로컬) 회원: 우리 users가 정본 → 추가/수정/비번/비활성 허용.
// 신규 생성은 회사 도메인 이메일이면 거부(EZPASS는 ezpass에서 생성·동기화).

import { ConflictException, Inject, Injectable, NotFoundException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import * as bcrypt from "bcryptjs";
import { PrismaService } from "@/adapters/persistence/prisma.service";

const BCRYPT_ROUNDS = 10;

export type CreateMemberInput = {
  email: string;
  name: string;
  password: string;
  // 로컬 생성은 exam 영역 계정만(EXAM/EXAM_ADMIN). EZPASS는 ezpass 동기화로만 생성된다.
  role: "EXAM" | "EXAM_ADMIN";
  empId?: string;
  team?: string | null;
  jobRank?: string | null;
  jobTitle?: string | null;
};

export type UpdateMemberInput = {
  name?: string;
  role?: "EXAM" | "EXAM_ADMIN";
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

  /** 회사 도메인(EZPASS) 이메일인지. 로컬 생성에서 거부 판정에 사용. */
  private isEzpassDomain(email: string): boolean {
    const domain = (email.split("@")[1] ?? "").toLowerCase();
    const ezpassDomain = (
      this.config.get<string>("EZPASS_EMAIL_DOMAIN") ?? "timesoftcone.com"
    ).toLowerCase();
    return domain === ezpassDomain;
  }

  async create(input: CreateMemberInput) {
    if (this.isEzpassDomain(input.email)) {
      throw new ConflictException(
        "회사 도메인(EZPASS) 계정은 ezpass에서 생성·동기화합니다. 로컬 추가는 EXAM(비연동) 계정만 가능합니다.",
      );
    }
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
    const existing = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!existing) throw new NotFoundException(`회원을 찾을 수 없습니다: ${userId}`);
    if (existing.role === "EZPASS") {
      throw new ConflictException(
        "EZPASS(ezpass 연동) 회원은 여기서 수정할 수 없습니다. ezpass에서 변경 후 「지금 동기화」를 사용하세요.",
      );
    }

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
      role: u.role as "ADMIN" | "EZPASS_ADMIN" | "EXAM_ADMIN" | "EZPASS" | "EXAM",
      active: u.active,
    };
  }
}
