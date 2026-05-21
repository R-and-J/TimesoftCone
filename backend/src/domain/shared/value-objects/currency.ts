// ADR-010 — Currency is a typed enum at the domain boundary.
// New currencies are added by registering a new code here AND introducing
// a new BiddingCurrency / PayoutChannel implementation in adapters/.
// The domain never branches on the value; it just passes it through.

import { UnknownCurrencyError } from "../errors";

export const CURRENCIES = ["WELFARE_POINT"] as const;
export type CurrencyCode = (typeof CURRENCIES)[number];

export class Currency {
  private constructor(readonly code: CurrencyCode) {}

  static of(value: string): Currency {
    if (!(CURRENCIES as readonly string[]).includes(value)) {
      throw new UnknownCurrencyError(`Unknown currency: ${value}`);
    }
    return new Currency(value as CurrencyCode);
  }

  static readonly WELFARE_POINT = Currency.of("WELFARE_POINT");

  equals(other: Currency): boolean {
    return this.code === other.code;
  }

  toString(): string {
    return this.code;
  }
}
