// ListMembers — 관리자 회원관리 탭의 읽기 전용 목록. 우리 users(ezpass 미러)를
// 그대로 보여준다. 위임형(현재)에선 이 화면은 읽기 전용 — 신원 정본은 ezpass다.

import { Injectable } from "@nestjs/common";
import { PrismaService } from "@/adapters/persistence/prisma.service";

export type MemberRow = {
  userId: string;
  empId: string;
  name: string;
  email: string | null;
  team: string | null;
  jobRank: string | null;
  jobTitle: string | null;
  role: "EMPLOYEE" | "ADMIN";
};

export type MemberList = {
  source: "ezpass-mirror";
  total: number;
  admins: number;
  members: MemberRow[];
};

@Injectable()
export class ListMembersUseCase {
  constructor(private readonly prisma: PrismaService) {}

  async execute(): Promise<MemberList> {
    const users = await this.prisma.user.findMany({
      orderBy: [{ role: "desc" }, { email: "asc" }],
      select: {
        id: true,
        empId: true,
        name: true,
        email: true,
        team: true,
        jobRank: true,
        jobTitle: true,
        role: true,
      },
    });
    return {
      source: "ezpass-mirror",
      total: users.length,
      admins: users.filter((u) => u.role === "ADMIN").length,
      members: users.map((u) => ({
        userId: String(u.id),
        empId: u.empId,
        name: u.name,
        email: u.email,
        team: u.team,
        jobRank: u.jobRank,
        jobTitle: u.jobTitle,
        role: u.role as "EMPLOYEE" | "ADMIN",
      })),
    };
  }
}
