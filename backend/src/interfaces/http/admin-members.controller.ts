// 관리자 회원관리 — 위임형(ezpass) 배포에선 읽기 전용 미러 뷰 + "지금 동기화".
// 신원 정본은 ezpass라 여기서 추가/수정은 하지 않는다(이중 원본 방지). 자립형
// (LocalAuthProvider) 배포로 가면 이 컨트롤러에 CRUD를 더한다.
// RBAC는 아직 없음(scope-cuts CUT-8) — 후속 PR에서 ADMIN 가드.

import { Controller, Get, Post } from "@nestjs/common";
import { ListMembersUseCase } from "@/application/admin/list-members.use-case";
import { SyncMembersUseCase } from "@/application/admin/sync-members.use-case";

@Controller("api/admin/members")
export class AdminMembersController {
  constructor(
    private readonly list: ListMembersUseCase,
    private readonly sync: SyncMembersUseCase,
  ) {}

  /** 미러된 회원 목록(읽기 전용). */
  @Get()
  async listMembers() {
    return this.list.execute();
  }

  /** ezpass org에서 회원 명단을 다시 당겨와 미러 갱신. */
  @Post("sync")
  async syncMembers() {
    return this.sync.execute();
  }
}
