import { Wallet } from "./wallet";
import { Point } from "../shared/value-objects/point";
import { Currency } from "../shared/value-objects/currency";
import { UserId } from "../shared/value-objects/user-id";
import { InsufficientPointError } from "../shared/errors";

describe("Wallet", () => {
  const userId = UserId.of(1);
  const currency = Currency.WELFARE_POINT;

  it("opens with zero balance", () => {
    const w = Wallet.openEmpty(userId, currency);
    expect(w.balance.toBigInt()).toBe(0n);
  });

  it("credit increases balance", () => {
    const w = Wallet.openEmpty(userId, currency);
    w.credit(Point.of(1000));
    expect(w.balance.toBigInt()).toBe(1000n);
  });

  it("debit decreases balance", () => {
    const w = Wallet.rehydrate(userId, currency, Point.of(1000));
    w.debit(Point.of(300));
    expect(w.balance.toBigInt()).toBe(700n);
  });

  it("debit throws InsufficientPointError when balance < amount", () => {
    const w = Wallet.rehydrate(userId, currency, Point.of(100));
    expect(() => w.debit(Point.of(101))).toThrow(InsufficientPointError);
  });
});
