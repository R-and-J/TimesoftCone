import { DomainError } from "../shared/errors";

export class AuctionNotOpenError extends DomainError {}
export class AuctionAlreadyEndedError extends DomainError {}
export class BidBelowMinimumError extends DomainError {}
export class BidByCurrentLeaderError extends DomainError {}
export class AuctionNotReadyToSettleError extends DomainError {}
