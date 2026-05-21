import type {
  Auction,
  FeaturedAuction,
  LedgerEntry,
  Stake,
  TeamMember,
  User,
} from "./types";

export const ME: User = {
  id: 1,
  name: "김기철",
  emp: "TS-2024-018",
  role: "EMPLOYEE",
  team: "서비스플랫폼팀",
  wallet: 12450,
  stake_ratio: 0.087,
  contributed_days: 6,
};

export const TEAM: TeamMember[] = [
  { id: 1, name: "김기철", team: "서비스플랫폼" },
  { id: 2, name: "오지석", team: "서비스플랫폼" },
  { id: 3, name: "이도현", team: "백엔드" },
  { id: 4, name: "박서연", team: "인사" },
  { id: 5, name: "정민우", team: "디자인" },
  { id: 6, name: "한지윤", team: "QA" },
  { id: 7, name: "최예나", team: "백엔드" },
  { id: 8, name: "강태오", team: "인프라" },
  { id: 9, name: "윤소희", team: "프론트엔드" },
  { id: 10, name: "서민재", team: "PM" },
];

export const AUCTIONS: Auction[] = [
  { id: "A-2026-104", status: "OPEN", highest: 8400, bids: 23, my: false, bidders: 8, end: "+02:14:38", endLabel: "오늘 18:00 마감", startPrice: 5000, leftBids: 7 },
  { id: "A-2026-105", status: "OPEN", highest: 6200, bids: 12, my: true, bidders: 5, end: "+11:32:09", endLabel: "내일 09:30 마감", startPrice: 5000, leftBids: 3 },
  { id: "A-2026-106", status: "OPEN", highest: 9100, bids: 41, my: false, bidders: 14, end: "+00:08:47", endLabel: "곧 마감", startPrice: 5000, leftBids: 12, hot: true },
  { id: "A-2026-107", status: "OPEN", highest: 5300, bids: 4, my: false, bidders: 3, end: "+1d 04h", endLabel: "내일 14:00 마감", startPrice: 5000, leftBids: 1 },
  { id: "A-2026-108", status: "CREATED", highest: 5000, bids: 0, my: false, bidders: 0, end: "오픈 예정", endLabel: "4/3 (수) 09:00 오픈", startPrice: 5000, leftBids: 0 },
  { id: "A-2026-109", status: "CREATED", highest: 5000, bids: 0, my: false, bidders: 0, end: "오픈 예정", endLabel: "4/3 (수) 09:00 오픈", startPrice: 5000, leftBids: 0 },
  { id: "A-2026-103", status: "AWARDED", highest: 7800, bids: 18, my: true, bidders: 0, winner: "김기철", end: "마감됨", endLabel: "어제 18:00 낙찰", startPrice: 5000, leftBids: 0 },
  { id: "A-2026-102", status: "AWARDED", highest: 9400, bids: 27, my: false, bidders: 0, winner: "이도현", end: "마감됨", endLabel: "4/1 (월) 낙찰", startPrice: 5000, leftBids: 0 },
  { id: "A-2026-101", status: "UNSOLD", highest: 0, bids: 0, my: false, bidders: 0, end: "유찰됨", endLabel: "3/31 유찰", startPrice: 5000, leftBids: 0 },
];

export const FEATURED: FeaturedAuction = {
  id: "A-2026-106",
  title: "연차 1일권 #106",
  status: "OPEN",
  startPrice: 5000,
  highest: 9100,
  prevHighest: 8900,
  bids: 41,
  bidders: 14,
  startedAt: "2026-04-01 09:00",
  endsAt: "2026-04-03 18:00",
  myBalance: 12450,
  minIncrement: 100,
  recentBids: [
    { user: "이도현", amount: 9100, t: "방금", mine: false },
    { user: "한지윤", amount: 8900, t: "12초 전", mine: false },
    { user: "김기철", amount: 8700, t: "38초 전", mine: true },
    { user: "정민우", amount: 8500, t: "1분 전", mine: false },
    { user: "이도현", amount: 8400, t: "1분 전", mine: false },
    { user: "최예나", amount: 8200, t: "2분 전", mine: false },
    { user: "김기철", amount: 8000, t: "2분 전", mine: true },
    { user: "윤소희", amount: 7800, t: "3분 전", mine: false },
    { user: "강태오", amount: 7600, t: "5분 전", mine: false },
    { user: "한지윤", amount: 7400, t: "6분 전", mine: false },
    { user: "이도현", amount: 7200, t: "8분 전", mine: false },
    { user: "서민재", amount: 7000, t: "10분 전", mine: false },
  ],
};

export const STAKES: Stake[] = [
  { name: "강태오", days: 14, ratio: 0.203 },
  { name: "이도현", days: 11, ratio: 0.159 },
  { name: "최예나", days: 9, ratio: 0.130 },
  { name: "박서연", days: 8, ratio: 0.116 },
  { name: "김기철", days: 6, ratio: 0.087, isMe: true },
  { name: "한지윤", days: 5, ratio: 0.072 },
  { name: "오지석", days: 4, ratio: 0.058 },
  { name: "윤소희", days: 4, ratio: 0.058 },
  { name: "정민우", days: 3, ratio: 0.043 },
  { name: "기타 외 18명", days: 5, ratio: 0.074 },
];

export const LEDGER: LedgerEntry[] = [
  { t: "14:32:08", user: "이도현", auction: "A-2026-106", type: "BID", amount: -9100, balance: 1284000 },
  { t: "14:32:08", user: "한지윤", auction: "A-2026-106", type: "REFUND", amount: 8900, balance: 1275100 },
  { t: "14:31:56", user: "한지윤", auction: "A-2026-106", type: "BID", amount: -8900, balance: 1284000 },
  { t: "14:31:56", user: "김기철", auction: "A-2026-106", type: "REFUND", amount: 8700, balance: 1275100 },
  { t: "14:31:30", user: "김기철", auction: "A-2026-106", type: "BID", amount: -8700, balance: 1283800 },
  { t: "14:31:30", user: "정민우", auction: "A-2026-106", type: "REFUND", amount: 8500, balance: 1275100 },
  { t: "14:30:14", user: "정민우", auction: "A-2026-106", type: "BID", amount: -8500, balance: 1283600 },
  { t: "14:29:48", user: "시스템", auction: "A-2026-105", type: "WIN", amount: 0, balance: 1275100, note: "낙찰 확정" },
  { t: "14:29:48", user: "박서연", auction: "A-2026-105", type: "BID", amount: -6200, balance: 1275100 },
  { t: "14:18:02", user: "admin/박부장", auction: "—", type: "CREDIT_ADMIN", amount: 50000, balance: 1268900, note: "1Q 인센티브 적립" },
];

export const TICKER = [
  "이도현님이 #106 경매에 9,100P 입찰했습니다",
  "#103 경매가 7,800P로 김기철님께 낙찰되었습니다",
  "#107 경매가 9시간 후 마감됩니다",
  "강태오님이 #106 경매에 5,300P 입찰했습니다",
];
