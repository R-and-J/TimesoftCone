import { Auction } from "./auction";
import { AuctionId } from "../shared/value-objects/auction-id";
import { Point } from "../shared/value-objects/point";
import { UserId } from "../shared/value-objects/user-id";
import {
  AuctionAlreadyEndedError,
  AuctionNotOpenError,
  AuctionNotReadyToSettleError,
  BidBelowMinimumError,
  BidByCurrentLeaderError,
} from "./errors";

function freshAuction(opts?: { startedAt?: Date; endsAt?: Date }) {
  return Auction.create({
    id: AuctionId.of("A-2026-106"),
    startPrice: Point.of(5000),
    minIncrement: Point.of(100),
    leaveDays: 1,
    startedAt: opts?.startedAt ?? new Date("2026-04-01T00:00:00Z"),
    endsAt: opts?.endsAt ?? new Date("2026-04-03T09:00:00Z"),
  });
}

describe("Auction.create", () => {
  it("starts in CREATED status with highest == startPrice and no bidder", () => {
    const a = freshAuction();
    const s = a.snapshot();
    expect(s.status).toBe("CREATED");
    expect(s.highest.equals(Point.of(5000))).toBe(true);
    expect(s.highestBidder).toBeNull();
    expect(s.bidCount).toBe(0);
  });

  it("rejects endsAt <= startedAt", () => {
    expect(() =>
      Auction.create({
        id: AuctionId.of("A-2026-106"),
        startPrice: Point.of(5000),
        minIncrement: Point.of(100),
        leaveDays: 1,
        startedAt: new Date("2026-04-01T00:00:00Z"),
        endsAt: new Date("2026-04-01T00:00:00Z"),
      }),
    ).toThrow();
  });
});

describe("Auction.open", () => {
  it("transitions CREATED → OPEN at or after startedAt", () => {
    const a = freshAuction();
    a.open(new Date("2026-04-01T00:00:00Z"));
    expect(a.status).toBe("OPEN");
  });

  it("rejects opening before startedAt", () => {
    const a = freshAuction();
    expect(() => a.open(new Date("2026-03-31T23:59:59Z"))).toThrow(AuctionNotOpenError);
  });

  it("is idempotent when already OPEN", () => {
    const a = freshAuction();
    a.open(new Date("2026-04-01T00:00:00Z"));
    a.open(new Date("2026-04-01T01:00:00Z"));
    expect(a.status).toBe("OPEN");
  });
});

describe("Auction.placeBid", () => {
  function openAuction() {
    const a = freshAuction();
    a.open(new Date("2026-04-01T00:00:00Z"));
    return a;
  }
  const T = new Date("2026-04-01T10:00:00Z"); // mid-auction

  it("accepts a first bid at startPrice + minIncrement", () => {
    const a = openAuction();
    const prev = a.placeBid(UserId.of(3), Point.of(5100), T);
    expect(prev).toBeNull();
    expect(a.highest.equals(Point.of(5100))).toBe(true);
    expect(a.bidCount).toBe(1);
    expect(a.highestBidder!.equals(UserId.of(3))).toBe(true);
  });

  it("returns previous leader so the use case can refund them", () => {
    const a = openAuction();
    a.placeBid(UserId.of(3), Point.of(5100), T);
    const prev = a.placeBid(UserId.of(4), Point.of(5300), T);
    expect(prev).not.toBeNull();
    expect(prev!.bidder.equals(UserId.of(3))).toBe(true);
    expect(prev!.amount.equals(Point.of(5100))).toBe(true);
  });

  it("rejects bid below highest + minIncrement", () => {
    const a = openAuction();
    a.placeBid(UserId.of(3), Point.of(5100), T);
    // highest is 5100, minIncrement is 100, so 5150 is below 5100+100=5200
    expect(() => a.placeBid(UserId.of(4), Point.of(5150), T)).toThrow(
      BidBelowMinimumError,
    );
  });

  it("rejects the current leader from bidding again", () => {
    const a = openAuction();
    a.placeBid(UserId.of(3), Point.of(5100), T);
    expect(() => a.placeBid(UserId.of(3), Point.of(5300), T)).toThrow(
      BidByCurrentLeaderError,
    );
  });

  it("rejects bid after endsAt", () => {
    const a = openAuction();
    expect(() =>
      a.placeBid(UserId.of(3), Point.of(5100), new Date("2026-04-03T10:00:00Z")),
    ).toThrow(AuctionAlreadyEndedError);
  });

  it("rejects bid when not OPEN", () => {
    const a = freshAuction();
    expect(() => a.placeBid(UserId.of(3), Point.of(5100), T)).toThrow(
      AuctionNotOpenError,
    );
  });
});

