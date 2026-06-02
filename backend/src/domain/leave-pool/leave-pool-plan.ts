// LeavePool 도메인 — 연말 풀 수집(ADR-017)의 순수 계획 로직.
// 2026-06-02 점진 발행 결정으로 단순화: 수집 시점에 매물을 만들지 않고,
// Stake와 supply(기여자별 잔여)만 만든다. 매물은 ReleaseInventoryUseCase가
// ReleasePolicy 주기마다 supply에서 N개씩 빼서 생성한다.
//
// 외부 의존 0(인바리언트 #7). InventoryItem/시작가 등은 release 도메인으로 이동.

export type PoolContribution = {
  userId: bigint;
  name: string;
  /** 연말에 공용 풀로 기여한 REGULAR 미사용 일수( > 0 ). */
  days: number;
};

export type LeavePoolPlan = {
  /** 기여자별 Stake(= contributedDays) 기록. 어댑터가 stake/supply 두 곳에 적재. */
  stakes: { userId: bigint; days: number }[];
  summary: {
    contributorCount: number;
    daysCollected: number;
  };
};

/**
 * 기여 목록을 (회사 스코프 가정) 결정적으로 정리한다. 기여 0 이하는 제외,
 * 결과는 userId 오름차순.
 */
export function planLeavePool(contributions: PoolContribution[]): LeavePoolPlan {
  const eligible = contributions
    .filter((c) => c.days > 0)
    .sort((a, b) => (a.userId < b.userId ? -1 : a.userId > b.userId ? 1 : 0));

  const stakes = eligible.map((c) => ({ userId: c.userId, days: c.days }));
  const daysCollected = eligible.reduce((s, c) => s + c.days, 0);

  return {
    stakes,
    summary: {
      contributorCount: eligible.length,
      daysCollected,
    },
  };
}
