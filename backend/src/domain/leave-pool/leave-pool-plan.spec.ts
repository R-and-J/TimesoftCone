import { planLeavePool, type PoolContribution } from "./leave-pool-plan";

const opts = {
  targetYear: 2027,
  startPrice: 5000n,
  minIncrement: 100n,
  auctionDays: 7,
  weeklyQty: 0,
};

function c(userId: number, name: string, days: number): PoolContribution {
  return { userId: BigInt(userId), name, days };
}

describe("planLeavePool", () => {
  it("creates one 1-day auction per contributed day (OP-2 전량 1:1)", () => {
    const plan = planLeavePool([c(3, "A", 2), c(7, "B", 3)], opts);
    expect(plan.summary.daysCollected).toBe(5);
    expect(plan.summary.auctionsCreated).toBe(5);
    expect(plan.items).toHaveLength(5);
    expect(plan.items.every((i) => i.leaveDays === 1)).toBe(true);
    expect(plan.items.every((i) => i.startPrice === 5000n)).toBe(true);
  });

  it("records stake per contributor, sorted by userId, excluding zero days", () => {
    const plan = planLeavePool([c(7, "B", 3), c(3, "A", 2), c(9, "Z", 0)], opts);
    expect(plan.stakes).toEqual([
      { userId: 3n, days: 2 },
      { userId: 7n, days: 3 },
    ]);
    expect(plan.summary.contributorCount).toBe(2);
  });

  it("schedules all items at targetYear start when weeklyQty=0", () => {
    const plan = planLeavePool([c(3, "A", 3)], opts);
    const jan1 = Date.UTC(2027, 0, 1);
    expect(plan.items.every((i) => i.startedAt.getTime() === jan1)).toBe(true);
    expect(plan.items[0].endsAt.getTime()).toBe(jan1 + 7 * 24 * 60 * 60 * 1000);
  });

  it("distributes startedAt weekly when weeklyQty>0 (OP-5)", () => {
    // 5개 매물, 주당 2개 → 0,0,1,1,2 주차.
    const plan = planLeavePool([c(3, "A", 5)], { ...opts, weeklyQty: 2 });
    const jan1 = Date.UTC(2027, 0, 1);
    const wk = 7 * 24 * 60 * 60 * 1000;
    const weeks = plan.items.map((i) => Math.round((i.startedAt.getTime() - jan1) / wk));
    expect(weeks).toEqual([0, 0, 1, 1, 2]);
  });

  it("returns an empty plan when there are no eligible contributions", () => {
    const plan = planLeavePool([c(3, "A", 0)], opts);
    expect(plan.items).toHaveLength(0);
    expect(plan.stakes).toHaveLength(0);
    expect(plan.summary).toEqual({ contributorCount: 0, daysCollected: 0, auctionsCreated: 0 });
  });
});
