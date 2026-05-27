// 관리자 회원관리 (ADR-022).
//   위임형(ezpass): 읽기 전용 미러 뷰 + "지금 동기화".
//   자립형(local) : 회원 CRUD(추가/수정/비번/비활성). local 모드가 아니면 CRUD는 409.
// ADMIN 전용 (회원 관리 = 운영 권한).

import { BadRequestException, Body, Controller, Get, Param, Patch, Post } from "@nestjs/common";
import { z } from "zod";
import { ListMembersUseCase } from "@/application/admin/list-members.use-case";
import { SyncMembersUseCase } from "@/application/admin/sync-members.use-case";
import { ManageMembersUseCase } from "@/application/admin/manage-members.use-case";
import { ZodValidationPipe } from "./zod.pipe";
import { Roles } from "./auth/auth.decorators";

const createSchema = z.object({
  email: z.string().email("올바른 이메일이 아닙니다"),
  name: z.string().min(1, "이름은 필수입니다"),
  password: z.string().min(4, "비밀번호는 4자 이상"),
  role: z.enum(["EMPLOYEE", "ADMIN"]).default("EMPLOYEE"),
  empId: z.string().optional(),
  team: z.string().nullish(),
  jobRank: z.string().nullish(),
  jobTitle: z.string().nullish(),
});

const updateSchema = z.object({
  name: z.string().min(1).optional(),
  role: z.enum(["EMPLOYEE", "ADMIN"]).optional(),
  team: z.string().nullish(),
  jobRank: z.string().nullish(),
  jobTitle: z.string().nullish(),
  active: z.boolean().optional(),
  password: z.string().min(4).optional(),
});

@Roles("ADMIN")
@Controller("api/admin/members")
export class AdminMembersController {
  constructor(
    private readonly list: ListMembersUseCase,
    private readonly sync: SyncMembersUseCase,
    private readonly manage: ManageMembersUseCase,
  ) {}

  /** 회원 목록(읽기). 응답의 mode로 프론트가 읽기전용/CRUD 분기. */
  @Get()
  async listMembers() {
    return this.list.execute();
  }

  /** ezpass org에서 회원 명단을 다시 당겨와 미러 갱신(위임형). */
  @Post("sync")
  async syncMembers() {
    return this.sync.execute();
  }

  /** 회원 추가(자립형 전용 — 위임형이면 409). */
  @Post()
  async createMember(@Body(new ZodValidationPipe(createSchema)) body: z.infer<typeof createSchema>) {
    return this.manage.create(body);
  }

  /** 회원 수정/비번재설정/비활성(자립형 전용 — 위임형이면 409). */
  @Patch(":id")
  async updateMember(
    @Param("id") id: string,
    @Body(new ZodValidationPipe(updateSchema)) body: z.infer<typeof updateSchema>,
  ) {
    if (!/^\d+$/.test(id)) throw new BadRequestException("잘못된 회원 id");
    return this.manage.update(BigInt(id), body);
  }
}
