// Dev seed — users + initial wallet balances + auctions.
// IDs match the frontend mock data so the design canvas and backend agree.
//
// IMPORTANT: auction endsAt values are relative to "now" so the SettleDue
// scheduler always has fresh work after re-seeding. Re-running this script
// resets the auctions back to their initial (no-bid) state — DON'T run it
// in the middle of a demo unless you want a clean slate.

import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

// contributedDays drives dividend stake (GET /api/dividend/me/:userId).
// regular/auction/event leave days drive the leave-balance cards on
// Dashboard and MyActivity (ADR-002 three-flag). Values mirror the original
// design mock so the cards look the same.
const USERS = [
  { empId: "TS-2024-001", name: "김기철", team: "서비스플랫폼", role: "EMPLOYEE" as const, seedAmount: 50000n, contributedDays: 6,  regular: 12, auction: 3, event: 1 },
  { empId: "TS-2024-002", name: "오지석", team: "서비스플랫폼", role: "EMPLOYEE" as const, seedAmount: 30000n, contributedDays: 4,  regular: 13, auction: 1, event: 0 },
  { empId: "TS-2024-003", name: "이도현", team: "백엔드",       role: "EMPLOYEE" as const, seedAmount: 80000n, contributedDays: 11, regular: 10, auction: 5, event: 1 },
  { empId: "TS-2024-004", name: "박서연", team: "인사",         role: "EMPLOYEE" as const, seedAmount: 40000n, contributedDays: 8,  regular: 11, auction: 2, event: 1 },
  { empId: "TS-2024-005", name: "정민우", team: "디자인",       role: "EMPLOYEE" as const, seedAmount: 20000n, contributedDays: 3,  regular: 14, auction: 0, event: 0 },
  { empId: "TS-2024-006", name: "한지윤", team: "QA",           role: "EMPLOYEE" as const, seedAmount: 20000n, contributedDays: 5,  regular: 12, auction: 1, event: 0 },
  { empId: "TS-2024-007", name: "최예나", team: "백엔드",       role: "EMPLOYEE" as const, seedAmount: 25000n, contributedDays: 9,  regular: 11, auction: 4, event: 0 },
  { empId: "TS-2024-008", name: "강태오", team: "인프라",       role: "EMPLOYEE" as const, seedAmount: 25000n, contributedDays: 14, regular: 9,  auction: 6, event: 1 },
  { empId: "TS-2024-099", name: "박부장", team: "운영",         role: "ADMIN"    as const, seedAmount: 0n,     contributedDays: 0,  regular: 15, auction: 0, event: 0 },
];

const MIN = 60_000;
const HR = 60 * MIN;
const DAY = 24 * HR;

function makeAuctions(now: Date) {
  const t = now.getTime();
  return [
    // OPEN: endsAt in the near future so the scheduler eventually auto-settles them.
    // A-2026-104 is the "watch the cron settle me" candidate (~2 min).
    { id: "A-2026-104", status: "OPEN" as const,    startedAt: new Date(t - 1 * HR),   endsAt: new Date(t + 2 * MIN),   startPrice: 5000n, leaveDays: 1 },
    { id: "A-2026-105", status: "OPEN" as const,    startedAt: new Date(t - 1 * HR),   endsAt: new Date(t + 30 * MIN),  startPrice: 5000n, leaveDays: 2 },
    { id: "A-2026-106", status: "OPEN" as const,    startedAt: new Date(t - 1 * HR),   endsAt: new Date(t + 2 * HR),    startPrice: 5000n, leaveDays: 3 },
    { id: "A-2026-107", status: "OPEN" as const,    startedAt: new Date(t - 1 * HR),   endsAt: new Date(t + 1 * DAY),   startPrice: 5000n, leaveDays: 1 },
    // CREATED: opens later, ends much later. Shown as "오픈 예정".
    { id: "A-2026-108", status: "CREATED" as const, startedAt: new Date(t + 30 * MIN), endsAt: new Date(t + 6 * HR),    startPrice: 5000n, leaveDays: 2 },
    { id: "A-2026-109", status: "CREATED" as const, startedAt: new Date(t + 1 * DAY),  endsAt: new Date(t + 3 * DAY),   startPrice: 5000n, leaveDays: 3 },
  ];
}

