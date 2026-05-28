// LeavePool 도메인 — 연말 풀 수집(ADR-017)의 순수 계획 로직.
// "기여(REGULAR 미사용 일수) 목록" → "Stake 기록 + 익년도 매물(1일권) 목록"으로
// 변환한다. 외부 의존 0(인바리언트 #7) — 영속화/ID 채번은 어댑터 몫.
//
// 정책(business-rules OP-2/OP-5/OP-6):
//   - OP-2 수집 전량 1:1 — 기여 N일 = 1일권 N개.
//   - OP-6 시작가 — 고정 최소가(모드②, knob). 첫 해엔 작년 데이터 없으니 고정가.
//   - OP-5 분산 오픈 — weeklyQty>0이면 주당 그만큼씩 startedAt을 주 단위로 분산.

export type PoolContribution = {
  userId: bigint;
  name: string;
  /** 연말에 공용 풀로 기여한 REGULAR 미사용 일수( > 0 ). */
  days: number;
};

export type InventoryItem = {
  /** 어느 기여자의 기여분에서 나온 매물인지(감사용 — 매물 자체는 대체가능). */
  sourceUserId: bigint;
  startedAt: Date;
  endsAt: Date;
  startPrice: bigint;
  minIncrement: bigint;
  leaveDays: number;
};

export type LeavePoolPlanOptions = {
  /** 매물이 속한 연도(= sourceYear + 1). 스케줄 기준 연도. */
  targetYear: number;
  startPrice: bigint;
  minIncrement: bigint;
  /** 한 매물의 입찰 가능 기간(일). */
  auctionDays: number;
  /** 주당 오픈 개수(0이면 전량 targetYear 1/1 동시 시작). */
  weeklyQty: number;
};

export type LeavePoolPlan = {
  /** 기여자별 Stake(= contributedDays) 기록. */
  stakes: { userId: bigint; days: number }[];
  /** 생성할 1일권 매물(총 Σdays개). */
  items: InventoryItem[];
  summary: {
    contributorCount: number;
    daysCollected: number;
    auctionsCreated: number;
  };
};

const WEEK_MS = 7 * 24 * 60 * 60 * 1000;
const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * 기여 목록으로부터 Stake와 매물 계획을 만든다(순수). 기여일이 0 이하인 사람은
 * 제외. 결과는 결정적(기여자는 userId 오름차순, 매물은 생성 순서대로).
 */
export function planLeavePool(
  contributions: PoolContribution[],
  opts: LeavePoolPlanOptions,
): LeavePoolPlan {
  const eligible = contributions
    .filter((c) => c.days > 0)
    .sort((a, b) => (a.userId < b.userId ? -1 : a.userId > b.userId ? 1 : 0));

  const stakes = eligible.map((c) => ({ userId: c.userId, days: c.days }));
  const daysCollected = eligible.reduce((s, c) => s + c.days, 0);

  const yearStart = new Date(Date.UTC(opts.targetYear, 0, 1, 0, 0, 0));
  const items: InventoryItem[] = [];
  let index = 0; // 전체 매물 순번 — 주차 분산에 사용
  for (const c of eligible) {
    for (let d = 0; d < c.days; d++) {
      const weekOffset =
        opts.weeklyQty > 0 ? Math.floor(index / opts.weeklyQty) : 0;
      const startedAt = new Date(yearStart.getTime() + weekOffset * WEEK_MS);
      const endsAt = new Date(startedAt.getTime() + opts.auctionDays * DAY_MS);
      items.push({
        sourceUserId: c.userId,
        startedAt,
        endsAt,
        startPrice: opts.startPrice,
        minIncrement: opts.minIncrement,
        leaveDays: 1,
      });
      index++;
    }
  }

  return {
    stakes,
    items,
    summary: {
      contributorCount: eligible.length,
      daysCollected,
      auctionsCreated: items.length,
    },
  };
}
