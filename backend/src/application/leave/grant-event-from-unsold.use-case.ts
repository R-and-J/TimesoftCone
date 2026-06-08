// FR-4.2 part 1 — 유찰 1일권을 EVENT 휴가로 변환해 직원에게 수동 지급.
//
// ───────────────────────────────────────────────────────────────
//  분석용 주석 (future Claude/리뷰어용)
// ───────────────────────────────────────────────────────────────
// "왜 이게 늦게 들어왔나":
//   - 데모/시연 임팩트가 약했다. 핵심 메커니즘(입찰→낙찰→배당→풀)에 비해
//     주변부라 학교 프로젝트 9주 안에 우선순위가 밀려 있었다.
//   - 미동작 아니라 미구현. UNSOLD 매물이 그냥 남아 있어도 에스크로/배당/
//     새 경매에 무영향이라 데모는 그대로 돌고 있었다.
//   - 이번에 만든 이유: SRS FR-4.2를 완성하기 위해. 동시에 PurgeUnsold와
//     12/31 청산 스케줄러도 같이 들어와 인벤토리 라이프사이클이 닫힌다.
//
// 부수효과(어댑터 트랜잭션 내부):
//   1. leave_balance(userId, year=auction.endsAt 연도, EVENT).adjustedDays += auction.leaveDays
//   2. 경매 행 DELETE — 인벤토리 소진(중복 지급 방지).
// 본 단계는 wallet/escrow와 *무관*하다(EVENT 휴가는 시간이지 콘이 아님,
// ADR-002 3-flag).
import { Inject, Injectable } from "@nestjs/common";
import { LEAVE_ADMIN, type LeaveAdminPort } from "@/ports/leave-admin.port";

export type GrantEventFromUnsoldInput = {
  auctionId: string;
  userId: bigint | number | string;
};

@Injectable()
export class GrantEventFromUnsoldUseCase {
  constructor(@Inject(LEAVE_ADMIN) private readonly leaveAdmin: LeaveAdminPort) {}

  async execute(input: GrantEventFromUnsoldInput) {
    return this.leaveAdmin.grantEventFromUnsold({
      auctionId: input.auctionId,
      userId: BigInt(input.userId),
    });
  }
}
