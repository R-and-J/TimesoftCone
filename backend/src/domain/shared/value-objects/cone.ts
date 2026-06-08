// ADR-015 Tier 1 Value Object — Cone.
// Invariants: non-negative integer. Domain code does Cone.subtract(other),
// which throws InsufficientConeError rather than silently returning negative.

import { InsufficientConeError, InvalidConeError } from "../errors";

export class Cone {
  private constructor(private readonly amount: bigint) {}

  static of(value: bigint | number | string): Cone {
    let v: bigint;
    try {
      v = typeof value === "bigint" ? value : BigInt(value);
    } catch {
      throw new InvalidConeError(`Cone must be an integer: got ${String(value)}`);
    }
    if (v < 0n) {
      throw new InvalidConeError(`Cone cannot be negative: got ${v}`);
    }
    return new Cone(v);
  }

  static readonly ZERO = Cone.of(0n);

  add(other: Cone): Cone {
    return Cone.of(this.amount + other.amount);
  }

  subtract(other: Cone): Cone {
    if (this.amount < other.amount) {
      throw new InsufficientConeError(this.amount, other.amount);
    }
    return Cone.of(this.amount - other.amount);
  }

  isZero(): boolean {
    return this.amount === 0n;
  }

  greaterThan(other: Cone): boolean {
    return this.amount > other.amount;
  }

  lessThanOrEqual(other: Cone): boolean {
    return this.amount <= other.amount;
  }

  equals(other: Cone): boolean {
    return this.amount === other.amount;
  }

  toBigInt(): bigint {
    return this.amount;
  }

  toString(): string {
    return this.amount.toString();
  }
}