describe("Auction.settle", () => {
  function openAuction() {
    const a = freshAuction();
    a.open(new Date("2026-04-01T00:00:00Z"));
    return a;
  }

  it("AWARDED when there was a bid and time has passed", () => {
    const a = openAuction();
    a.placeBid(UserId.of(3), Point.of(5100), new Date("2026-04-01T10:00:00Z"));
    const outcome = a.settle(new Date("2026-04-03T09:00:00Z"));
    expect(outcome.kind).toBe("AWARDED");
    expect(a.status).toBe("AWARDED");
  });

  it("UNSOLD when there were no bids", () => {
    const a = openAuction();
    const outcome = a.settle(new Date("2026-04-03T09:00:00Z"));
    expect(outcome.kind).toBe("UNSOLD");
    expect(a.status).toBe("UNSOLD");
  });

  it("rejects settling before endsAt", () => {
    const a = openAuction();
    expect(() => a.settle(new Date("2026-04-02T00:00:00Z"))).toThrow(
      AuctionNotReadyToSettleError,
    );
  });

  it("rejects settling when not OPEN", () => {
    const a = freshAuction();
    expect(() => a.settle(new Date("2026-04-03T09:00:00Z"))).toThrow(
      AuctionNotReadyToSettleError,
    );
  });
});

describe("Auction.extendIfSniped (anti-snipe, CUT-5)", () => {
  const WIN = 5 * 60_000; // 5분 창
  const EXT = 5 * 60_000; // 5분 연장
  const ENDS = new Date("2026-04-03T09:00:00Z");

  function openAuction() {
    const a = freshAuction({ endsAt: ENDS });
    a.open(new Date("2026-04-01T00:00:00Z"));
    return a;
  }

  it("does not extend when the bid is well before the deadline", () => {
    const a = openAuction();
    const farBefore = new Date(ENDS.getTime() - 60 * 60_000); // 1시간 전
    expect(a.extendIfSniped(farBefore, WIN, EXT)).toBe(false);
    expect(a.endsAt.getTime()).toBe(ENDS.getTime());
  });

  it("extends to now + extendMs when a bid lands inside the window", () => {
    const a = openAuction();
    const sniped = new Date(ENDS.getTime() - 60_000); // 마감 1분 전
    expect(a.extendIfSniped(sniped, WIN, EXT)).toBe(true);
    expect(a.endsAt.getTime()).toBe(sniped.getTime() + EXT);
  });

  it("never shrinks the deadline (extend shorter than time remaining)", () => {
    const a = openAuction();
    const sniped = new Date(ENDS.getTime() - 4 * 60_000); // 창 안(4분 전)
    // extend가 2분이면 now+2분 < endsAt → 당겨질 일 없으니 연장 안 함.
    expect(a.extendIfSniped(sniped, WIN, 2 * 60_000)).toBe(false);
    expect(a.endsAt.getTime()).toBe(ENDS.getTime());
  });

  it("is disabled when windowMs <= 0", () => {
    const a = openAuction();
    const sniped = new Date(ENDS.getTime() - 60_000);
    expect(a.extendIfSniped(sniped, 0, EXT)).toBe(false);
    expect(a.endsAt.getTime()).toBe(ENDS.getTime());
  });

  it("does not extend a non-OPEN auction", () => {
    const a = freshAuction({ endsAt: ENDS }); // CREATED
    const sniped = new Date(ENDS.getTime() - 60_000);
    expect(a.extendIfSniped(sniped, WIN, EXT)).toBe(false);
  });
});
