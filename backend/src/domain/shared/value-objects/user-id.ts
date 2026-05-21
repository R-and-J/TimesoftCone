// ADR-015 Tier 1 Value Object — UserId.
// Wraps a bigint; the static factory enforces > 0.

import { InvalidUserIdError } from "../errors";

export class UserId {
  private constructor(private readonly value: bigint) {}

  static of(value: bigint | number | string): UserId {
    let v: bigint;
    try {
      v = typeof value === "bigint" ? value : BigInt(value);
    } catch {
      throw new InvalidUserIdError(`UserId must be an integer: got ${String(value)}`);
    }
    if (v <= 0n) {
      throw new InvalidUserIdError(`UserId must be positive: got ${v}`);
    }
    return new UserId(v);
  }

  toBigInt(): bigint {
    return this.value;
  }

  toString(): string {
    return this.value.toString();
  }

  equals(other: UserId): boolean {
    return this.value === other.value;
  }
}
