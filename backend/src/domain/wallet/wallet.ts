// Wallet aggregate.
// Holds the balance for one (user, currency). All mutations go through
// debit() / credit() which enforce the Cone invariants. The aggregate
// does NOT know about persistence — adapters map this to the DB row.

import { Cone } from "../shared/value-objects/cone";
import { Currency } from "../shared/value-objects/currency";
import { UserId } from "../shared/value-objects/user-id";

export class Wallet {
  private constructor(
    readonly userId: UserId,
    readonly currency: Currency,
    private _balance: Cone,
  ) {}

  /** Reconstruct from persistence. Do NOT use to create a brand-new wallet. */
  static rehydrate(userId: UserId, currency: Currency, balance: Cone): Wallet {
    return new Wallet(userId, currency, balance);
  }

  /** Create a fresh wallet with zero balance. */
  static openEmpty(userId: UserId, currency: Currency): Wallet {
    return new Wallet(userId, currency, Cone.ZERO);
  }

  get balance(): Cone {
    return this._balance;
  }

  /** Throws InsufficientConeError if balance < amount. */
  debit(amount: Cone): void {
    this._balance = this._balance.subtract(amount);
  }

  credit(amount: Cone): void {
    this._balance = this._balance.add(amount);
  }
}
