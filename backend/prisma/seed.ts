// Dev seed — ezpass-backed (회원 = ezpass cmpny-7 정본, 연차·경매금 = 우리 DB; ADR-020).
//
// 한 번의 `npm run db:seed`로 실회원을 재현한다:
//   1) msaportal(ezpass)에서 cmpny-7 회원 미러 → users (이메일 키)
//   2) 각 회원 REGULAR 연차를 ezpass tbl_user_yryc에서 시드
//   3) @exam.com 회원에 지갑(WELFARE_POINT)+CREDIT_ADMIN 원장+contributedDays 부여
//   4) 경매판(OPEN/CREATED) + 입찰/낙찰 데모 활동(escrow/wallet/ledger/AUCTION연차 정합)
//
// 접속정보는 .env의 MSAPORTAL_URL에서만 읽는다(크리덴셜 커밋 금지).
//   MSAPORTAL_URL="mysql://<user>:<pass>@<host>:<port>/msaportal"
// 우리 Prisma 클라이언트는 sqlite로 생성되므로 ezpass(MySQL)는 mysql2로 직접 읽는다.
//
// 멱등성: 회원/연차/지갑/contributedDays는 upsert(재실행 안전). 경매 "활동"(입찰/낙찰)은
// insert-only 원장이라 재적용하면 escrow가 깨지므로 이미 입찰이 있으면 건너뛴다.
// 깨끗한 재현은 `prisma migrate reset`(자동으로 seed 실행) 권장.

import { PrismaClient } from "@prisma/client";
import * as mysql from "mysql2/promise";
import * as bcrypt from "bcryptjs";

const prisma = new PrismaClient();
const CMPNY = 7;
const YEAR = 2026;
const MIN = 60_000, HR = 60 * MIN, DAY = 24 * HR;

// ── 경매 활동 헬퍼 (place-bid/settle 원장 규약) ──
const bal: Record<string, bigint> = {};
async function loadBalances() {
  const ws = await prisma.wallet.findMany({ where: { currency: "WELFARE_POINT" } });
  for (const w of ws) bal[String(w.userId)] = w.balance;
}
async function setWallet(userId: bigint, newBal: bigint) {
  bal[String(userId)] = newBal;
  await prisma.wallet.update({
    where: { uq_wallet_user_currency: { userId, currency: "WELFARE_POINT" } },
    data: { balance: newBal },
  });
}
async function ledger(userId: bigint, actionType: string, amount: bigint, balanceAfter: bigint, auctionId: string, refNote: string | null) {
  await prisma.ledgerEntry.create({
    data: { userId, currency: "WELFARE_POINT", actionType, amount, balanceAfter, auctionId, refNote },
  });
}
async function putAuction(id: string, status: string, leaveDays: number, startPrice: number, startedAt: Date, endsAt: Date) {
  const data = { status, startPrice: BigInt(startPrice), highest: BigInt(startPrice), highestBidder: null as bigint | null, bidCount: 0, minIncrement: 100n, leaveDays, startedAt, endsAt, settledAt: null as Date | null };
  await prisma.auction.upsert({ where: { id }, update: data, create: { id, ...data } });
}
async function bid(id: string, bidderId: bigint, amount: number) {
  const amt = BigInt(amount);
  const a = await prisma.auction.findUnique({ where: { id } });
  if (!a) throw new Error(`auction ${id} missing`);
  if (a.highestBidder !== null) {
    const nb = (bal[String(a.highestBidder)] ?? 0n) + a.highest;
    await setWallet(a.highestBidder, nb);
    await ledger(a.highestBidder, "REFUND", a.highest, nb, id, "Outbid — auto refund");
  }
  const myBal = (bal[String(bidderId)] ?? 0n) - amt;
  if (myBal < 0n) throw new Error(`insufficient: user ${bidderId} ${bal[String(bidderId)]} < ${amt}`);
  await setWallet(bidderId, myBal);
  await ledger(bidderId, "BID", -amt, myBal, id, null);
  await prisma.bidEvent.create({ data: { auctionId: id, userId: bidderId, amount: amt } });
  await prisma.auction.update({ where: { id }, data: { highest: amt, highestBidder: bidderId, bidCount: { increment: 1 } } });
}
async function settle(id: string) {
  const a = await prisma.auction.findUnique({ where: { id } });
  if (!a || a.highestBidder === null) return;
  await prisma.auction.update({ where: { id }, data: { status: "AWARDED", settledAt: new Date(Date.now() - HR) } });
  await ledger(a.highestBidder, "WIN", 0n, bal[String(a.highestBidder)] ?? 0n, id, "낙찰 확정");
  await prisma.leaveBalance.upsert({
    where: { uq_leave_user_year_type: { userId: a.highestBidder, year: YEAR, leaveType: "AUCTION" } },
    update: { adjustedDays: { increment: a.leaveDays } },
    create: { userId: a.highestBidder, year: YEAR, leaveType: "AUCTION", grantedDays: 0, adjustedDays: a.leaveDays, usedDays: 0 },
  });
}

