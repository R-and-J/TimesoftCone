// FR-3.1 휴가 차감 우선순위 — 순수 계산.
//
// ───────────────────────────────────────────────────────────────
//  분석용 주석 (future Claude/리뷰어용)
// ───────────────────────────────────────────────────────────────
// 원래 이 우선순위 차감 규칙(AUCTION → EVENT → REGULAR)은 SRS FR-3.1로 정의돼 있었지만
// 오래 미구현 상태였다. 이유: 사내 휴가 신청/승인 워크플로(기안→결재) 자체는 ezpass/
// 그룹웨어가 소유한다는 ADR-016 결정 때문에, 우리 시스템 내부에는 "사용 트리거"가 없었다.
// 트리거 없는 곳에 우선순위 차감을 만들어두면 "호출자 0"인 죽은 코드가 된다.
//
// 이번에 만든 이유: 향후 외부 그룹웨어 통합 어댑터가 붙을 때 즉시 사용할 수 있도록
// 우선순위 규칙을 *권위 있게* 코드에 박아두는 게 더 안전하다(인바리언트 #3와 일치).
// 호출자는 일단 ADMIN 디버그/시연용 HTTP 엔드콘 1개. 추후 외부 통합 시
// 같은 use case를 그대로 재사용한다.
//
// 도메인 순수성 유지: 외부 의존 0. leave_balance 영속화는 adapters/persistence에서.

export type LeaveRemainingByType = {
  AUCTION: number;
  EVENT: number;
  REGULAR: number;
};

export type LeaveConsumption = {
  AUCTION: number;
  EVENT: number;
  REGULAR: number;
};

/** 우선순위(ADR-002/003): AUCTION → EVENT → REGULAR. 사용자는 선택권 없음. */
export const LEAVE_DEDUCTION_ORDER = ["AUCTION", "EVENT", "REGULAR"] as const;

export class InsufficientLeaveError extends Error {
  constructor(requested: number, total: number) {
    super(`Insufficient leave: requested ${requested} days, total remaining ${total}`);
    this.name = "InsufficientLeaveError";
  }
}

/**
 * `days`일을 잔여 휴가에서 강제 우선순위로 차감했을 때의 *계획*을 계산한다.
 * 영속화는 별건 — 호출자가 결과를 받아 한 트랜잭션에 leave_balance를 갱신.
 *
 * @throws InsufficientLeaveError  잔여 합계 < days
 */
export function planLeaveDeduction(
  remaining: LeaveRemainingByType,
  days: number,
): LeaveConsumption {
  if (!Number.isInteger(days) || days <= 0) {
    throw new Error(`days must be a positive integer, got ${days}`);
  }
  const total = remaining.AUCTION + remaining.EVENT + remaining.REGULAR;
  if (total < days) throw new InsufficientLeaveError(days, total);

  let left = days;
  const out: LeaveConsumption = { AUCTION: 0, EVENT: 0, REGULAR: 0 };
  for (const t of LEAVE_DEDUCTION_ORDER) {
    if (left === 0) break;
    const take = Math.min(remaining[t], left);
    out[t] = take;
    left -= take;
  }
  return out;
}
