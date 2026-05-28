// FR-3.1 + FR-4.2 통합 테스트 — 실 SQLite에 leave_balance/auction을 깔고
// 우선순위 차감 / UNSOLD→EVENT / UNSOLD 청산을 DB 상태로 검증.
import type { TestingModule } from "@nestjs/testing";
import { UseLeaveUseCase } from "@/application/leave/use-leave.use-case";
import { GrantEventFromUnsoldUseCase } from "@/application/leave/grant-event-from-unsold.use-case";
import { PurgeUnsoldAuctionsUseCase } from "@/application/leave/purge-unsold-auctions.use-case";
import { PrismaService } from "@/adapters/persistence/prisma.service";
import {
  bootstrapE2E,
  createAuction,
  createLeave,
  createUser,
  resetDb,
} from "./e2e-utils";

const YEAR = 2026;

describe("Use leave / Grant event from unsold / Purge unsold (integration)", () => {
  let moduleRef: TestingModule;
  let prisma: PrismaService;
  let useLeave: UseLeaveUseCase;
  let grantEvent: GrantEventFromUnsoldUseCase;
  let purge: PurgeUnsoldAuctionsUseCase;

  beforeAll(async () => {
    moduleRef = await bootstrapE2E();
    prisma = moduleRef.get(PrismaService);
    useLeave = moduleRef.get(UseLeaveUseCase);
    grantEvent = moduleRef.get(GrantEventFromUnsoldUseCase);
    purge = moduleRef.get(PurgeUnsoldAuctionsUseCase);
  });

  afterAll(async () => {
    await moduleRef.close();
  });

  beforeEach(async () => {
    await resetDb(prisma);
  });

  // ── FR-3.1 ──────────────────────────────────────────────────────
  describe("FR-3.1 휴가 차감 우선순위", () => {
    it("deducts AUCTION first, then EVENT, then REGULAR (ADR-003 강제 우선순위)", async () => {
      await createUser(prisma, { id: 1 });
      // AUCTION 2일, EVENT 1일, REGULAR 10일 보유.
      await createLeave(prisma, { userId: 1, year: YEAR, leaveType: "AUCTION", granted: 2 });
      await createLeave(prisma, { userId: 1, year: YEAR, leaveType: "EVENT", granted: 1 });
      await createLeave(prisma, { userId: 1, year: YEAR, leaveType: "REGULAR", granted: 10 });

      const r = await useLeave.execute({ userId: 1, days: 5, year: YEAR });

      expect(r.consumed).toEqual({ AUCTION: 2, EVENT: 1, REGULAR: 2 });
      expect(r.remainingAfter).toEqual({ AUCTION: 0, EVENT: 0, REGULAR: 8 });

      // DB 직접 확인: usedDays가 타입별로 올바르게 증분.
      const rows = await prisma.leaveBalance.findMany({
        where: { userId: 1n, year: YEAR },
        select: { leaveType: true, usedDays: true },
        orderBy: { leaveType: "asc" },
      });
      expect(rows).toEqual([
        { leaveType: "AUCTION", usedDays: 2 },
        { leaveType: "EVENT", usedDays: 1 },
        { leaveType: "REGULAR", usedDays: 2 },
      ]);
    });

    it("rejects (409) when total remaining < requested — no rows changed", async () => {
      await createUser(prisma, { id: 1 });
      await createLeave(prisma, { userId: 1, year: YEAR, leaveType: "REGULAR", granted: 3 });

      await expect(useLeave.execute({ userId: 1, days: 5, year: YEAR })).rejects.toThrow();

      // 거부 후 leave_balance 변동 없음.
      const r = await prisma.leaveBalance.findFirst({ where: { userId: 1n, leaveType: "REGULAR" } });
      expect(r?.usedDays).toBe(0);
    });
  });

  // ── FR-4.2 part 1 ───────────────────────────────────────────────
  describe("FR-4.2 UNSOLD → EVENT 수동 지급", () => {
    it("converts an UNSOLD auction into EVENT leave for the recipient (auction row deleted)", async () => {
      await createUser(prisma, { id: 7, name: "수령자" });
      await createAuction(prisma, {
        id: "A-2026-921",
        startPrice: 5_000,
        endsAt: new Date(YEAR, 5, 1),
        status: "UNSOLD",
        leaveDays: 1,
      });

      const r = await grantEvent.execute({ auctionId: "A-2026-921", userId: 7 });
      expect(r).toEqual({ auctionId: "A-2026-921", userId: 7n, year: YEAR, days: 1 });

      // EVENT leave_balance에 +1, 경매 행은 영구 삭제(인벤토리 소진).
      const lb = await prisma.leaveBalance.findFirst({
        where: { userId: 7n, leaveType: "EVENT", year: YEAR },
      });
      expect(lb?.adjustedDays).toBe(1);
      const a = await prisma.auction.findUnique({ where: { id: "A-2026-921" } });
      expect(a).toBeNull();
    });

    it("rejects converting a non-UNSOLD auction (e.g. OPEN/AWARDED)", async () => {
      await createUser(prisma, { id: 7 });
      await createAuction(prisma, {
        id: "A-2026-922",
        startPrice: 5_000,
        endsAt: new Date(Date.now() + 3_600_000),
        status: "OPEN", // 진행 중
      });

      await expect(
        grantEvent.execute({ auctionId: "A-2026-922", userId: 7 }),
      ).rejects.toThrow();

      // 경매 그대로, leave_balance 변동 없음.
      const a = await prisma.auction.findUnique({ where: { id: "A-2026-922" } });
      expect(a?.status).toBe("OPEN");
      expect(await prisma.leaveBalance.count({ where: { userId: 7n, leaveType: "EVENT" } })).toBe(0);
    });
  });

  // ── FR-4.2 part 2 ───────────────────────────────────────────────
  describe("FR-4.2 UNSOLD 재고 영구 삭제", () => {
    it("deletes UNSOLD auctions up to the given year, leaves other statuses/years intact", async () => {
      // 섞인 상태로 깔기.
      // startedAt < endsAt 보장 (DB CHECK auction_time_ordering). 과거 연도는 startedAt도 과거.
      await createAuction(prisma, { id: "A-2025-001", startPrice: 5_000, startedAt: new Date(2025, 11, 24), endsAt: new Date(2025, 11, 31), status: "UNSOLD" });
      await createAuction(prisma, { id: "A-2026-101", startPrice: 5_000, startedAt: new Date(2026, 4, 25), endsAt: new Date(2026, 5, 1), status: "UNSOLD" });
      await createAuction(prisma, { id: "A-2026-102", startPrice: 5_000, startedAt: new Date(2026, 4, 25), endsAt: new Date(2026, 5, 1), status: "OPEN" });
      await createAuction(prisma, { id: "A-2027-001", startPrice: 5_000, startedAt: new Date(2027, 0, 1), endsAt: new Date(2027, 0, 8), status: "UNSOLD" });

      const r = await purge.execute({ upToYear: 2026 });
      expect(r.deleted).toBe(2); // A-2025-001 + A-2026-101

      const survivors = await prisma.auction.findMany({ orderBy: { id: "asc" }, select: { id: true } });
      expect(survivors.map((a) => a.id)).toEqual(["A-2026-102", "A-2027-001"]);
    });

    it("is safely re-runnable (idempotent — second call deletes nothing)", async () => {
      await createAuction(prisma, { id: "A-2026-201", startPrice: 5_000, endsAt: new Date(2026, 5, 1), status: "UNSOLD" });
      const r1 = await purge.execute({ upToYear: 2026 });
      const r2 = await purge.execute({ upToYear: 2026 });
      expect(r1.deleted).toBe(1);
      expect(r2.deleted).toBe(0);
    });
  });
});