// ── 1) ezpass cmpny-7 회원 미러 + REGULAR 연차 ──
async function syncMembersAndLeave() {
  const url = process.env.MSAPORTAL_URL;
  if (!url) {
    throw new Error(
      "MSAPORTAL_URL이 .env에 없습니다. ezpass-backed 시드는 회원 정본을 msaportal에서 읽습니다.\n" +
      '  예) MSAPORTAL_URL="mysql://<user>:<pass>@<host>:<port>/msaportal"',
    );
  }
  const msa = await mysql.createConnection(url);
  try {
    const [rows] = await msa.query(
      `SELECT u.user_no, u.user_id AS email, u.user_nm AS name, u.emp_no, u.cmpny_no,
              u.mngr_author_no, d.dept_nm AS team,
              c.clsf_nm AS job_rank, o.ofcsprtps_nm AS job_title
         FROM tbl_user_info u
         LEFT JOIN tbl_dept_info d ON d.dept_no = u.dept_no
         LEFT JOIN tbl_cmpny_clsf_info c ON c.cmpny_no = u.cmpny_no AND c.clsf_no = u.clsf_no
         LEFT JOIN tbl_cmpny_ofcsprtps_info o ON o.cmpny_no = u.cmpny_no AND o.ofcsprtps_no = u.ofcsprtps_no
        WHERE u.cmpny_no = ${CMPNY} AND u.user_id IS NOT NULL`,
    );
    const members = rows as any[];
    let synced = 0;
    for (const m of members) {
      const email = String(m.email);
      const empId = m.emp_no && String(m.emp_no).trim() ? String(m.emp_no).trim() : `EZP-${Number(m.user_no)}`;
      const role = m.mngr_author_no && String(m.mngr_author_no).trim() ? "ADMIN" : "EMPLOYEE";
      const name = m.name ? String(m.name) : email.split("@")[0];
      const team = m.team ? String(m.team) : null;
      const jobRank = m.job_rank ? String(m.job_rank) : null;
      const jobTitle = m.job_title ? String(m.job_title) : null;

      const user = await prisma.user.upsert({
        where: { email },
        update: { name, team, role, jobRank, jobTitle },
        create: { empId, email, name, team, role, jobRank, jobTitle },
      });

      // REGULAR 연차 = ezpass tbl_user_yryc 최신연도(atmc+mdat).
      const [yrRows] = await msa.query(
        `SELECT ROUND(COALESCE(atmc_yryc_day_qty,0) + COALESCE(mdat_yryc_day_qty,0)) AS days
           FROM tbl_user_yryc WHERE user_no = ? AND cmpny_no = ?
          ORDER BY yryc_year DESC LIMIT 1`,
        [Number(m.user_no), Number(m.cmpny_no)],
      );
      const days = (yrRows as any[])[0] ? Number((yrRows as any[])[0].days) : 0;
      await prisma.leaveBalance.upsert({
        where: { uq_leave_user_year_type: { userId: user.id, year: YEAR, leaveType: "REGULAR" } },
        update: { grantedDays: days },
        create: { userId: user.id, year: YEAR, leaveType: "REGULAR", grantedDays: days, adjustedDays: 0, usedDays: 0 },
      });
      synced++;
    }
    const admins = await prisma.user.count({ where: { role: "ADMIN" } });
    console.log(`  미러 ${synced}/${members.length}명 (cmpny ${CMPNY}, ADMIN ${admins})`);
  } finally {
    await msa.end();
  }
}

// ── 2) @exam.com 회원 펀딩(지갑 + CREDIT_ADMIN + contributedDays) ──
async function fundMembers() {
  const members = await prisma.user.findMany({
    where: { email: { endsWith: "@exam.com" } },
    select: { id: true },
    orderBy: { email: "asc" },
  });
  let funded = 0;
  for (let i = 0; i < members.length; i++) {
    const m = members[i];
    const points = BigInt(20000 + (i % 7) * 10000); // 20,000 ~ 80,000 P
    const contributedDays = 2 + (i % 13); // 2 ~ 14 일
    const existing = await prisma.wallet.findUnique({
      where: { uq_wallet_user_currency: { userId: m.id, currency: "WELFARE_POINT" } },
    });
    await prisma.$transaction(async (tx) => {
      if (!existing) {
        await tx.wallet.create({ data: { userId: m.id, currency: "WELFARE_POINT", balance: points } });
        await tx.ledgerEntry.create({
          data: { userId: m.id, currency: "WELFARE_POINT", actionType: "CREDIT_ADMIN", amount: points, balanceAfter: points, refNote: "Seed: 초기 복지포인트 지급" },
        });
        funded++;
      }
      await tx.user.update({ where: { id: m.id }, data: { contributedDays } });
    });
  }
  console.log(`  펀딩 ${funded}개 신규 지갑, contributedDays ${members.length}명 설정`);
}

