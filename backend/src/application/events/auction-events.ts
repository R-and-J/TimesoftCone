// 도메인 이벤트 (ADR-013). Use Case가 트랜잭션 커밋 후 발행하고, 구독자(Observer)가
// 받아 부수효과(알림/메트릭/감사/WebSocket…)를 처리한다. Use Case는 구독자를 모른다.
// 이벤트는 application 계층 객체 — 도메인 순수성(domain/ 외부의존 0)을 깨지 않는다.

export const AUCTION_EVENTS = {
  BID_PLACED: "auction.bid_placed",
  WON: "auction.won",
  INVENTORY_CREATED: "auction.inventory_created",
} as const;

/** 입찰이 수락됨. previousHighBidderId가 있으면 그 사람은 "밀린" 것. */
export class BidPlacedEvent {
  constructor(
    public readonly auctionId: string,
    public readonly bidderId: bigint,
    public readonly amount: bigint,
    public readonly previousHighBidderId: bigint | null,
    public readonly previousHighAmount: bigint | null,
  ) {}
}

/** 경매가 낙찰됨. */
export class AuctionWonEvent {
  constructor(
    public readonly auctionId: string,
    public readonly winnerId: bigint,
    public readonly amount: bigint,
    public readonly leaveDays: number,
  ) {}
}

/** 연말 풀 수집으로 익년도 경매 인벤토리가 생성됨 (ADR-017). */
export class AuctionInventoryCreatedEvent {
  constructor(
    public readonly targetYear: number,
    public readonly auctionsCreated: number,
    public readonly contributorCount: number,
  ) {}
}
