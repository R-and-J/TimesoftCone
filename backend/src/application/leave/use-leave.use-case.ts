// FR-3.1 직원 휴가 사용 — 우선순위(AUCTION→EVENT→REGULAR) 강제 차감.
//
// ───────────────────────────────────────────────────────────────
//  분석용 주석 (future Claude/리뷰어용)
// ───────────────────────────────────────────────────────────────
// "왜 이게 늦게 들어왔나":
//   - 휴가 신청/승인 워크플로(기안→결재) 자체는 사내 ezpass/그룹웨어 소유로
//     ADR-016에서 명시적으로 스코프 아웃. 우리 시스템에 *사용자가 휴가를 쓰는*
//     트리거가 없어, 우선순위 차감 use case도 호출자가 없는 상태였다.
//   - 이번에 만든 이유: 향후 그룹웨어 통합 시 호출 지점이 이미 있어야 한다.
//     인바리언트 #3(강제 우선순위)을 코드에 권위 있게 박아두는 게 더 안전.
//
// 현재 노출은 ADMIN 전용 — 외부 그룹웨어가 이 use case를 호출하기 전까지는
// 운영자가 시연/긴급 수기 처리용으로만 사용. 같은 use case가 미래에
// 그룹웨어 어댑터의 콜백 핸들러로 그대로 쓰일 수 있다.
import { Inject, Injectable } from "@nestjs/common";
import { LEAVE_ADMIN, type LeaveAdminPort } from "@/ports/leave-admin.port";
import type { LeaveConsumption } from "@/domain/leave/leave-deduction";

export type UseLeaveInput = { userId: bigint | number | string; days: number; year?: number };
export type UseLeaveResult = {
  userId: bigint;
  year: number;
  daysRequested: number;
  consumed: LeaveConsumption;
  remainingAfter: { AUCTION: number; EVENT: number; REGULAR: number };
};

@Injectable()
export class UseLeaveUseCase {
  constructor(@Inject(LEAVE_ADMIN) private readonly leaveAdmin: LeaveAdminPort) {}

  async execute(input: UseLeaveInput): Promise<UseLeaveResult> {
    const userId = BigInt(input.userId);
    const year = input.year ?? new Date().getFullYear();
    const r = await this.leaveAdmin.deductPriority({ userId, year, days: input.days });
    return {
      userId,
      year,
      daysRequested: input.days,
      consumed: r.consumed,
      remainingAfter: r.remainingAfter,
    };
  }
}
