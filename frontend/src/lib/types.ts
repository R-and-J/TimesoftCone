export type User = {
  id: number;
  name: string;
  emp: string;
  role: "ADMIN" | "EZPASS_ADMIN" | "EXAM_ADMIN" | "EZPASS" | "EXAM";
  team: string;
  wallet: number;
  stake_ratio: number;
  contributed_days: number;
};

export type AuctionStatus = "CREATED" | "OPEN" | "AWARDED" | "UNSOLD";

export type Auction = {
  id: string;
  status: AuctionStatus;
  startPrice: number;
  highest: number;
  prevHighest?: number;
  bids: number;
  bidders: number;
  my?: boolean;
  end?: string;
  endLabel: string;
  leftBids?: number;
  hot?: boolean;
  winner?: string;
};

export type Bid = { user: string; amount: number; t: string; mine: boolean };

export type FeaturedAuction = {
  id: string;
  title: string;
  status: "OPEN";
  startPrice: number;
  highest: number;
  prevHighest: number;
  bids: number;
  bidders: number;
  startedAt: string;
  endsAt: string;
  myBalance: number;
  minIncrement: number;
  recentBids: Bid[];
};

export type Stake = { name: string; days: number; ratio: number; isMe?: boolean };

export type LedgerEntry = {
  t: string;
  user: string;
  auction: string;
  type: "BID" | "REFUND" | "WIN" | "CREDIT_ADMIN" | "DIVIDEND" | "EXPIRE";
  amount: number;
  balance: number;
  note?: string;
};

export type TeamMember = { id: number; name: string; team: string };
