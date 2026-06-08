import { Cone } from "./cone";
import {
  InvalidConeError,
  InsufficientConeError,
} from "../errors";

describe("Cone", () => {
  describe("of", () => {
    it("accepts non-negative integers", () => {
      expect(Cone.of(0).toBigInt()).toBe(0n);
      expect(Cone.of(1).toBigInt()).toBe(1n);
      expect(Cone.of(123456789n).toBigInt()).toBe(123456789n);
    });

    it("rejects negative values", () => {
      expect(() => Cone.of(-1)).toThrow(InvalidConeError);
      expect(() => Cone.of(-100n)).toThrow(InvalidConeError);
    });

    it("rejects non-integer / non-numeric input", () => {
      expect(() => Cone.of("abc")).toThrow(InvalidConeError);
    });
  });

  describe("arithmetic", () => {
    it("add returns a new Cone", () => {
      const result = Cone.of(100).add(Cone.of(50));
      expect(result.toBigInt()).toBe(150n);
    });

    it("subtract throws InsufficientConeError when balance < amount", () => {
      expect(() => Cone.of(100).subtract(Cone.of(101))).toThrow(
        InsufficientConeError,
      );
    });

    it("subtract returns a new Cone on success", () => {
      const result = Cone.of(100).subtract(Cone.of(60));
      expect(result.toBigInt()).toBe(40n);
    });
  });

  it("ZERO is reusable", () => {
    expect(Cone.ZERO.isZero()).toBe(true);
    expect(Cone.ZERO.add(Cone.of(5)).toBigInt()).toBe(5n);
  });
});
