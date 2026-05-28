// Auction aggregate.
//
// Design notes:
// - Status transitions are guarded by methods on this class. Use cases and
//   adapters MUST NOT branch on .status — they call placeBid/settle/open and
//   handle the thrown domain error if invalid (CLAUDE.md structural invariant 11
//   "Auction state via State pattern" — see scope-cuts.md CUT-3 for the
//   pragmatic simplification we adopted instead).
// - All mutations return PURE data (PreviousBidder, SettleOutcome) so the
//   use case can compose the wallet/ledger side-effects in the same
//   transaction without re-reading the aggregate.

import { AuctionId } from "../shared/value-objects/auction-id";
import { Point } from "../shared/value-objects/point";
import { UserId } from "../shared/value-objects/user-id";
import type { AuctionStatus } from "./auction-status";
import {
  AuctionAlreadyEndedError,
  AuctionNotOpenError,
  AuctionNotReadyToSettleError,
  BidBelowMinimumError,
  BidByCurrentLeaderError,
} from "./errors";

export type AuctionSnapshot = {
  id: AuctionId;
  status: AuctionStatus;
  startPrice: Point;
  highest: Point;
  highestBidder: UserId | null;
  bidCount: number;
  minIncrement: Point;
  /** 이 경매가 낙찰자에게 부여하는 AUCTION 연차 일수 (ADR-002/CUT-9). */
  leaveDays: number;
  startedAt: Date;
  endsAt: Date;
  settledAt: Date | null;
};

export type PreviousLeader = {
  bidder: UserId;
  amount: Point;
} | null;

export type SettleOutcome =
  | { kind: "AWARDED"; winner: UserId; amount: Point }
  | { kind: "UNSOLD" };

export class Auction {
  private constructor(
    readonly id: AuctionId,
    private _status: AuctionStatus,
    readonly startPrice: Point,
    private _highest: Point,
    private _highestBidder: UserId | null,
    private _bidCount: number,
    readonly minIncrement: Point,
    readonly startedAt: Date,
    private _endsAt: Date,
    private _settledAt: Date | null,
    /** 낙찰자에게 부여할 AUCTION 연차 일수. */
    readonly leaveDays: number,
  ) {}

  static create(props: {
    id: AuctionId;
    startPrice: Point;
    minIncrement: Point;
    startedAt: Date;
    endsAt: Date;
    leaveDays: number;
  }): Auction {
    if (props.endsAt <= props.startedAt) {
      throw new Error("endsAt must be strictly after startedAt");
    }
    if (props.minIncrement.isZero()) {
      throw new Error("minIncrement must be positive");
    }
    if (!Number.isInteger(props.leaveDays) || props.leaveDays < 1) {
      throw new Error("leaveDays must be a positive integer");
    }
    return new Auction(
      props.id,
      "CREATED",
      props.startPrice,
      props.startPrice, // highest starts at startPrice
      null,
      0,
      props.minIncrement,
      props.startedAt,
      props.endsAt,
      null,
      props.leaveDays,
    );
  }

  static rehydrate(s: AuctionSnapshot): Auction {
    return new Auction(
      s.id,
      s.status,
      s.startPrice,
      s.highest,
      s.highestBidder,
      s.bidCount,
      s.minIncrement,
      s.startedAt,
      s.endsAt,
      s.settledAt,
      s.leaveDays,
    );
  }

  // ── getters ───────────────────────────────────────────────────────
  get status(): AuctionStatus { return this._status; }
  get highest(): Point { return this._highest; }
  get highestBidder(): UserId | null { return this._highestBidder; }
  get bidCount(): number { return this._bidCount; }
  get endsAt(): Date { return this._endsAt; }
  get settledAt(): Date | null { return this._settledAt; }

  snapshot(): AuctionSnapshot {
    return {
      id: this.id,
      status: this._status,
      startPrice: this.startPrice,
      highest: this._highest,
      highestBidder: this._highestBidder,
      bidCount: this._bidCount,
      minIncrement: this.minIncrement,
      leaveDays: this.leaveDays,
      startedAt: this.startedAt,
      endsAt: this.endsAt,
      settledAt: this._settledAt,
    };
  }

  // ── transitions ───────────────────────────────────────────────────

