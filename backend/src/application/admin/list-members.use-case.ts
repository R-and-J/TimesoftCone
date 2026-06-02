// ListMembers — 관리자 회원관리 탭의 읽기 전용 목록. 우리 users(ezpass 미러)를
// 그대로 보여준다. 위임형(현재)에선 이 화면은 읽기 전용 — 신원 정본은 ezpass다.

import { Inject, Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { PrismaService } from "@/adapters/persistence/prisma.service";

export type MemberRow = {
  userId: string;
  empId: string;
  name: string;
  email: string | null;
  team: string | null;
  jobRank: string | null;
  jobTitle: string | null;
  role: "ADMIN" | "EZPASS_ADMIN" | "EXAM_ADMIN" | "EZPASS" | "EXAM";
  active: boolean;
  /** WELFARE_POINT 잔액(bigint를 문자열로). 지갑 없으면 "0". */
  balance: string;
  /** 올해 연차 — 회원관리 표 시각화용. ADR-002 3-flag. */
  leave: {
    regular: number; // 일반(REGULAR.granted+adj)
    auction: number; // 경매 낙찰(AUCTION.granted+adj)
    event: number;   // 이벤트(EVENT.granted+adj)
    used: number;    // 합산 used
    total: number;   // 합 − used (잔여)
  };
};

export type MemberList = {
  /** 배포 모드 — 프론트가 읽기전용(ezpass)/CRUD(local) 분기에 사용 (ADR-022). */
  mode: "ezpass" | "local";
  source: "ezpass-mirror" | "local";
  total: number;
  admins: number;
  members: MemberRow[];
};

@Injectable()
export class ListMembersUseCase {
  constructor(
    private readonly prisma: PrismaService,
    @Inject(ConfigService) private readonly config: ConfigService,
  ) {}

  async execute(): Promise<MemberList> {
    const mode = this.config.get<string>("AUTH_MODE") === "local" ? "local" : "ezpass";
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
        active: true,
      },
    });
    // 회원별 WELFARE_POINT 잔액 — 단일 쿼리로 가져와 map(N+1 회피).
    const wallets = await this.prisma.wallet.findMany({
      where: { userId: { in: users.map((u) => u.id) }, currency: "WELFARE_POINT" },
      select: { userId: true, balance: true },
    });
    const balanceByUser = new Map<bigint, bigint>();
    for (const w of wallets) balanceByUser.set(w.userId, w.balance);

    // 올해 연차 — 회원별로 type 분리해 묶음(시각화용).
    const year = new Date().getFullYear();
    const lbs = await this.prisma.leaveBalance.findMany({
      where: { userId: { in: users.map((u) => u.id) }, year },
      select: { userId: true, leaveType: true, grantedDays: true, adjustedDays: true, usedDays: true },
    });
    const leaveByUser = new Map<bigint, { regular: number; auction: number; event: number; used: number }>();
    for (const lb of lbs) {
      const cur = leaveByUser.get(lb.userId) ?? { regular: 0, auction: 0, event: 0, used: 0 };
      const granted = lb.grantedDays + lb.adjustedDays;
      if (lb.leaveType === "REGULAR") cur.regular += granted;
      else if (lb.leaveType === "AUCTION") cur.auction += granted;
      else if (lb.leaveType === "EVENT") cur.event += granted;
      cur.used += lb.usedDays;
      leaveByUser.set(lb.userId, cur);
    }

    return {
      mode,
      source: mode === "local" ? "local" : "ezpass-mirror",
      total: users.length,
      admins: users.filter((u) => ["ADMIN", "EZPASS_ADMIN", "EXAM_ADMIN"].includes(u.role)).length,
      members: users.map((u) => {
        const lv = leaveByUser.get(u.id) ?? { regular: 0, auction: 0, event: 0, used: 0 };
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
          balance: (balanceByUser.get(u.id) ?? 0n).toString(),
          leave: { ...lv, total: lv.regular + lv.auction + lv.event - lv.used },
        };
      }),
    };
  }
}
