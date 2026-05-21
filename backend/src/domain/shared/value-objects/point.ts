// ADR-015 Tier 1 Value Object — Point.
// Invariants: non-negative integer. Domain code does Point.subtract(other),
// which throws InsufficientPointError rather than silently returning negative.

import { InsufficientPointError, InvalidPointError } from "../errors";

export class Point {
  private constructor(private readonly amount: bigint) {}

  static of(value: bigint | number | string): Point {
    let v: bigint;
    try {
      v = typeof value === "bigint" ? value : BigInt(value);
    } catch {
      throw new InvalidPointError(`Point must be an integer: got ${String(value)}`);
    }
    if (v < 0n) {
      throw new InvalidPointError(`Point cannot be negative: got ${v}`);
    }
    return new Point(v);
  }

  static readonly ZERO = Point.of(0n);

  add(other: Point): Point {
    return Point.of(this.amount + other.amount);
  }

  subtract(other: Point): Point {
    if (this.amount < other.amount) {
      throw new InsufficientPointError(this.amount, other.amount);
    }
    return Point.of(this.amount - other.amount);
  }

  isZero(): boolean {
    return this.amount === 0n;
  }

  greaterThan(other: Point): boolean {
    return this.amount > other.amount;
  }

  lessThanOrEqual(other: Point): boolean {
    return this.amount <= other.amount;
  }

  equals(other: Point): boolean {
    return this.amount === other.amount;
  }

  toBigInt(): bigint {
    return this.amount;
  }

  toString(): string {
    return this.amount.toString();
  }
}
