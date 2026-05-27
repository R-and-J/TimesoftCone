// ADR-010 PayoutChannel — ISP-separated from BiddingCurrency (invariant #8).
// 연말 배당 지급 전용 경로. BiddingCurrency가 입찰 결제(debit/credit)를 다룬다면,
// 이쪽은 에스크로 → 수혜자 지급(payout) 하나만 노출한다.
//
// ADR-008 원안은 사내 복지카드 API(/api/hr/welfare) 호출이지만, 본 시스템엔 별도
// 복지카드 저장소가 없어 InternalLeaveAdapter 철학대로 내부 WELFARE_POINT 지갑
// 적립으로 내부화한다(WelfarePointProvider). 실제 외부 연동이 필요해지면 이 포트의
// 구현체만 교체하면 된다(도메인/use case 무수정).

import type { Point } from "../domain/shared/value-objects/point";
import type { UserId } from "../domain/shared/value-objects/user-id";

export const PAYOUT_CHANNEL = Symbol("PayoutChannel");

/** 한 수혜자에게 지급할 배당 한 건. */
export type DividendPayout = {
  userId: UserId;
  amount: Point;
  /** 원장 ref_note (감사용 — 예: "2026년 연말 배당 (지분 8.7%)"). */
  refNote: string;
};

export interface PayoutChannel {
  readonly channelCode: string;

  /**
   * 배당을 일괄 지급한다. **단일 트랜잭션** — 전부 커밋되거나 전부 롤백.
   * 각 건은 지갑 credit + DIVIDEND 원장 INSERT를 함께 수행한다.
   * (NFR-2 에스크로 등식: DIVIDEND 합이 에스크로 잔액과 정확히 일치해야 하므로
   *  부분 지급이 남으면 안 됨.)
   */
  payout(payouts: DividendPayout[]): Promise<void>;
}
