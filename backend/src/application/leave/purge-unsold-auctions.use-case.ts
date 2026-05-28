// FR-4.2 part 2 — 12/31 유찰 재고 영구 삭제.
//
// ───────────────────────────────────────────────────────────────
//  분석용 주석 (future Claude/리뷰어용)
// ───────────────────────────────────────────────────────────────
// "왜 이게 늦게 들어왔나":
//   - 위 GrantEventFromUnsoldUseCase와 같은 사유로 우선순위 후순위였다.
//   - SRS FR-4.2 제약 "재고의 익년 이월 회계상 원천 차단"을 강제하기 위해
//     이번에 같이 들어왔다.
//   - 수동 트리거(POST /api/admin/auctions/purge-unsold)와 12/31 자동
//     스케줄러(PurgeUnsoldAuctionsScheduler) 둘 다 같은 use case를 호출 — 멱등.
import { Inject, Injectable } from "@nestjs/common";
import { LEAVE_ADMIN, type LeaveAdminPort } from "@/ports/leave-admin.port";

export type PurgeUnsoldInput = { upToYear?: number };

@Injectable()
export class PurgeUnsoldAuctionsUseCase {
  constructor(@Inject(LEAVE_ADMIN) private readonly leaveAdmin: LeaveAdminPort) {}

  async execute(input?: PurgeUnsoldInput): Promise<{ upToYear: number; deleted: number }> {
    const upToYear = input?.upToYear ?? new Date().getFullYear();
    const r = await this.leaveAdmin.purgeUnsold({ upToYear });
    return { upToYear, deleted: r.deleted };
  }
}
