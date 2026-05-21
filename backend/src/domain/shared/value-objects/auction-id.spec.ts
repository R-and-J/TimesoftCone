import { AuctionId, InvalidAuctionIdError } from "./auction-id";

describe("AuctionId", () => {
  it("accepts the A-YYYY-NNN format", () => {
    expect(AuctionId.of("A-2026-106").toString()).toBe("A-2026-106");
    expect(AuctionId.of("A-2030-9999").toString()).toBe("A-2030-9999");
  });

  it("rejects malformed IDs", () => {
    expect(() => AuctionId.of("106")).toThrow(InvalidAuctionIdError);
    expect(() => AuctionId.of("A-2026")).toThrow(InvalidAuctionIdError);
    expect(() => AuctionId.of("a-2026-106")).toThrow(InvalidAuctionIdError);
    expect(() => AuctionId.of("")).toThrow(InvalidAuctionIdError);
  });

  it("equals compares by value", () => {
    expect(AuctionId.of("A-2026-106").equals(AuctionId.of("A-2026-106"))).toBe(true);
    expect(AuctionId.of("A-2026-106").equals(AuctionId.of("A-2026-107"))).toBe(false);
  });
});
