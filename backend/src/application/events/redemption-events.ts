// 교환 신청 워크플로 도메인 이벤트 (ADR-023 v2 + ADR-013).
// Use Case가 트랜잭션 커밋 후 emit, NotificationObserver가 구독해 알림 적재.

export const REDEMPTION_EVENTS = {
  SUBMITTED: "redemption.request_submitted",
  APPROVED: "redemption.approved",
  REJECTED: "redemption.rejected",
  RECEIVED: "redemption.received",
} as const;

/** 사용자가 교환 신청을 등록(차감/잠금 완료). 관리자들에게 알림. */
export class RedemptionRequestSubmittedEvent {
  constructor(
    public readonly requestId: number,
    public readonly requesterId: bigint,
    public readonly requesterName: string,
    public readonly itemName: string,
    public readonly priceP: bigint,
  ) {}
}

/** 관리자가 승인 + 쿠폰 발급. 요청자에게 "수령 가능" 알림. */
export class RedemptionApprovedEvent {
  constructor(
    public readonly requestId: number,
    public readonly requesterId: bigint,
    public readonly itemName: string,
    public readonly couponCode: string,
  ) {}
}

/** 관리자가 반려(REDEEM_REFUND 환불 커밋 후). 요청자에게 알림(사유). */
export class RedemptionRejectedEvent {
  constructor(
    public readonly requestId: number,
    public readonly requesterId: bigint,
    public readonly itemName: string,
    public readonly refundP: bigint,
    public readonly decisionNote: string | null,
  ) {}
}

/** 사용자가 "수령 완료" 버튼으로 최종 컨펌. 관리자들에게 알림(처리 종결 확인). */
export class RedemptionReceivedEvent {
  constructor(
    public readonly requestId: number,
    public readonly requesterId: bigint,
    public readonly requesterName: string,
    public readonly itemName: string,
  ) {}
}
