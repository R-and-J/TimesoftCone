// LoginByEmpId — school-project login. No password, no JWT.
//
// The frontend already keeps a "current user" in localStorage; this endpoint
// just lets the user pick which seeded employee they are by entering their
// empId. When real auth lands, swap this for password verification + JWT.

import { Injectable, NotFoundException } from "@nestjs/common";
import { PrismaService } from "@/adapters/persistence/prisma.service";

export type LoginResult = {
  userId: bigint;
  empId: string;
  name: string;
  role: "EMPLOYEE" | "ADMIN";
  team: string | null;
};

@Injectable()
export class LoginByEmpIdUseCase {
  constructor(private readonly prisma: PrismaService) {}

  async execute(empId: string): Promise<LoginResult> {
    const user = await this.prisma.user.findUnique({ where: { empId } });
    if (!user) {
      throw new NotFoundException(`Employee ${empId} not found`);
    }
    return {
      userId: user.id,
      empId: user.empId,
      name: user.name,
      role: user.role,
      team: user.team,
    };
  }
}
