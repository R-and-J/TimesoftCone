// 관리자 회원관리 (ADR-022, 관리자 영역 분리).
//   목록/충전: 모든 관리자(ADMIN_ROLES).
//   동기화(ezpass): ADMIN·EZPASS_ADMIN.   추가/수정(EXAM 로컬): ADMIN·EXAM_ADMIN.
//   EZPASS 회원 수정은 use-case에서 409(ezpass 동기화 전용).

import { BadRequestException, Body, Controller, Get, Param, Patch, Post } from "@nestjs/common";
import { z } from "zod";
import { ListMembersUseCase } from "@/application/admin/list-members.use-case";
import { SyncMembersUseCase } from "@/application/admin/sync-members.use-case";
import { ManageMembersUseCase } from "@/application/admin/manage-members.use-case";
import { ZodValidationPipe } from "./zod.pipe";
import { Roles, ADMIN_ROLES, CurrentUser, type AuthUser } from "./auth/auth.decorators";

const createSchema = z.object({
  email: z.string().email("올바른 이메일이 아닙니다"),
  name: z.string().min(1, "이름은 필수입니다"),
  password: z.string().min(4, "비밀번호는 4자 이상"),
  // 로컬 생성은 exam 영역 계정만(EXAM/EXAM_ADMIN). EZPASS는 ezpass 동기화로만.
  role: z.enum(["EXAM", "EXAM_ADMIN"]).default("EXAM"),
  empId: z.string().optional(),
  team: z.string().nullish(),
  jobRank: z.string().nullish(),
  jobTitle: z.string().nullish(),
});

const updateSchema = z.object({
  name: z.string().min(1).optional(),
  role: z.enum(["EXAM", "EXAM_ADMIN"]).optional(),
  team: z.string().nullish(),
  jobRank: z.string().nullish(),
  jobTitle: z.string().nullish(),
  active: z.boolean().optional(),
  password: z.string().min(4).optional(),
});

@Roles(...ADMIN_ROLES)
@Controller("api/admin/members")
export class AdminMembersController {
  constructor(
    private readonly list: ListMembersUseCase,
    private readonly sync: SyncMembersUseCase,
    private readonly manage: ManageMembersUseCase,
  ) {}

  /** 회원 목록(읽기). 회사 스코프(super ADMIN은 전 회사). 응답 mode로 프론트 분기. */
  @Get()
  async listMembers(@CurrentUser() user: AuthUser) {
    return this.list.execute(user.role === "ADMIN" ? null : user.companyId);
  }

  /** ezpass org에서 회원 명단을 다시 당겨와 미러 갱신. ezpass 영역 관리자만. */
  @Roles("ADMIN", "EZPASS_ADMIN")
  @Post("sync")
  async syncMembers() {
    return this.sync.execute();
  }

  /** 회원 추가(EXAM 로컬). exam 영역 관리자만. */
  @Roles("ADMIN", "EXAM_ADMIN")
  @Post()
  async createMember(@Body(new ZodValidationPipe(createSchema)) body: z.infer<typeof createSchema>) {
    return this.manage.create(body);
  }

  /** 회원 수정/비번재설정/비활성(EXAM 로컬). exam 영역 관리자만. EZPASS는 use-case에서 409. */
  @Roles("ADMIN", "EXAM_ADMIN")
  @Patch(":id")
  async updateMember(
    @Param("id") id: string,
    @Body(new ZodValidationPipe(updateSchema)) body: z.infer<typeof updateSchema>,
  ) {
    if (!/^\d+$/.test(id)) throw new BadRequestException("잘못된 회원 id");
    return this.manage.update(BigInt(id), body);
  }
}
