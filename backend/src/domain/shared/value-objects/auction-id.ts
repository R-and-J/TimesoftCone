// ADR-015 Tier 1 — AuctionId. Human-readable string in the form "A-YYYY-NNN".
// Matches the design canvas mock data and is intentionally NOT autoincrement
// so seeds, screenshots, and code share the same IDs.

import { DomainError } from "../errors";

const AUCTION_ID_PATTERN = /^A-\d{4}-\d{3,}$/;

export class InvalidAuctionIdError extends DomainError {}

export class AuctionId {
  private constructor(readonly value: string) {}

  static of(value: string): AuctionId {
    if (typeof value !== "string" || !AUCTION_ID_PATTERN.test(value)) {
      throw new InvalidAuctionIdError(
        `AuctionId must match A-YYYY-NNN, got: ${String(value)}`,
      );
    }
    return new AuctionId(value);
  }

  equals(other: AuctionId): boolean {
    return this.value === other.value;
  }

  toString(): string {
    return this.value;
  }
}
