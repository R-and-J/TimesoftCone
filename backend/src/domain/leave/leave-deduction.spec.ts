import { InsufficientLeaveError, planLeaveDeduction } from "./leave-deduction";

describe("planLeaveDeduction (FR-3.1 우선순위)", () => {
  it("takes from AUCTION first when enough", () => {
    expect(planLeaveDeduction({ AUCTION: 5, EVENT: 2, REGULAR: 10 }, 3)).toEqual({
      AUCTION: 3,
      EVENT: 0,
      REGULAR: 0,
    });
  });

  it("falls back to EVENT when AUCTION is exhausted", () => {
    expect(planLeaveDeduction({ AUCTION: 2, EVENT: 5, REGULAR: 10 }, 4)).toEqual({
      AUCTION: 2,
      EVENT: 2,
      REGULAR: 0,
    });
  });

  it("falls back to REGULAR only after AUCTION + EVENT are exhausted", () => {
    expect(planLeaveDeduction({ AUCTION: 1, EVENT: 1, REGULAR: 10 }, 5)).toEqual({
      AUCTION: 1,
      EVENT: 1,
      REGULAR: 3,
    });
  });

  it("skips empty buckets and consumes from the next available", () => {
    expect(planLeaveDeduction({ AUCTION: 0, EVENT: 0, REGULAR: 7 }, 4)).toEqual({
      AUCTION: 0,
      EVENT: 0,
      REGULAR: 4,
    });
  });

  it("throws InsufficientLeaveError when total remaining < requested", () => {
    expect(() =>
      planLeaveDeduction({ AUCTION: 1, EVENT: 1, REGULAR: 1 }, 5),
    ).toThrow(InsufficientLeaveError);
  });

  it("rejects non-positive integer days", () => {
    expect(() => planLeaveDeduction({ AUCTION: 5, EVENT: 0, REGULAR: 0 }, 0)).toThrow();
    expect(() => planLeaveDeduction({ AUCTION: 5, EVENT: 0, REGULAR: 0 }, -1)).toThrow();
    expect(() => planLeaveDeduction({ AUCTION: 5, EVENT: 0, REGULAR: 0 }, 1.5)).toThrow();
  });
});
