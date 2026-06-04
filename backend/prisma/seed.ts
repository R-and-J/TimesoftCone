// Dev seed — ezpass-backed (회원 = ezpass cmpny-7 정본, 연차·경매금 = 우리 DB; ADR-020).
//
// 한 번의 `npm run db:seed`로 실회원을 재현한다:
//   1) msaportal(ezpass)에서 cmpny-7 회원 미러 → users (이메일 키)
//   2) 각 회원 REGULAR 연차를 ezpass tbl_user_yryc에서 시드
//   3) EZPASS 회원에 지갑(WELFARE_POINT)+CREDIT_ADMIN 원장+contributedDays 부여 + EXAM 데모 계정
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
// companyId 기본 1n(EZPASS). EXAM 활동은 2n을 넘겨 회사별 정합(escrow per company)을 지킨다.
async function ledger(userId: bigint, actionType: string, amount: bigint, balanceAfter: bigint, auctionId: string, refNote: string | null, companyId: bigint = 1n) {
  await prisma.ledgerEntry.create({
    data: { userId, currency: "WELFARE_POINT", actionType, amount, balanceAfter, auctionId, refNote, companyId },
  });
}
async function putAuction(id: string, status: string, leaveDays: number, startPrice: number, startedAt: Date, endsAt: Date, companyId: bigint = 1n) {
  const data = { status, startPrice: BigInt(startPrice), highest: BigInt(startPrice), highestBidder: null as bigint | null, bidCount: 0, minIncrement: 100n, leaveDays, startedAt, endsAt, settledAt: null as Date | null, companyId };
  await prisma.auction.upsert({ where: { id }, update: data, create: { id, ...data } });
}
async function bid(id: string, bidderId: bigint, amount: number, companyId: bigint = 1n) {
  const amt = BigInt(amount);
  const a = await prisma.auction.findUnique({ where: { id } });
  if (!a) throw new Error(`auction ${id} missing`);
  if (a.highestBidder !== null) {
    const nb = (bal[String(a.highestBidder)] ?? 0n) + a.highest;
    await setWallet(a.highestBidder, nb);
    await ledger(a.highestBidder, "REFUND", a.highest, nb, id, "Outbid — auto refund", companyId);
  }
  const myBal = (bal[String(bidderId)] ?? 0n) - amt;
  if (myBal < 0n) throw new Error(`insufficient: user ${bidderId} ${bal[String(bidderId)]} < ${amt}`);
  await setWallet(bidderId, myBal);
  await ledger(bidderId, "BID", -amt, myBal, id, null, companyId);
  await prisma.bidEvent.create({ data: { auctionId: id, userId: bidderId, amount: amt, companyId } });
  await prisma.auction.update({ where: { id }, data: { highest: amt, highestBidder: bidderId, bidCount: { increment: 1 } } });
}
async function settle(id: string, companyId: bigint = 1n) {
  const a = await prisma.auction.findUnique({ where: { id } });
  if (!a || a.highestBidder === null) return;
  await prisma.auction.update({ where: { id }, data: { status: "AWARDED", settledAt: new Date(Date.now() - HR) } });
  await ledger(a.highestBidder, "WIN", 0n, bal[String(a.highestBidder)] ?? 0n, id, "낙찰 확정", companyId);
  await prisma.leaveBalance.upsert({
    where: { uq_leave_user_year_type: { userId: a.highestBidder, year: YEAR, leaveType: "AUCTION" } },
    update: { adjustedDays: { increment: a.leaveDays } },
    create: { userId: a.highestBidder, year: YEAR, leaveType: "AUCTION", grantedDays: 0, adjustedDays: a.leaveDays, usedDays: 0, companyId },
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
      // ezpass cmpny 회원 = 회사 도메인 연동 → EZPASS(관리자 권한 보유면 EZPASS_ADMIN).
      // 최고 ADMIN은 별도 로컬 계정(super@admin.local). admin@timesoftcon도 여기선 EZPASS_ADMIN.
      const role = m.mngr_author_no && String(m.mngr_author_no).trim() ? "EZPASS_ADMIN" : "EZPASS";
      const name = m.name ? String(m.name) : email.split("@")[0];
      const team = m.team ? String(m.team) : null;
      const jobRank = m.job_rank ? String(m.job_rank) : null;
      const jobTitle = m.job_title ? String(m.job_title) : null;

      const user = await prisma.user.upsert({
        where: { email },
        update: { name, team, role, jobRank, jobTitle, companyId: 1n },
        create: { empId, email, name, team, role, jobRank, jobTitle, companyId: 1n },
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

// ── 2) EZPASS 회원 펀딩(지갑 + CREDIT_ADMIN + contributedDays) ──
async function fundMembers() {
  const members = await prisma.user.findMany({
    where: { role: { in: ["EZPASS", "EZPASS_ADMIN"] } },
    select: { id: true },
    orderBy: { email: "asc" },
  });
  let funded = 0;
  for (let i = 0; i < members.length; i++) {
    const m = members[i];
    // 시작가 30,000 P 고정 + 매물 풀이 100개 가까이로 늘어나 인당 ~8건 낙찰까지 견디게.
    const points = BigInt(300000 + (i % 7) * 30000); // 300,000 ~ 480,000 P
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
  // EZPASS 회원을 이메일 로컬파트(userNNN)로 매핑 — 도메인(@exam.com/@timesoftcone.com) 무관.
  const members = await prisma.user.findMany({
    where: { role: { in: ["EZPASS", "EZPASS_ADMIN"] } },
    select: { id: true, email: true },
  });
  const byLocal = new Map(
    members
      .filter((m) => m.email)
      .map((m) => [m.email!.split("@")[0], m.id]),
  );
  const U = (n: number) => {
    const id = byLocal.get(`user${String(n).padStart(3, "0")}`);
    if (!id) throw new Error(`member user${n} missing`);
    return id;
  };
  const now = Date.now();

  // 모든 매물은 ADR-007에 따라 1일권, 시작가는 30,000 P 고정.
  const awarded: { id: string; days: number; start: number; seq: [number, number][] }[] = [
    { id: "A-2026-090", days: 1, start: 30000, seq: [[2, 30200], [1, 30500], [2, 30900], [7, 31300]] },
    { id: "A-2026-091", days: 1, start: 30000, seq: [[1, 30300], [3, 30700], [1, 31200], [3, 31800], [1, 32400]] },
    { id: "A-2026-092", days: 1, start: 30000, seq: [[4, 30400], [6, 30900]] },
    { id: "A-2026-093", days: 1, start: 30000, seq: [[9, 30500], [3, 31200], [9, 32100], [5, 33000], [9, 34500]] },
    { id: "A-2026-094", days: 1, start: 30000, seq: [[2, 30300], [10, 30700], [2, 31100]] },
  ];
  for (let i = 0; i < awarded.length; i++) {
    const a = awarded[i];
    await putAuction(a.id, "OPEN", a.days, a.start, new Date(now - (5 - i) * DAY), new Date(now - (4 - i) * DAY - HR));
    for (const [n, amt] of a.seq) await bid(a.id, U(n), amt);
    await settle(a.id);
  }

  await putAuction("A-2026-105", "OPEN", 1, 30000, new Date(now - 2 * HR), new Date(now + 30 * MIN));
  for (const [n, amt] of [[1, 30600], [4, 31300], [1, 32000]] as [number, number][]) await bid("A-2026-105", U(n), amt);
  await putAuction("A-2026-106", "OPEN", 1, 30000, new Date(now - 1 * HR), new Date(now + 2 * HR));
  for (const [n, amt] of [[5, 30400], [7, 30900], [3, 31500]] as [number, number][]) await bid("A-2026-106", U(n), amt);

  await putAuction("A-2026-104", "OPEN", 1, 30000, new Date(now - 1 * HR), new Date(now + 2 * MIN));
  await putAuction("A-2026-107", "OPEN", 1, 30000, new Date(now - 1 * HR), new Date(now + 1 * DAY));
  await putAuction("A-2026-108", "CREATED", 1, 30000, new Date(now + 30 * MIN), new Date(now + 6 * HR));
  await putAuction("A-2026-109", "CREATED", 1, 30000, new Date(now + 1 * DAY), new Date(now + 3 * DAY));

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
/** 스토어 카탈로그(ADR-023) — 자립형 배포 데모용 상품 시드. sku로 멱등 upsert. */
async function seedRedemptionCatalog() {
  const items = [
    { sku: "AI-SUB-1M", name: "AI 구독권 (1개월)", brand: "OpenAI · Anthropic", description: "ChatGPT/Claude Pro 등 1개월 구독", priceP: 30000n, stock: null, category: "디지털 구독", displayOrder: 10 },
    { sku: "AI-SUB-1Y", name: "AI 구독권 (1년)", brand: "OpenAI · Anthropic", description: "ChatGPT/Claude Pro 등 1년 구독", priceP: 300000n, stock: 10, category: "디지털 구독", displayOrder: 11 },
    { sku: "MEAL-1", name: "사내 식권 1매", brand: "타임소프트콘 구내식당", description: "구내식당/제휴 식당", priceP: 5000n, stock: null, category: "식권", displayOrder: 20 },
    { sku: "MEAL-10", name: "사내 식권 10매 묶음", brand: "타임소프트콘 구내식당", description: "10매 묶음 할인가", priceP: 45000n, stock: 50, category: "식권", displayOrder: 21 },
    { sku: "STARBUCKS-ICED-AME", name: "아이스 아메리카노 Tall", brand: "스타벅스", description: "스타벅스 기프티콘", priceP: 5000n, stock: null, category: "카페 상품권", displayOrder: 30 },
    { sku: "TWOSOME-CAKE-SET", name: "아메리카노 + 조각케익 세트", brand: "투썸플레이스", description: "투썸 기프티콘", priceP: 12000n, stock: 30, category: "카페 상품권", displayOrder: 31 },
    { sku: "KAKAO-GIFT-10K", name: "카카오톡 선물하기 10,000원권", brand: "카카오", description: "원하는 상품 자유 선택", priceP: 10000n, stock: null, category: "기프티콘", displayOrder: 40 },
    { sku: "KAKAO-GIFT-30K", name: "카카오톡 선물하기 30,000원권", brand: "카카오", description: "원하는 상품 자유 선택", priceP: 30000n, stock: null, category: "기프티콘", displayOrder: 41 },
  ];
  for (const it of items) {
    await prisma.redemptionItem.upsert({
      where: { sku: it.sku },
      update: { name: it.name, brand: it.brand, description: it.description, priceP: it.priceP, stock: it.stock, category: it.category, displayOrder: it.displayOrder, active: true },
      create: it,
    });
  }
  // EXAM 회사용 최소 시드 — 사용자가 EXAM 관리자로 들어가도 빈 카탈로그가 아니게.
  const examItems = [
    { sku: "EXAM-COFFEE", name: "체험용 커피 쿠폰", brand: "체험 카페", description: "EXAM 회사 데모 상품", priceP: 3000n, stock: null, category: "카페 상품권", displayOrder: 10, companyId: 2n },
    { sku: "EXAM-MEAL", name: "체험용 식사 쿠폰", brand: "체험 식당", description: "EXAM 회사 데모 상품", priceP: 8000n, stock: 20, category: "식권", displayOrder: 20, companyId: 2n },
  ];
  for (const it of examItems) {
    await prisma.redemptionItem.upsert({
      where: { sku: it.sku },
      update: { name: it.name, brand: it.brand, description: it.description, priceP: it.priceP, stock: it.stock, category: it.category, displayOrder: it.displayOrder, companyId: it.companyId, active: true },
      create: it,
    });
  }
  console.log(`  카탈로그 EZPASS ${items.length}종 + EXAM ${examItems.length}종 (brand·displayOrder 포함)`);
}

/** EXAM(비연동 독립) 데모 계정 — ezpass에 없고 우리 DB가 정본. 로컬 비번으로 로그인.
 *  자체 로컬 데이터(지갑 + REGULAR 연차)만 가지며 ezpass 동기화를 받지 않는다. */
async function setupExamMembers() {
  const PW = await bcrypt.hash("1234", 10); // 데모 전용
  // EZPASS 회사와 유사한 규모(38명) — exam 관리자 1 + EXAM 일반 37.
  // 팀은 3개로 분산해서 회원관리 UI에서 부서별 보기도 자연스럽게.
  const teams = ["체험팀 A", "체험팀 B", "체험팀 C"];
  // 직급/직책 — EZPASS 미러와 동일 톤. 인덱스로 단계적 분배.
  const ranks = ["대표이사", "부장", "차장", "과장", "대리", "주임", "사원"];
  const titles = ["대표", "본부장", "팀장", "파트장", "—", "—", "—"];
  const exam: { email: string; name: string; team: string; jobRank: string; jobTitle: string; role: "EXAM" | "EXAM_ADMIN" }[] = [
    { email: "examadmin@exam.com", name: "exam 관리자", team: "운영", jobRank: "차장", jobTitle: "운영팀장", role: "EXAM_ADMIN" },
  ];
  // exam001(대표)~exam037 — 인덱스로 직급 단계 결정.
  for (let i = 1; i <= 37; i++) {
    const rankIdx = i === 1 ? 0 : i <= 5 ? 1 : i <= 15 ? 3 : i <= 25 ? 4 : 6;
    exam.push({
      email: `exam${String(i).padStart(3, "0")}@exam.com`,
      name: `체험 사용자${i}`,
      team: teams[(i - 1) % teams.length],
      jobRank: ranks[rankIdx],
      jobTitle: titles[rankIdx] === "—" ? "—" : titles[rankIdx],
      role: "EXAM",
    });
  }
  for (let i = 0; i < exam.length; i++) {
    const e = exam[i];
    const user = await prisma.user.upsert({
      where: { email: e.email },
      update: { name: e.name, team: e.team, jobRank: e.jobRank, jobTitle: e.jobTitle, role: e.role, passwordHash: PW, active: true, companyId: 2n },
      create: {
        empId: `EXAM-${String(i + 1).padStart(3, "0")}`,
        email: e.email,
        name: e.name,
        team: e.team,
        jobRank: e.jobRank,
        jobTitle: e.jobTitle,
        role: e.role,
        passwordHash: PW,
        active: true,
        companyId: 2n, // EXAM 회사
      },
    });
    // 지갑(신규일 때만 CREDIT_ADMIN 원장) — EZPASS와 동일 펀딩(300k~480k)으로 시연 견디게.
    const existing = await prisma.wallet.findUnique({
      where: { uq_wallet_user_currency: { userId: user.id, currency: "WELFARE_POINT" } },
    });
    if (!existing) {
      const points = BigInt(300000 + (i % 7) * 30000);
      await prisma.wallet.create({ data: { userId: user.id, currency: "WELFARE_POINT", balance: points, companyId: 2n } });
      await prisma.ledgerEntry.create({
        data: { userId: user.id, currency: "WELFARE_POINT", actionType: "CREDIT_ADMIN", amount: points, balanceAfter: points, refNote: "Seed: EXAM 초기 복지콘", companyId: 2n },
      });
    }
    await prisma.leaveBalance.upsert({
      where: { uq_leave_user_year_type: { userId: user.id, year: YEAR, leaveType: "REGULAR" } },
      update: {},
      create: { userId: user.id, year: YEAR, leaveType: "REGULAR", grantedDays: 15, adjustedDays: 0, usedDays: 0, companyId: 2n },
    });
  }
  console.log(`  EXAM 데모 ${exam.length}명 (EXAM ${exam.length - 1} + EXAM_ADMIN 1, 로컬 비번 1234)`);
}

/** 멀티테넌시: 회사 2곳(EZPASS·EXAM) idempotent upsert. 마이그레이션이 이미 행을
 *  넣지만, `db push`/부분 재시드에서도 안전하도록 시드에서도 보장한다. */
async function setupCompanies() {
  await prisma.company.upsert({
    where: { id: 1n },
    update: { code: "EZPASS", name: "타임소프트콘(이지패스)", cmpnyNo: CMPNY, kind: "EZPASS", active: true },
    create: { id: 1n, code: "EZPASS", name: "타임소프트콘(이지패스)", cmpnyNo: CMPNY, kind: "EZPASS", active: true },
  });
  await prisma.company.upsert({
    where: { id: 2n },
    update: { code: "EXAM", name: "EXAM(체험사)", cmpnyNo: null, kind: "EXAM", active: true },
    create: { id: 2n, code: "EXAM", name: "EXAM(체험사)", cmpnyNo: null, kind: "EXAM", active: true },
  });
  console.log("  회사 2곳: EZPASS(1, cmpny 7) / EXAM(2, 로컬)");
}

/** EXAM 회사 독립 데모 활동 — 회사 2 매물/입찰/낙찰을 EXAM 직원들로 채워 완전 독립을
 *  시연한다(EZPASS와 별개 escrow). id는 전역 PK라 EZPASS 데모와 겹치지 않는 200번대.
 *  멱등: 이미 EXAM 매물이 있으면 건너뜀. */
async function setupExamAuctions() {
  if ((await prisma.auction.count({ where: { companyId: 2n } })) > 0) {
    console.log("  (EXAM 매물 존재 → EXAM 활동 시드 건너뜀)");
    return;
  }
  await loadBalances(); // EXAM 지갑까지 포함(setupExamMembers 이후 호출)
  const exam = await prisma.user.findMany({
    where: { companyId: 2n, role: { in: ["EXAM", "EXAM_ADMIN"] } },
    select: { id: true, email: true },
  });
  const byLocal = new Map(exam.filter((m) => m.email).map((m) => [m.email!.split("@")[0], m.id]));
  const E = (local: string) => {
    const id = byLocal.get(local);
    if (!id) throw new Error(`EXAM member ${local} missing`);
    return id;
  };
  const now = Date.now();
  const CO = 2n;

  // 낙찰 1건(과거) — EXAM escrow에 입찰금이 쌓이고 낙찰자에 AUCTION 연차.
  await putAuction("A-2026-201", "OPEN", 1, 30000, new Date(now - 3 * DAY), new Date(now - 2 * DAY), CO);
  await bid("A-2026-201", E("exam001"), 30300, CO);
  await bid("A-2026-201", E("exam002"), 30800, CO);
  await settle("A-2026-201", CO);

  // 진행 중 1건 — 라이브 입찰 데모.
  await putAuction("A-2026-202", "OPEN", 1, 30000, new Date(now - 2 * HR), new Date(now + 1 * DAY), CO);
  await bid("A-2026-202", E("exam003"), 30400, CO);
  await bid("A-2026-202", E("exam001"), 31000, CO);

  // 오픈 예정 1건.
  await putAuction("A-2026-203", "CREATED", 1, 30000, new Date(now + 6 * HR), new Date(now + 2 * DAY), CO);

  const esc = await prisma.ledgerEntry.aggregate({ _sum: { amount: true }, where: { actionType: "BID", companyId: 2n } });
  const ref = await prisma.ledgerEntry.aggregate({ _sum: { amount: true }, where: { actionType: { in: ["REFUND", "DIVIDEND"] }, companyId: 2n } });
  const escrow = -(esc._sum.amount ?? 0n) - (ref._sum.amount ?? 0n);
  console.log(`  EXAM 매물 3건(낙찰1·진행1·예정1), EXAM escrow ${Number(escrow)}P`);
}

/** EXAM 회사 ${YEAR} 배당 시연 데이터 — EZPASS setupDividendDemo와 동일 구조(회사 2 스코프).
 *  매물 ID는 A-${YEAR}-500~589(AWARDED 90) + 590~593(다음 수 09:00 lookahead 4). */
async function setupExamDividendDemo() {
  const firstId = `A-${YEAR}-500`;
  if ((await prisma.auction.count({ where: { id: firstId } })) > 0) {
    console.log(`  (${firstId} 존재 → EXAM 배당 데모 시드 건너뜀)`);
    return;
  }
  await loadBalances();
  const members = await prisma.user.findMany({
    where: { companyId: 2n, role: { in: ["EXAM", "EXAM_ADMIN"] } },
    select: { id: true, email: true },
  });
  const byLocal = new Map(
    members.filter((m) => m.email).map((m) => [m.email!.split("@")[0], m.id]),
  );
  const CO = 2n;

  const N = 90;
  // EZPASS 와 동일한 status 분포: AWARDED 45 + DRAFT 45.
  const AWARDED_UNTIL = 45;
  const start0 = new Date(YEAR, 0, 1).getTime();
  const pool = 37; // exam001~exam037 회전
  for (let i = 1; i <= N; i++) {
    const id = `A-${YEAR}-${String(499 + i).padStart(3, "0")}`;
    let startedAt: Date;
    let endsAt: Date;
    let status: "OPEN" | "CREATED" | "DRAFT";
    let runBids: boolean;
    let runSettle: boolean;
    if (i <= AWARDED_UNTIL) {
      startedAt = new Date(start0 + i * 2 * DAY);
      endsAt = new Date(startedAt.getTime() + 6 * HR);
      status = "OPEN";
      runBids = true;
      runSettle = true;
    } else {
      startedAt = new Date(0);
      endsAt = new Date(1);
      status = "DRAFT";
      runBids = false;
      runSettle = false;
    }
    await putAuction(id, status, 1, 30000, startedAt, endsAt, CO);
    if (!runBids) continue;
    const ai = ((i * 1) % pool) + 1;
    const biIdx0 = ((i * 3) % pool) + 1;
    const bi = biIdx0 === ai ? ((i * 3 + 1) % pool) + 1 : biIdx0;
    const ciIdx0 = ((i * 7) % pool) + 1;
    const ci = ciIdx0 === ai || ciIdx0 === bi ? ((i * 7 + 1) % pool) + 1 : ciIdx0;
    const a = byLocal.get(`exam${String(ai).padStart(3, "0")}`);
    const b = byLocal.get(`exam${String(bi).padStart(3, "0")}`);
    const c = byLocal.get(`exam${String(ci).padStart(3, "0")}`);
    const bids: [bigint | undefined, number][] = [[a, 30200], [b, 30700], [c, 31500]];
    for (const [u, amt] of bids) {
      if (u === undefined) continue;
      try {
        await bid(id, u, amt, CO);
      } catch {
        /* 잔액 부족·중복 입찰 — 패턴상 거의 안 발생 */
      }
    }
    if (runSettle) await settle(id, CO);
  }

  // stake/supply 분포 — EZPASS와 동일 패턴, exam001 대표 + 부장 + 과장 + 대리 + 신입(0)
  type SupplyRow = { local: string; contrib: number; remaining: number };
  const distribution: SupplyRow[] = [];
  const u = (n: number) => `exam${String(n).padStart(3, "0")}`;
  distribution.push({ local: u(1), contrib: 25, remaining: 3 });
  for (let i = 2; i <= 5; i++) distribution.push({ local: u(i), contrib: 8, remaining: 1 });
  for (let i = 6; i <= 15; i++) distribution.push({ local: u(i), contrib: 4, remaining: 1 });
  for (let i = 16; i <= 25; i++) distribution.push({ local: u(i), contrib: 1, remaining: 0 });
  let stakeSum = 0;
  let remainSum = 0;
  for (const d of distribution) {
    const userId = byLocal.get(d.local);
    if (!userId) continue;
    await prisma.stake.upsert({
      where: { uq_stake_user_year: { userId, year: YEAR } },
      update: { days: d.contrib, companyId: CO },
      create: { userId, year: YEAR, days: d.contrib, companyId: CO },
    });
    await prisma.leavePoolSupply.upsert({
      where: { uq_supply_company_year_user: { companyId: CO, targetYear: YEAR, userId } },
      update: { contributedDays: d.contrib, remainingDays: d.remaining },
      create: { companyId: CO, targetYear: YEAR, userId, contributedDays: d.contrib, remainingDays: d.remaining },
    });
    stakeSum += d.contrib;
    remainSum += d.remaining;
  }
  await prisma.leavePoolRun.upsert({
    where: { uq_pool_company_target: { companyId: CO, targetYear: YEAR } },
    update: {},
    create: {
      sourceYear: YEAR - 1, targetYear: YEAR, companyId: CO,
      contributorCount: distribution.length, daysCollected: stakeSum,
      auctionsCreated: N, status: "DONE",
    },
  });

  // Lookahead 4건 — 다음 수요일 09:00 CREATED.
  const LOOKAHEAD = 4;
  const nextWed = nextWedAt9(new Date());
  const wkIndex = isoWeek(nextWed);
  const alloc = distribution.map((d) => ({ ...d, take: 0 }));
  let needed = LOOKAHEAD;
  while (needed > 0) {
    let progressed = false;
    for (const s of alloc) {
      if (s.remaining - s.take <= 0) continue;
      s.take += 1; needed -= 1; progressed = true;
      if (needed === 0) break;
    }
    if (!progressed) break;
  }
  const released = LOOKAHEAD - needed;
  if (released > 0) {
    for (let i = 0; i < released; i++) {
      const id = `A-${YEAR}-${String(499 + N + i + 1).padStart(3, "0")}`;
      await putAuction(id, "CREATED", 1, 30000, nextWed, new Date(nextWed.getTime() + 6 * HR), CO);
    }
    for (const s of alloc) {
      if (s.take === 0) continue;
      const userId = byLocal.get(s.local);
      if (!userId) continue;
      await prisma.leavePoolSupply.update({
        where: { uq_supply_company_year_user: { companyId: CO, targetYear: YEAR, userId } },
        data: { remainingDays: { decrement: s.take } },
      });
    }
    await prisma.leavePoolReleaseRun.create({
      data: { targetYear: YEAR, companyId: CO, periodIndex: wkIndex, cadence: "weekly", releasedQty: released },
    });
    await prisma.leavePoolRun.update({
      where: { uq_pool_company_target: { companyId: CO, targetYear: YEAR } },
      data: { auctionsCreated: { increment: released } },
    });
  }

  const escAgg = await prisma.ledgerEntry.aggregate({
    _sum: { amount: true },
    where: { actionType: "BID", companyId: CO, auctionId: { startsWith: `A-${YEAR}-5` } },
  });
  console.log(
    `  EXAM ${YEAR} 데모 매물 ${N}건 AWARDED + lookahead ${released}건 · stake 합 ${stakeSum}일/${distribution.length}명(exam001 25/${stakeSum}=${((25 / stakeSum) * 100).toFixed(1)}%) · supply 잔여 ${remainSum - released}일 · 추가 escrow ≈ ${Number(-(escAgg._sum.amount ?? 0n))}P`,
  );
}

/** 최고관리자(ADMIN) — ezpass와 무관한 전용 로컬 계정. admin@timesoftcon은 ezpass
 *  회사 관리자(mngr_author)라 동기화로 EZPASS_ADMIN이 되므로, 최고관리자는 별도 계정으로 둔다. */
async function setupSuperAdmin() {
  const EMAIL = "super@admin.local";
  const hash = await bcrypt.hash("!12345qwertY", 10); // 데모 전용
  await prisma.user.upsert({
    where: { email: EMAIL },
    update: { role: "ADMIN", passwordHash: hash, active: true, companyId: null },
    create: {
      empId: "SUPER-001",
      email: EMAIL,
      name: "최고관리자",
      role: "ADMIN",
      passwordHash: hash,
      active: true,
      companyId: null, // 전 회사 통합(스위처)
    },
  });
  console.log(`  최고관리자: ${EMAIL} → ADMIN + 로컬 비번`);
}

/** EZPASS 올해(YEAR) 경매 39건 + stake(year=YEAR). 연말 배당(ADR-008) 시연용.
 *  AdminOps "배당 정산" 버튼이 기본으로 올해를 정산하므로 시드도 같은 연도에 맞춘다.
 *  매물 모두 AWARDED(과거 settled). stake는 user001 12일(30.8%) + user002~010 각 3일.
 *  ID는 A-{YEAR}-300 ~ 338(기존 A-{YEAR}-090~109/201~203과 충돌 없게).
 *  멱등: A-{YEAR}-300 매물이 있으면 스킵. EZPASS 회사(1n)로 태깅.
 *  settle 호출:  POST /api/admin/dividend/settle  (year 생략=올해, 또는 ?dryRun=true). */
async function setupDividendDemo() {
  const firstId = `A-${YEAR}-300`;
  if ((await prisma.auction.count({ where: { id: firstId } })) > 0) {
    console.log(`  (${firstId} 존재 → 배당 데모 시드 건너뜀)`);
    return;
  }
  await loadBalances();
  const members = await prisma.user.findMany({
    where: { role: { in: ["EZPASS", "EZPASS_ADMIN"] } },
    select: { id: true, email: true },
  });
  const byLocal = new Map(
    members.filter((m) => m.email).map((m) => [m.email!.split("@")[0], m.id]),
  );
  const U = (n: number) => {
    const id = byLocal.get(`user${String(n).padStart(3, "0")}`);
    if (!id) throw new Error(`member user${n} missing`);
    return id;
  };

  const N = 90;
  // 매물 status 분포 — 사용자 결정(2026-06-04):
  //   i ∈ [1..AWARDED_UNTIL] : 과거 settled → AWARDED  (=정산용 종료 데이터)
  //   i > AWARDED_UNTIL      : 시간 미정 DRAFT  (=시작/예정 영역에 안 보임, 관리자가 필요할 때만 풀이)
  // 일반 진행 중/예정 매물은 setupActivity 그대로(11건)에서만 보이고, 자동 발행 lookahead 4건은 별도.
  const AWARDED_UNTIL = 45;
  const start0 = new Date(YEAR, 0, 1).getTime();
  // 입찰자 pool 확장 — user001~user038 회전. 한 매물에서 세 입찰자가 서로 다르도록
  // ((i*3)%pool)+1 이 a와 같으면 +1 시프트로 회피.
  const pool = 38;
  for (let i = 1; i <= N; i++) {
    const id = `A-${YEAR}-${String(299 + i).padStart(3, "0")}`;
    let startedAt: Date;
    let endsAt: Date;
    let status: "OPEN" | "CREATED" | "DRAFT";
    let runBids: boolean;
    let runSettle: boolean;
    if (i <= AWARDED_UNTIL) {
      // 과거 — settle 호출로 AWARDED.
      startedAt = new Date(start0 + i * 2 * DAY);
      endsAt = new Date(startedAt.getTime() + 6 * HR);
      status = "OPEN";
      runBids = true;
      runSettle = true;
    } else {
      // DRAFT — placeholder 시각(epoch). 입찰 X, 어느 UI 목록에도 안 뜸.
      startedAt = new Date(0);
      endsAt = new Date(1);
      status = "DRAFT";
      runBids = false;
      runSettle = false;
    }
    await putAuction(id, status, 1, 30000, startedAt, endsAt);
    if (!runBids) continue;
    const ai = ((i * 1) % pool) + 1;
    const biIdx0 = ((i * 3) % pool) + 1;
    const bi = biIdx0 === ai ? ((i * 3 + 1) % pool) + 1 : biIdx0;
    const ciIdx0 = ((i * 7) % pool) + 1;
    const ci = ciIdx0 === ai || ciIdx0 === bi ? ((i * 7 + 1) % pool) + 1 : ciIdx0;
    const a = byLocal.get(`user${String(ai).padStart(3, "0")}`);
    const b = byLocal.get(`user${String(bi).padStart(3, "0")}`);
    const c = byLocal.get(`user${String(ci).padStart(3, "0")}`);
    const bids: [bigint | undefined, number][] = [
      [a, 30200],
      [b, 30700],
      [c, 31500],
    ];
    for (const [u, amt] of bids) {
      if (u === undefined) continue;
      try {
        await bid(id, u, amt);
      } catch {
        /* 같은 사용자 연속 입찰 또는 잔액 부족 — 패턴상 거의 안 발생 */
      }
    }
    if (runSettle) await settle(id);
  }

  // "(YEAR-1) 12/31에 풀 수집을 했다" 시나리오 재현 — 풀 메타데이터를 정직하게 채운다.
  //
  // 분배(총 107일, 25명 기여 · 나머지 13명은 풀 기여 0):
  //   user001 (대표/vvvip)     contrib 25, remaining 3   → 발행 22 (~23.4%)
  //   user002~005 (임원/부장)  contrib  8, remaining 1   → 발행  7 (각 7.5%)
  //   user006~015 (과장/차장)  contrib  4, remaining 1   → 발행  3 (각 3.7%)
  //   user016~025 (대리/주임)  contrib  1, remaining 0   → 발행  1 (각 0.9%)
  //   user026~038 (신입/사원)  contrib  0, remaining 0   → 미기여
  // 의미:
  //   contrib(=stake.days)  = 풀에 기여한 일수(정산 비율 기준)
  //   remaining             = supply 잔여(= 아직 매물로 발행되지 않은 일수)
  //   contrib - remaining   = 이미 발행되어 위 N개 AWARDED 매물로 변환된 일수 → 합 90 (=N)
  //
  // ReleasePolicy: weekly 수(3) 17:00 × 4건/회. 잔여 17일이 ~5주에 걸쳐 자동 발행됨.
  type SupplyRow = { local: string; contrib: number; remaining: number };
  const distribution: SupplyRow[] = [];
  const u = (n: number) => `user${String(n).padStart(3, "0")}`;
  distribution.push({ local: u(1), contrib: 25, remaining: 3 });
  for (let i = 2; i <= 5; i++) distribution.push({ local: u(i), contrib: 8, remaining: 1 });
  for (let i = 6; i <= 15; i++) distribution.push({ local: u(i), contrib: 4, remaining: 1 });
  for (let i = 16; i <= 25; i++) distribution.push({ local: u(i), contrib: 1, remaining: 0 });
  let stakeSum = 0;
  let remainSum = 0;
  for (const d of distribution) {
    const userId = byLocal.get(d.local);
    if (!userId) continue;
    await prisma.stake.upsert({
      where: { uq_stake_user_year: { userId, year: YEAR } },
      update: { days: d.contrib, companyId: 1n },
      create: { userId, year: YEAR, days: d.contrib, companyId: 1n },
    });
    await prisma.leavePoolSupply.upsert({
      where: { uq_supply_company_year_user: { companyId: 1n, targetYear: YEAR, userId } },
      update: { contributedDays: d.contrib, remainingDays: d.remaining },
      create: {
        companyId: 1n,
        targetYear: YEAR,
        userId,
        contributedDays: d.contrib,
        remainingDays: d.remaining,
      },
    });
    stakeSum += d.contrib;
    remainSum += d.remaining;
  }

  // LeavePoolRun 마커 — (companyId, targetYear) UNIQUE. "(YEAR-1)에 수집했다" 흉내.
  // 누적 발행 수는 N + lookahead 4개 = N+4. 아래서 lookahead 발행 후 increment.
  await prisma.leavePoolRun.upsert({
    where: { uq_pool_company_target: { companyId: 1n, targetYear: YEAR } },
    update: {},
    create: {
      sourceYear: YEAR - 1,
      targetYear: YEAR,
      companyId: 1n,
      contributorCount: distribution.length,
      daysCollected: stakeSum,
      auctionsCreated: N,
      status: "DONE",
    },
  });

  // ── Lookahead 1회차 — 다음 수요일 17:00 매물 4건 CREATED. ───────────
  // ReleaseInventoryScheduler가 기본 비활성이라 첫 회차분을 시드에서 직접 매물화한다.
  // supply에서 라운드 로빈으로 4일 차감 + leave_pool_release_run 마커 적재 + LeavePoolRun.auctionsCreated +4.
  const LOOKAHEAD_QTY = 4;
  const nextWed = nextWedAt9(new Date());
  const wkIndex = isoWeek(nextWed);
  const supplyAlloc = distribution.map((d) => ({ ...d, take: 0 }));
  let needed = LOOKAHEAD_QTY;
  while (needed > 0) {
    let progressed = false;
    for (const s of supplyAlloc) {
      if (s.remaining - s.take <= 0) continue;
      s.take += 1;
      needed -= 1;
      progressed = true;
      if (needed === 0) break;
    }
    if (!progressed) break;
  }
  const actuallyReleased = LOOKAHEAD_QTY - needed;
  if (actuallyReleased > 0) {
    for (let i = 0; i < actuallyReleased; i++) {
      const id = `A-${YEAR}-${String(299 + N + i + 1).padStart(3, "0")}`;
      await putAuction(id, "CREATED", 1, 30000, nextWed, new Date(nextWed.getTime() + 6 * HR));
    }
    for (const s of supplyAlloc) {
      if (s.take === 0) continue;
      const userId = byLocal.get(s.local);
      if (!userId) continue;
      await prisma.leavePoolSupply.update({
        where: { uq_supply_company_year_user: { companyId: 1n, targetYear: YEAR, userId } },
        data: { remainingDays: { decrement: s.take } },
      });
    }
    await prisma.leavePoolReleaseRun.create({
      data: {
        targetYear: YEAR,
        companyId: 1n,
        periodIndex: wkIndex,
        cadence: "weekly",
        releasedQty: actuallyReleased,
      },
    });
    await prisma.leavePoolRun.update({
      where: { uq_pool_company_target: { companyId: 1n, targetYear: YEAR } },
      data: { auctionsCreated: { increment: actuallyReleased } },
    });
  }
  // ───────────────────────────────────────────────────────────────────

  // ReleasePolicy — 잔여 12일이 매주 4건씩 자동 발행되도록.
  await prisma.releasePolicy.upsert({
    where: { id: 1 },
    update: {
      cadence: "weekly",
      dayOfWeek: 3,
      timeOfDay: "09:00",
      quantity: 4,
      dayOfMonth: null,
      companyId: 1n,
    },
    create: {
      id: 1,
      cadence: "weekly",
      dayOfWeek: 3,
      timeOfDay: "09:00",
      quantity: 4,
      companyId: 1n,
    },
  });

  const esc = await prisma.ledgerEntry.aggregate({
    _sum: { amount: true },
    where: { actionType: "BID", companyId: 1n, auctionId: { startsWith: `A-${YEAR}-3` } },
  });
  console.log(
    `  ${YEAR} 데모 매물 ${N}건 AWARDED · stake 합 ${stakeSum}일/${distribution.length}명(user001 25/${stakeSum}=${((25 / stakeSum) * 100).toFixed(1)}%) · supply 잔여 ${remainSum}일 · ReleasePolicy weekly(수 09:00, 4건/회) · 추가 escrow ≈ ${Number(-(esc._sum.amount ?? 0n))}P`,
  );
}

/** 다음 수요일 09:00 (로컬). 오늘이 수요일 + 9시 이후면 다음 주. */
function nextWedAt9(now: Date): Date {
  const d = new Date(now);
  const day = d.getDay();
  let add = (3 - day + 7) % 7;
  if (add === 0) {
    const today9 = new Date(d);
    today9.setHours(9, 0, 0, 0);
    if (d.getTime() >= today9.getTime()) add = 7;
  }
  d.setDate(d.getDate() + add);
  d.setHours(9, 0, 0, 0);
  return d;
}

/** ISO 8601 주 — release-window.ts의 isoWeek와 동일 로직(목요일 알고리즘). */
function isoWeek(d: Date): string {
  const t = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  const dayNum = (t.getUTCDay() + 6) % 7;
  t.setUTCDate(t.getUTCDate() - dayNum + 3);
  const firstThursday = new Date(Date.UTC(t.getUTCFullYear(), 0, 4));
  const weekNo = 1 + Math.round(
    (t.getTime() - firstThursday.getTime()) / (7 * 24 * 60 * 60 * 1000) -
      ((firstThursday.getUTCDay() + 6) % 7) / 7 +
      ((t.getUTCDay() + 6) % 7) / 7,
  );
  return `${t.getUTCFullYear()}-W${String(weekNo).padStart(2, "0")}`;
}

async function main() {
  console.log("== 0) 회사 2곳 (멀티테넌시) ==");
  await setupCompanies();
  console.log("== 1) ezpass 회원 미러 + REGULAR 연차 ==");
  await syncMembersAndLeave();
  console.log("== 1b) 최고관리자 (별도 로컬 계정) ==");
  await setupSuperAdmin();
  console.log("== 1b-2) EXAM 데모 계정 (비연동, 로컬 비번) ==");
  await setupExamMembers();
  console.log("== 1c) 스토어 카탈로그 (ADR-023) ==");
  await seedRedemptionCatalog();
  console.log("== 2) 회원 펀딩 ==");
  await fundMembers();
  console.log("== 3) 경매 데모 활동 (EZPASS) ==");
  await seedActivity();
  console.log("== 3b) EXAM 회사 독립 데모 활동 ==");
  await setupExamAuctions();
  console.log(`== 3c) EZPASS ${YEAR} 배당 시연 데이터 (매물 90건 + stake + lookahead) ==`);
  await setupDividendDemo();
  console.log(`== 3d) EXAM ${YEAR} 배당 시연 데이터 (매물 90건 + stake + lookahead) ==`);
  await setupExamDividendDemo();
  console.log("\n✅ Seed complete (ezpass-backed, 멀티테넌시).");
  console.log("   A-2026-104는 ~2분 후 자동 마감(SettleDueAuctionsScheduler)");
  console.log(`   배당 시연: POST /api/admin/dividend/settle (?dryRun=true 미리보기, year 생략=${YEAR})`);
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(async () => { await prisma.$disconnect(); });
