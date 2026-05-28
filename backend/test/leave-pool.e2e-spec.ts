// 연말 풀 수집 통합 테스트 (ADR-017). 실 SQLite에 REGULAR leave_balance를 깔고
// CollectLeavePoolUseCase를 돌려, 익년도 1일권 매물 생성 + Stake(contributedDays)
// 기록 + 멱등성(leave_pool_run)을 DB 상태로 검증한다.
import type { TestingModule } from "@nestjs/testing";
import { CollectLeavePoolUseCase } from "@/application/leave-pool/collect-leave-pool.use-case";
import { PrismaService } from "@/adapters/persistence/prisma.service";
import { bootstrapE2E, createLeave, createUser, resetDb } from "./e2e-utils";

describe("CollectLeavePool (integration, real SQLite)", () => {
  let moduleRef: TestingModule;
  let prisma: PrismaService;
  let collect: CollectLeavePoolUseCase;

  beforeAll(async () => {
    moduleRef = await bootstrapE2E();
    prisma = moduleRef.get(PrismaService);
    collect = moduleRef.get(CollectLeavePoolUseCase);
  });

  afterAll(async () => {
    await moduleRef.close();
  });

  beforeEach(async () => {
    await resetDb(prisma);
  });

  it("collects REGULAR unused → next-year 1-day auctions + stake (OP-2 1:1)", async () => {
    // remaining = granted + adjusted − used.
    await createUser(prisma, { id: 1, name: "기여A" });
    await createUser(prisma, { id: 2, name: "기여B" });
    await createUser(prisma, { id: 3, name: "신규입사" }); // 기여 0 → 제외
    await createLeave(prisma, { userId: 1, year: 2026, granted: 3, used: 0 }); // 3
    await createLeave(prisma, { userId: 2, year: 2026, granted: 5, used: 2 }); // 3
    await createLeave(prisma, { userId: 3, year: 2026, granted: 0, used: 0 }); // 0
    // AUCTION 잔액은 풀 대상 아님(ADR-002) — 섞여 있어도 무시돼야 함.
    await createLeave(prisma, { userId: 1, year: 2026, leaveType: "AUCTION", granted: 10 });

    const r = await collect.execute({ sourceYear: 2026 });

    expect(r.targetYear).toBe(2027);
    expect(r.contributorCount).toBe(2);
    expect(r.daysCollected).toBe(6);
    expect(r.auctionsCreated).toBe(6);

    // 익년도 1일권 매물 6개(CREATED).
    const auctions = await prisma.auction.findMany({
      where: { id: { startsWith: "A-2027-" } },
      orderBy: { id: "asc" },
    });
    expect(auctions).toHaveLength(6);
    expect(auctions.every((a) => a.status === "CREATED" && a.leaveDays === 1)).toBe(true);
    expect(auctions[0].id).toBe("A-2027-001");
    expect(auctions[5].id).toBe("A-2027-006");

    // Stake(contributedDays)가 기여자에 기록됨(배당이 소비).
    const u1 = await prisma.user.findUnique({ where: { id: 1n } });
    const u2 = await prisma.user.findUnique({ where: { id: 2n } });
    const u3 = await prisma.user.findUnique({ where: { id: 3n } });
    expect(u1?.contributedDays).toBe(3);
    expect(u2?.contributedDays).toBe(3);
    expect(u3?.contributedDays).toBe(0); // 기여 없음

    // 멱등 마커.
    const run = await prisma.leavePoolRun.findUnique({ where: { targetYear: 2027 } });
    expect(run?.daysCollected).toBe(6);
    expect(run?.auctionsCreated).toBe(6);
  });

  it("is idempotent — re-collecting the same target year is rejected (409)", async () => {
    await createUser(prisma, { id: 1, name: "기여A" });
    await createLeave(prisma, { userId: 1, year: 2026, granted: 2 });

    await collect.execute({ sourceYear: 2026 });
    await expect(collect.execute({ sourceYear: 2026 })).rejects.toThrow();

    // 매물은 2개 그대로(중복 생성 안 됨).
    const count = await prisma.auction.count({ where: { id: { startsWith: "A-2027-" } } });
    expect(count).toBe(2);
  });

  it("dryRun previews without creating auctions or a run marker", async () => {
    await createUser(prisma, { id: 1, name: "기여A" });
    await createLeave(prisma, { userId: 1, year: 2026, granted: 4 });

    const r = await collect.execute({ sourceYear: 2026, dryRun: true });
    expect(r.daysCollected).toBe(4);
    expect(r.auctionsCreated).toBe(4);

    expect(await prisma.auction.count({ where: { id: { startsWith: "A-2027-" } } })).toBe(0);
    expect(await prisma.leavePoolRun.findUnique({ where: { targetYear: 2027 } })).toBeNull();
    // 기여자 contributedDays도 아직 안 건드림.
    expect((await prisma.user.findUnique({ where: { id: 1n } }))?.contributedDays).toBe(0);
  });
});