async function main() {
  console.log("== Users + wallets ==");
  for (const u of USERS) {
    const user = await prisma.user.upsert({
      where: { empId: u.empId },
      update: { contributedDays: u.contributedDays },
      create: {
        empId: u.empId,
        name: u.name,
        team: u.team,
        role: u.role,
        contributedDays: u.contributedDays,
      },
    });

    // Leave balances (ADR-016 leave master). REGULAR -> granted; AUCTION/EVENT -> adjusted.
    const SEED_YEAR = 2026;
    const leaveRows = [
      { leaveType: "REGULAR" as const, grantedDays: u.regular, adjustedDays: 0 },
      { leaveType: "AUCTION" as const, grantedDays: 0, adjustedDays: u.auction },
      { leaveType: "EVENT" as const, grantedDays: 0, adjustedDays: u.event },
    ];
    for (const lr of leaveRows) {
      await prisma.leaveBalance.upsert({
        where: {
          uq_leave_user_year_type: { userId: user.id, year: SEED_YEAR, leaveType: lr.leaveType },
        },
        update: { grantedDays: lr.grantedDays, adjustedDays: lr.adjustedDays },
        create: {
          userId: user.id,
          year: SEED_YEAR,
          leaveType: lr.leaveType,
          grantedDays: lr.grantedDays,
          adjustedDays: lr.adjustedDays,
          usedDays: 0,
        },
      });
    }

    if (u.seedAmount > 0n) {
      const existing = await prisma.wallet.findUnique({
        where: { uq_wallet_user_currency: { userId: user.id, currency: "WELFARE_POINT" } },
      });
      // Only seed the initial balance once. Don't pile on each re-run.
      if (!existing) {
        await prisma.$transaction(async (tx) => {
          await tx.wallet.create({
            data: { userId: user.id, currency: "WELFARE_POINT", balance: u.seedAmount },
          });
          await tx.ledgerEntry.create({
            data: {
              userId: user.id,
              currency: "WELFARE_POINT",
              actionType: "CREDIT_ADMIN",
              amount: u.seedAmount,
              balanceAfter: u.seedAmount,
              refNote: "Seed: initial wallet funding",
            },
          });
        });
      }
    }
    console.log(
      `  ${u.empId}  ${u.name}  (${u.role})  seed=${u.seedAmount} P  contrib=${u.contributedDays}d`,
    );
  }

  console.log("\n== Auctions (reset to fresh state) ==");
  // Clear bid_event for our seed IDs so re-seeding gives a clean slate. The
  // ledger trigger doesn't apply to bid_event.
  const seedIds = makeAuctions(new Date()).map((a) => a.id);
  await prisma.bidEvent.deleteMany({ where: { auctionId: { in: seedIds } } });

  for (const a of makeAuctions(new Date())) {
    await prisma.auction.upsert({
      where: { id: a.id },
      update: {
        status: a.status,
        startPrice: a.startPrice,
        highest: a.startPrice,
        highestBidder: null,
        bidCount: 0,
        leaveDays: a.leaveDays,
        startedAt: a.startedAt,
        endsAt: a.endsAt,
        settledAt: null,
      },
      create: {
        id: a.id,
        status: a.status,
        startPrice: a.startPrice,
        highest: a.startPrice,
        minIncrement: 100n,
        leaveDays: a.leaveDays,
        startedAt: a.startedAt,
        endsAt: a.endsAt,
        bidCount: 0,
      },
    });
    const lifeLabel =
      a.status === "OPEN"
        ? `ends in ${Math.round((a.endsAt.getTime() - Date.now()) / MIN)}m`
        : `opens in ${Math.round((a.startedAt.getTime() - Date.now()) / MIN)}m`;
    console.log(`  ${a.id}  ${a.status.padEnd(7)}  ${lifeLabel}`);
  }

  console.log("\n✅ Seed complete.");
  console.log("   Try:  curl http://localhost:3001/api/auctions");
  console.log("   A-2026-104 will auto-settle in ~2 minutes (SettleDueAuctionsScheduler)");
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(async () => { await prisma.$disconnect(); });
