// LEAVE_ADMIN 포트 — FR-3.1(휴가 차감 우선순위) + FR-4.2(유찰 재고 처리)의
// 영속화 지점. 세 메서드는 각각 단일 트랜잭션으로 묶어 어댑터가 보장한다.
//
// ───────────────────────────────────────────────────────────────
//  분석용 주석 (future Claude/리뷰어용)
// ───────────────────────────────────────────────────────────────
// 한 포트에 묶은 이유: 세 use case 모두 "관리자 권한이 leave_balance 또는 유찰 재고를
// 직접 조작"하는 같은 부류이고, 각자 별 어댑터를 두기엔 너무 작다. 더 커지면 분리.
import type { LeaveConsumption } from "@/domain/leave/leave-deduction";

export const LEAVE_ADMIN = Symbol("LeaveAdmin");

export type DeductPriorityInput = {
  userId: bigint;
  year: number;
  days: number;
};

export type DeductPriorityResult = {
  consumed: LeaveConsumption;
  remainingAfter: { AUCTION: number; EVENT: number; REGULAR: number };
};

export type GrantEventInput = {
  /** 소비할 UNSOLD 1일권의 경매 ID. */
  auctionId: string;
  /** EVENT 휴가를 받을 직원 ID. */
  userId: bigint;
};

export type GrantEventResult = {
  auctionId: string;
  userId: bigint;
  year: number;
  days: number;
};

export interface LeaveAdminPort {
  /** FR-3.1 — AUCTION → EVENT → REGULAR 우선순위로 days만큼 차감(단일 tx). */
  deductPriority(input: DeductPriorityInput): Promise<DeductPriorityResult>;

  /**
   * FR-4.2 — 특정 UNSOLD 경매를 EVENT 휴가로 변환해 직원에게 지급(단일 tx).
   * 경매가 UNSOLD가 아니면 거부. 변환 후 경매 행은 삭제(인벤토리 소진).
   */
  grantEventFromUnsold(input: GrantEventInput): Promise<GrantEventResult>;

  /**
   * FR-4.2 — 지정 연도 이전(포함) UNSOLD 경매를 모두 영구 삭제.
   * 익년으로 이월 차단(회계 원천 차단, SRS FR-4.2 제약).
   */
  purgeUnsold(input: { upToYear: number }): Promise<{ deleted: number }>;
}
