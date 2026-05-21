// Domain errors. Subclass Error so they cross test boundaries cleanly.
// No framework imports here — these must be safe to throw from anywhere in domain/.

export class DomainError extends Error {
  constructor(message: string) {
    super(message);
    this.name = this.constructor.name;
  }
}

export class InvalidPointError extends DomainError {}
export class InsufficientPointError extends DomainError {
  constructor(balance: bigint, requested: bigint) {
    super(
      `Insufficient balance: have ${balance}, requested ${requested}`,
    );
  }
}
export class InvalidUserIdError extends DomainError {}
export class UnknownCurrencyError extends DomainError {}
