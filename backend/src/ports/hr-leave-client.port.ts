// HrLeaveClient — outbound port for pushing a granted leave to an EXTERNAL HR
// system (ADR-005 Outbox 경유). 우리 leave_balance는 항상 마스터이고, 이 포트는
// "외부 HR에도 알린다"는 *선택적* 연동(groupware 모드). 구현체는 OutboxRelay가
// 호출한다 — 실패하면 throw → relay가 백오프 재시도/DLQ 처리.
//
// 주의(정책): ezpass의 실제 연차 테이블엔 쓰지 않는다(읽기 전용, 이중보상 방지 —
// ADR-016/020). 그래서 기본 구현은 설정된 HR 엔드콘(또는 mock)를 향하며,
// ezpass 직접 쓰기는 하지 않는다.

export const HR_LEAVE_CLIENT = Symbol("HR_LEAVE_CLIENT");

export type HrLeaveGrant = {
  userId: string;
  empId: string | null;
  email: string | null;
  year: number;
  days: number;
  leaveType: "AUCTION";
  auctionId: string;
};

export interface HrLeaveClient {
  /** 외부 HR에 연차 부여 통지. 실패 시 throw(→ Outbox 재시도). */
  grantLeave(grant: HrLeaveGrant): Promise<void>;
}