  /** CREATED → OPEN. Idempotent: re-opening an already-OPEN auction is a noop. */
  open(now: Date): void {
    if (this._status === "OPEN") return;
    if (this._status !== "CREATED") {
      throw new AuctionNotOpenError(
        `Cannot open auction in status ${this._status}`,
      );
    }
    if (now < this.startedAt) {
      // CREATED but before scheduled start — allow forcing open via admin
      // path in a later PR. For now, reject.
      throw new AuctionNotOpenError(
        `Auction scheduled for ${this.startedAt.toISOString()}, cannot open at ${now.toISOString()}`,
      );
    }
    this._status = "OPEN";
  }

  /**
   * Apply a bid. Returns the previous leader (if any) so the caller can issue
   * a REFUND in the same transaction.
   *
   * Throws if the auction is not OPEN, time has expired, the bid is too low,
   * or the same user is already the current leader.
   */
  placeBid(bidder: UserId, amount: Point, now: Date): PreviousLeader {
    if (this._status !== "OPEN") {
      throw new AuctionNotOpenError(
        `Auction status is ${this._status}, not OPEN`,
      );
    }
    if (now >= this.endsAt) {
      throw new AuctionAlreadyEndedError(
        `Auction ended at ${this.endsAt.toISOString()}`,
      );
    }
    if (this._highestBidder !== null && this._highestBidder.equals(bidder)) {
      throw new BidByCurrentLeaderError(
        "You are already the highest bidder",
      );
    }

    // Bid must be >= highest + minIncrement.
    // (When there are no bids yet, highest == startPrice, so the first bid
    // must be >= startPrice + minIncrement. That's intentional — startPrice
    // is the *floor*, not a valid bid.)
    const minNext = this._highest.add(this.minIncrement);
    if (amount.lessThanOrEqual(this._highest) || amount.toBigInt() < minNext.toBigInt()) {
      throw new BidBelowMinimumError(
        `Bid ${amount} must be >= ${minNext} (highest ${this._highest} + minIncrement ${this.minIncrement})`,
      );
    }

    const previous: PreviousLeader =
      this._highestBidder !== null
        ? { bidder: this._highestBidder, amount: this._highest }
        : null;

    this._highest = amount;
    this._highestBidder = bidder;
    this._bidCount += 1;
    return previous;
  }

  /**
   * Anti-snipe (scope-cuts.md CUT-5): if a bid lands within `windowMs` of the
   * deadline, push `endsAt` out so there's always at least `extendMs` left —
   * preventing last-second snipes from denying others a counter-bid.
   *
   * Call this right after a successful placeBid, inside the same transaction.
   * Returns true if the deadline was extended (so the caller can persist it /
   * surface it). `windowMs <= 0` disables the feature. Only OPEN auctions
   * extend (status-transition logic stays in the aggregate, invariant #11).
   */
  extendIfSniped(now: Date, windowMs: number, extendMs: number): boolean {
    if (windowMs <= 0 || extendMs <= 0) return false;
    if (this._status !== "OPEN") return false;
    const remainingMs = this._endsAt.getTime() - now.getTime();
    if (remainingMs > windowMs) return false; // not in the snipe window

    // Reset the clock to `extendMs` from the bid moment, but never shrink it.
    const candidate = now.getTime() + extendMs;
    if (candidate <= this._endsAt.getTime()) return false;
    this._endsAt = new Date(candidate);
    return true;
  }

  /**
   * OPEN → AWARDED (if there was a bid) or UNSOLD (if no bids).
   * Caller must wait until now >= endsAt.
   */
  settle(now: Date): SettleOutcome {
    if (this._status !== "OPEN") {
      throw new AuctionNotReadyToSettleError(
        `Cannot settle auction in status ${this._status}`,
      );
    }
    if (now < this.endsAt) {
      throw new AuctionNotReadyToSettleError(
        `Cannot settle before endsAt ${this.endsAt.toISOString()}`,
      );
    }

    this._settledAt = now;
    if (this._highestBidder === null) {
      this._status = "UNSOLD";
      return { kind: "UNSOLD" };
    }
    this._status = "AWARDED";
    return {
      kind: "AWARDED",
      winner: this._highestBidder,
      amount: this._highest,
    };
  }
}
