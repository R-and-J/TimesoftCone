import { planLeavePool, type PoolContribution } from "./leave-pool-plan";

function c(userId: number, name: string, days: number): PoolContribution {
  return { userId: BigInt(userId), name, days };
}

describe("planLeavePool", () => {
  it("records stake per contributor, sorted by userId, excluding zero days", () => {
    const plan = planLeavePool([c(7, "B", 3), c(3, "A", 2), c(9, "Z", 0)]);
    expect(plan.stakes).toEqual([
      { userId: 3n, days: 2 },
      { userId: 7n, days: 3 },
    ]);
    expect(plan.summary).toEqual({ contributorCount: 2, daysCollected: 5 });
  });

  it("returns an empty plan when there are no eligible contributions", () => {
    const plan = planLeavePool([c(3, "A", 0)]);
    expect(plan.stakes).toHaveLength(0);
    expect(plan.summary).toEqual({ contributorCount: 0, daysCollected: 0 });
  });
});
