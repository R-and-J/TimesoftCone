// 입찰 핫패스 통합 테스트 — 실제 Prisma 어댑터 + PrismaUnitOfWork 트랜잭션에 대고
// PlaceBidUseCase를 돌려 (CLAUDE.md 인바리언트) 단일 tx·Insert-Only 원장·패자
// 자동환불·anti-snipe(CUT-5) 영속화를 DB 상태로 검증한다.
import type { TestingModule } from "@nestjs/testing";
import { PlaceBidUseCase } from "@/application/auction/place-bid.use-case";
import { PrismaService } from "@/adapters/persistence/prisma.service";
import {
  balanceOf,
  bootstrapE2E,
  createAuction,
  createUser,
  ledgerOf,
  resetDb,
} from "./e2e-utils";

describe("PlaceBid (integration, real SQLite)", () => {
  let moduleRef: TestingModule;
  let prisma: PrismaService;
  let placeBid: PlaceBidUseCase;

  const far = () => new Date(Date.now() + 24 * 3_600_000); // 마감 24시간 뒤

  beforeAll(async () => {
    moduleRef = await bootstrapE2E();
    prisma = moduleRef.get(PrismaService);
    placeBid = moduleRef.get(PlaceBidUseCase);
  });

  afterAll(async () => {
    await moduleRef.close();
  });

  beforeEach(async () => {
    await resetDb(prisma);
  });

  it("debits the bidder and appends one BID ledger entry in a single tx", async () => {
    await createUser(prisma, { id: 1, balance: 10_000 });
    await createAuction(prisma, { id: "A-2026-901", startPrice: 5_000, endsAt: far() });

    const r = await placeBid.execute({ auctionId: "A-2026-901", userId: 1, amount: 5_200 });

    expect(r.newHighest).toBe(5_200n);
    expect(r.refundedTo).toBeNull();
    expect(await balanceOf(prisma, 1)).toBe(4_800n);
    expect(await ledgerOf(prisma, 1)).toEqual([{ actionType: "BID", amount: -5_200n }]);

    const a = await prisma.auction.findUnique({ where: { id: "A-2026-901" } });
    expect(a?.highest).toBe(5_200n);
    expect(a?.highestBidder).toBe(1n);
    expect(a?.bidCount).toBe(1);
  });

  it("auto-refunds the previous leader and keeps the original BID (Insert-Only)", async () => {
    await createUser(prisma, { id: 1, balance: 10_000 });
    await createUser(prisma, { id: 2, balance: 10_000 });
    await createAuction(prisma, { id: "A-2026-902", startPrice: 5_000, endsAt: far() });

    await placeBid.execute({ auctionId: "A-2026-902", userId: 1, amount: 5_200 });
    const r2 = await placeBid.execute({ auctionId: "A-2026-902", userId: 2, amount: 5_400 });

    expect(r2.refundedTo).toBe(1n);
    expect(r2.refundedAmount).toBe(5_200n);
    // 1번은 환불받아 원복, 2번은 차감.
    expect(await balanceOf(prisma, 1)).toBe(10_000n);
    expect(await balanceOf(prisma, 2)).toBe(4_600n);
    // 원래 BID(-5200)는 그대로 남고 REFUND(+5200)가 *새 행*으로 추가 (UPDATE/DELETE 아님).
    expect(await ledgerOf(prisma, 1)).toEqual([
      { actionType: "BID", amount: -5_200n },
      { actionType: "REFUND", amount: 5_200n },
    ]);
  });

  it("rolls back the whole tx when the bidder has insufficient points", async () => {
    await createUser(prisma, { id: 1, balance: 100 }); // 부족
    await createAuction(prisma, { id: "A-2026-903", startPrice: 5_000, endsAt: far() });

    await expect(
      placeBid.execute({ auctionId: "A-2026-903", userId: 1, amount: 5_200 }),
    ).rejects.toThrow();

    // 잔액·원장·경매 모두 입찰 전 상태 그대로.
    expect(await balanceOf(prisma, 1)).toBe(100n);
    expect(await ledgerOf(prisma, 1)).toEqual([]);
    const a = await prisma.auction.findUnique({ where: { id: "A-2026-903" } });
    expect(a?.highest).toBe(5_000n);
    expect(a?.bidCount).toBe(0);
  });

  it("extends the deadline (anti-snipe, CUT-5) and persists it when a bid lands in the window", async () => {
    await createUser(prisma, { id: 1, balance: 10_000 });
    const soon = new Date(Date.now() + 60_000); // 마감 1분 뒤 = 5분 창 안
    await createAuction(prisma, { id: "A-2026-904", startPrice: 5_000, endsAt: soon });

    const before = soon.getTime();
    const r = await placeBid.execute({ auctionId: "A-2026-904", userId: 1, amount: 5_200 });

    expect(r.extended).toBe(true);
    expect(r.endsAt.getTime()).toBeGreaterThan(before);
    // DB에도 연장된 마감이 반영돼야 자동정산 스케줄러가 새 마감을 따른다.
    const a = await prisma.auction.findUnique({ where: { id: "A-2026-904" } });
    expect(a!.endsAt.getTime()).toBeGreaterThan(before);
    expect(a!.endsAt.getTime()).toBe(r.endsAt.getTime());
  });

  it("does NOT extend when the bid is well before the deadline", async () => {
    await createUser(prisma, { id: 1, balance: 10_000 });
    await createAuction(prisma, { id: "A-2026-905", startPrice: 5_000, endsAt: far() });

    const r = await placeBid.execute({ auctionId: "A-2026-905", userId: 1, amount: 5_200 });
    expect(r.extended).toBe(false);
  });
});
