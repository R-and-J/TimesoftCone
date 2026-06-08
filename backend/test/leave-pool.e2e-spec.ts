// 연말 풀 수집/점진 발행 통합 테스트 (ADR-017, 2026-06-02 결정).
// 실 SQLite에 REGULAR leave_balance를 깔고:
//   1) CollectLeavePoolUseCase가 stake + supply만 적재(매물 X).
//   2) ReleaseInventoryUseCase가 ReleasePolicy 회차마다 supply에서 N개 빼서 매물 생성.
import type { TestingModule } from "@nestjs/testing";
import { CollectLeavePoolUseCase } from "@/application/leave-pool/collect-leave-pool.use-case";
import { ReleaseInventoryUseCase } from "@/application/leave-pool/release-inventory.use-case";
import { PrismaService } from "@/adapters/persistence/prisma.service";
import { bootstrapE2E, createLeave, createUser, resetDb } from "./e2e-utils";

describe("LeavePool (collect + release, integration)", () => {
  let moduleRef: TestingModule;
  let prisma: PrismaService;
  let collect: CollectLeavePoolUseCase;
  let release: ReleaseInventoryUseCase;

  beforeAll(async () => {
    moduleRef = await bootstrapE2E();
    prisma = moduleRef.get(PrismaService);
    collect = moduleRef.get(CollectLeavePoolUseCase);
    release = moduleRef.get(ReleaseInventoryUseCase);
  });

  afterAll(async () => {
    await moduleRef.close();
  });

  beforeEach(async () => {
    await resetDb(prisma);
  });

  it("collect: REGULAR unused → stake + supply (no auctions yet)", async () => {
    await createUser(prisma, { id: 1, name: "기여A" });
    await createUser(prisma, { id: 2, name: "기여B" });
    await createUser(prisma, { id: 3, name: "신규입사" });
    await createLeave(prisma, { userId: 1, year: 2026, granted: 3, used: 0 }); // 3
    await createLeave(prisma, { userId: 2, year: 2026, granted: 5, used: 2 }); // 3
    await createLeave(prisma, { userId: 3, year: 2026, granted: 0, used: 0 }); // 0
    await createLeave(prisma, { userId: 1, year: 2026, leaveType: "AUCTION", granted: 10 });

    const r = await collect.execute({ sourceYear: 2026 });

    expect(r.targetYear).toBe(2027);
    expect(r.contributorCount).toBe(2);
    expect(r.daysCollected).toBe(6);

    // 매물은 아직 0개 — 점진 발행이라 release가 만들어내야 함.
    const auctionCount = await prisma.auction.count({ where: { id: { startsWith: "A-2027-" } } });
    expect(auctionCount).toBe(0);

    // Stake 적재.
    const stakes = await prisma.stake.findMany({
      where: { year: 2027 },
      orderBy: { userId: "asc" },
      select: { userId: true, days: true },
    });
    expect(stakes).toEqual([
      { userId: 1n, days: 3 },
      { userId: 2n, days: 3 },
    ]);

    // Supply 적재 — 기여자별 잔여 = contributedDays.
    const supplies = await prisma.leavePoolSupply.findMany({
      where: { targetYear: 2027 },
      orderBy: { userId: "asc" },
      select: { userId: true, contributedDays: true, remainingDays: true },
    });
    expect(supplies).toEqual([
      { userId: 1n, contributedDays: 3, remainingDays: 3 },
      { userId: 2n, contributedDays: 3, remainingDays: 3 },
    ]);

    // 멱등 마커 — auctionsCreated는 발행 누적이라 초기엔 0.
    const run = await prisma.leavePoolRun.findUnique({
      where: { uq_pool_company_target: { companyId: 1n, targetYear: 2027 } },
    });
    expect(run?.daysCollected).toBe(6);
    expect(run?.auctionsCreated).toBe(0);
  });

  it("collect: idempotent — re-collecting the same target year is rejected (409)", async () => {
    await createUser(prisma, { id: 1, name: "기여A" });
    await createLeave(prisma, { userId: 1, year: 2026, granted: 2 });

    await collect.execute({ sourceYear: 2026 });
    await expect(collect.execute({ sourceYear: 2026 })).rejects.toThrow();
  });

  it("collect: dryRun previews without writing anything", async () => {
    await createUser(prisma, { id: 1, name: "기여A" });
    await createLeave(prisma, { userId: 1, year: 2026, granted: 4 });

    const r = await collect.execute({ sourceYear: 2026, dryRun: true });
    expect(r.daysCollected).toBe(4);

    expect(await prisma.leavePoolSupply.count()).toBe(0);
    expect(await prisma.stake.count()).toBe(0);
    expect(
      await prisma.leavePoolRun.findUnique({
        where: { uq_pool_company_target: { companyId: 1n, targetYear: 2027 } },
      }),
    ).toBeNull();
  });

  it("release: cadence=none → 한 번에 전부 풀어내기 (force)", async () => {
    await createUser(prisma, { id: 1, name: "A" });
    await createUser(prisma, { id: 2, name: "B" });
    await createLeave(prisma, { userId: 1, year: 2026, granted: 2 });
    await createLeave(prisma, { userId: 2, year: 2026, granted: 3 });
    await collect.execute({ sourceYear: 2026 });

    // 정책 기본은 'none' — 회차 한 번에 전부.
    const r = await release.execute({ sourceYear: 2026, force: true });
    expect(r.status).toBe("RELEASED");
    expect(r.released).toBe(5);
    expect(r.totalRemainingAfter).toBe(0);

    const auctions = await prisma.auction.findMany({
      where: { id: { startsWith: "A-2027-" } },
      orderBy: { id: "asc" },
    });
    expect(auctions).toHaveLength(5);
    expect(auctions.every((a) => a.status === "CREATED" && a.leaveDays === 1)).toBe(true);
    expect(auctions.every((a) => a.startPrice === 30000n)).toBe(true);

    // 같은 회차 재호출 → ALREADY_RELEASED.
    const r2 = await release.execute({ sourceYear: 2026, force: true });
    expect(r2.status).toBe("ALREADY_RELEASED");
    expect(await prisma.auction.count({ where: { id: { startsWith: "A-2027-" } } })).toBe(5);
  });

  it("release: supply가 비어 있으면 EMPTY", async () => {
    const r = await release.execute({ sourceYear: 2026, force: true });
    expect(r.status).toBe("EMPTY");
    expect(r.released).toBe(0);
  });
});
