import { UserId } from "./user-id";
import { InvalidUserIdError } from "../errors";

describe("UserId", () => {
  it("accepts positive integers", () => {
    expect(UserId.of(1).toBigInt()).toBe(1n);
    expect(UserId.of("42").toBigInt()).toBe(42n);
  });

  it("rejects 0, negative, and non-integer input", () => {
    expect(() => UserId.of(0)).toThrow(InvalidUserIdError);
    expect(() => UserId.of(-3)).toThrow(InvalidUserIdError);
    expect(() => UserId.of("not-a-number")).toThrow(InvalidUserIdError);
  });

  it("equals compares by value", () => {
    expect(UserId.of(7).equals(UserId.of(7))).toBe(true);
    expect(UserId.of(7).equals(UserId.of(8))).toBe(false);
  });
});
