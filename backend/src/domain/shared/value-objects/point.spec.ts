import { Point } from "./point";
import {
  InvalidPointError,
  InsufficientPointError,
} from "../errors";

describe("Point", () => {
  describe("of", () => {
    it("accepts non-negative integers", () => {
      expect(Point.of(0).toBigInt()).toBe(0n);
      expect(Point.of(1).toBigInt()).toBe(1n);
      expect(Point.of(123456789n).toBigInt()).toBe(123456789n);
    });

    it("rejects negative values", () => {
      expect(() => Point.of(-1)).toThrow(InvalidPointError);
      expect(() => Point.of(-100n)).toThrow(InvalidPointError);
    });

    it("rejects non-integer / non-numeric input", () => {
      expect(() => Point.of("abc")).toThrow(InvalidPointError);
    });
  });

  describe("arithmetic", () => {
    it("add returns a new Point", () => {
      const result = Point.of(100).add(Point.of(50));
      expect(result.toBigInt()).toBe(150n);
    });

    it("subtract throws InsufficientPointError when balance < amount", () => {
      expect(() => Point.of(100).subtract(Point.of(101))).toThrow(
        InsufficientPointError,
      );
    });

    it("subtract returns a new Point on success", () => {
      const result = Point.of(100).subtract(Point.of(60));
      expect(result.toBigInt()).toBe(40n);
    });
  });

  it("ZERO is reusable", () => {
    expect(Point.ZERO.isZero()).toBe(true);
    expect(Point.ZERO.add(Point.of(5)).toBigInt()).toBe(5n);
  });
});
