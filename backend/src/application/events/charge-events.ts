// 충전 요청 워크플로 도메인 이벤트 (ADR-024 + ADR-013).
// Use Case가 트랜잭션 커밋 후 emit, NotificationObserver가 구독해 알림 적재.

export const CHARGE_EVENTS = {
  SUBMITTED: "charge.request_submitted",
  APPROVED: "charge.approved",
  REJECTED: "charge.rejected",
} as const;

/** 사용자가 충전 요청을 등록. 관리자들에게 알림이 가야 함. */
export class ChargeRequestSubmittedEvent {
  constructor(
    public readonly requestId: number,
    public readonly requesterId: bigint,
    public readonly requesterName: string,
    public readonly amount: bigint,
    public readonly note: string | null,
  ) {}
}

/** 관리자가 승인 → 잔액 적립까지 커밋된 후 발행. 요청자에게 알림. */
export class ChargeApprovedEvent {
  constructor(
    public readonly requestId: number,
    public readonly requesterId: bigint,
    public readonly amount: bigint,
  ) {}
}

/** 관리자가 반려. 요청자에게 알림(사유 포함). */
export class ChargeRejectedEvent {
  constructor(
    public readonly requestId: number,
    public readonly requesterId: bigint,
    public readonly amount: bigint,
    public readonly decisionNote: string | null,
  ) {}
}
