import { Wallet } from "./wallet";
import { Cone } from "../shared/value-objects/cone";
import { Currency } from "../shared/value-objects/currency";
import { UserId } from "../shared/value-objects/user-id";
import { InsufficientConeError } from "../shared/errors";

describe("Wallet", () => {
  const userId = UserId.of(1);
  const currency = Currency.WELFARE_POINT;

  it("opens with zero balance", () => {
    const w = Wallet.openEmpty(userId, currency);
    expect(w.balance.toBigInt()).toBe(0n);
  });

  it("credit increases balance", () => {
    const w = Wallet.openEmpty(userId, currency);
    w.credit(Cone.of(1000));
    expect(w.balance.toBigInt()).toBe(1000n);
  });

  it("debit decreases balance", () => {
    const w = Wallet.rehydrate(userId, currency, Cone.of(1000));
    w.debit(Cone.of(300));
    expect(w.balance.toBigInt()).toBe(700n);
  });

  it("debit throws InsufficientConeError when balance < amount", () => {
    const w = Wallet.rehydrate(userId, currency, Cone.of(100));
    expect(() => w.debit(Cone.of(101))).toThrow(InsufficientConeError);
  });
});
