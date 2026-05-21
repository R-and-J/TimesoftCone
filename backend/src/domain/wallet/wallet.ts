// Wallet aggregate.
// Holds the balance for one (user, currency). All mutations go through
// debit() / credit() which enforce the Point invariants. The aggregate
// does NOT know about persistence — adapters map this to the DB row.

import { Point } from "../shared/value-objects/point";
import { Currency } from "../shared/value-objects/currency";
import { UserId } from "../shared/value-objects/user-id";

export class Wallet {
  private constructor(
    readonly userId: UserId,
    readonly currency: Currency,
    private _balance: Point,
  ) {}

  /** Reconstruct from persistence. Do NOT use to create a brand-new wallet. */
  static rehydrate(userId: UserId, currency: Currency, balance: Point): Wallet {
    return new Wallet(userId, currency, balance);
  }

  /** Create a fresh wallet with zero balance. */
  static openEmpty(userId: UserId, currency: Currency): Wallet {
    return new Wallet(userId, currency, Point.ZERO);
  }

  get balance(): Point {
    return this._balance;
  }

  /** Throws InsufficientPointError if balance < amount. */
  debit(amount: Point): void {
    this._balance = this._balance.subtract(amount);
  }

  credit(amount: Point): void {
    this._balance = this._balance.add(amount);
  }
}