// ── 3) 경매판 + 입찰/낙찰 데모 활동 (이미 입찰 있으면 건너뜀) ──
async function seedActivity() {
  if ((await prisma.bidEvent.count()) > 0) {
    console.log("  (입찰 데이터 존재 → 활동 시드 건너뜀)");
    return;
  }
  await loadBalances();
  const members = await prisma.user.findMany({
    where: { email: { endsWith: "@exam.com" } },
    select: { id: true, email: true },
  });
  const byEmail = new Map(members.map((m) => [m.email, m.id]));
  const U = (n: number) => {
    const id = byEmail.get(`user${String(n).padStart(3, "0")}@exam.com`);
    if (!id) throw new Error(`member user${n} missing`);
    return id;
  };
  const now = Date.now();

  const awarded: { id: string; days: number; start: number; seq: [number, number][] }[] = [
    { id: "A-2026-090", days: 1, start: 5000, seq: [[2, 5200], [1, 5500], [2, 5900], [7, 6300]] },
    { id: "A-2026-091", days: 2, start: 5000, seq: [[1, 5300], [3, 5700], [1, 6200], [3, 6800], [1, 7400]] },
    { id: "A-2026-092", days: 1, start: 5000, seq: [[4, 5400], [6, 5900]] },
    { id: "A-2026-093", days: 3, start: 8000, seq: [[9, 8500], [3, 9200], [9, 10100], [5, 11000], [9, 12500]] },
    { id: "A-2026-094", days: 1, start: 5000, seq: [[2, 5300], [10, 5700], [2, 6100]] },
  ];
  for (let i = 0; i < awarded.length; i++) {
    const a = awarded[i];
    await putAuction(a.id, "OPEN", a.days, a.start, new Date(now - (5 - i) * DAY), new Date(now - (4 - i) * DAY - HR));
    for (const [n, amt] of a.seq) await bid(a.id, U(n), amt);
    await settle(a.id);
  }

  await putAuction("A-2026-105", "OPEN", 2, 5000, new Date(now - 2 * HR), new Date(now + 30 * MIN));
  for (const [n, amt] of [[1, 5600], [4, 6300], [1, 7000]] as [number, number][]) await bid("A-2026-105", U(n), amt);
  await putAuction("A-2026-106", "OPEN", 1, 5000, new Date(now - 1 * HR), new Date(now + 2 * HR));
  for (const [n, amt] of [[5, 5400], [7, 5900], [3, 6500]] as [number, number][]) await bid("A-2026-106", U(n), amt);

  await putAuction("A-2026-104", "OPEN", 1, 5000, new Date(now - 1 * HR), new Date(now + 2 * MIN));
  await putAuction("A-2026-107", "OPEN", 1, 5000, new Date(now - 1 * HR), new Date(now + 1 * DAY));
  await putAuction("A-2026-108", "CREATED", 2, 5000, new Date(now + 30 * MIN), new Date(now + 6 * HR));
  await putAuction("A-2026-109", "CREATED", 3, 5000, new Date(now + 1 * DAY), new Date(now + 3 * DAY));

  const esc = await prisma.ledgerEntry.aggregate({ _sum: { amount: true }, where: { actionType: "BID" } });
  const ref = await prisma.ledgerEntry.aggregate({ _sum: { amount: true }, where: { actionType: { in: ["REFUND", "DIVIDEND"] } } });
  const escrow = -(esc._sum.amount ?? 0n) - (ref._sum.amount ?? 0n);
  const byStatus = await prisma.auction.groupBy({ by: ["status"], _count: { _all: true } });
  console.log(`  escrow ${Number(escrow)}P, auctions ${JSON.stringify(byStatus)}, bids ${await prisma.bidEvent.count()}`);
}

/** 데모 관리자 — ezpass admin@ 계정이 외부 사유로 인증 불가가 되자, role을 우리 DB가
 *  소유하게 하고(ADR-020 개정) admin@에 *로컬 비번*을 부여한다. CompositeAuthProvider가
 *  로컬 비번 보유 계정을 로컬 검증하므로, ezpass와 무관하게 admin@로 로그인 가능(ADR-022).
 *  데모 비번이라 평문 주석 OK. */
async function setupDemoAdmin() {
  const ADMIN_EMAIL = "admin@timesoftcon.co.kr";
  const DEMO_PW = "!12345qwertY"; // 데모 전용
  const hash = await bcrypt.hash(DEMO_PW, 10);
  const r = await prisma.user.updateMany({
    where: { email: ADMIN_EMAIL },
    data: { role: "ADMIN", passwordHash: hash, active: true },
  });
  console.log(`  데모 관리자: ${ADMIN_EMAIL} → ADMIN + 로컬 비번 (updated ${r.count})`);
}

async function main() {
  console.log("== 1) ezpass 회원 미러 + REGULAR 연차 ==");
  await syncMembersAndLeave();
  console.log("== 1b) 데모 관리자 (로컬 비번) ==");
  await setupDemoAdmin();
  console.log("== 2) 회원 펀딩 ==");
  await fundMembers();
  console.log("== 3) 경매 데모 활동 ==");
  await seedActivity();
  console.log("\n✅ Seed complete (ezpass-backed).");
  console.log("   A-2026-104는 ~2분 후 자동 마감(SettleDueAuctionsScheduler)");
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(async () => { await prisma.$disconnect(); });
