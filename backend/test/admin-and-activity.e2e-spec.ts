// FR-5.x + FR-2.2 UNSOLC 경로 통합 테스트.
//   - FR-5.1 관리자 포인트 적립 (CREDIT_ADMIN 원장 + reason 필수)
//   - FR-5.2 잔액·내역 조회 (ListMyActivity: 이력 + 요약 카운트)
//   - FR-2.2 UNSOLC: 입찰 없는 경매가 마감되면 UNSOLD 전이, 휴가 부여 없음, 에스크로 무변동
import type { TestingModule } from "@nestjs/testing";
import { CreditWalletAdminUseCase } from "@/application/wallet/credit-wallet-admin.use-case";
import { ListMyActivityUseCase } from "@/application/user/list-my-activity.use-case";
import { GetWalletBalanceUseCase } from "@/application/wallet/get-wallet-balance.use-case";
import { SettleAuctionUseCase } from "@/application/auction/settle-auction.use-case";
import { PlaceBidUseCase } from "@/application/auction/place-bid.use-case";
import { GetAdminStatsUseCase } from "@/application/admin/get-admin-stats.use-case";
import { PrismaService } from "@/adapters/persistence/prisma.service";
import {
  balanceOf,
  bootstrapE2E,
  createAuction,
  createUser,
  ledgerOf,
  resetDb,
} from "./e2e-utils";

describe("Admin credit / My activity / Settle UNSOLD (integration)", () => {
  let moduleRef: TestingModule;
  let prisma: PrismaService;
  let credit: CreditWalletAdminUseCase;
  let activity: ListMyActivityUseCase;
  let balance: GetWalletBalanceUseCase;
  let settle: SettleAuctionUseCase;
  let placeBid: PlaceBidUseCase;
  let stats: GetAdminStatsUseCase;

  const far = () => new Date(Date.now() + 24 * 3_600_000);

  beforeAll(async () => {
    moduleRef = await bootstrapE2E();
    prisma = moduleRef.get(PrismaService);
    credit = moduleRef.get(CreditWalletAdminUseCase);
    activity = moduleRef.get(ListMyActivityUseCase);
    balance = moduleRef.get(GetWalletBalanceUseCase);
    settle = moduleRef.get(SettleAuctionUseCase);
    placeBid = moduleRef.get(PlaceBidUseCase);
    stats = moduleRef.get(GetAdminStatsUseCase);
  });

  afterAll(async () => {
    await moduleRef.close();
  });

  beforeEach(async () => {
    await resetDb(prisma);
  });

  // ── FR-5.1 ────────────────────────────────────────────────────────
  describe("FR-5.1 관리자 포인트 적립", () => {
    it("credits wallet and writes a CREDIT_ADMIN ledger entry with reason", async () => {
      await createUser(prisma, { id: 1 });

      const r = await credit.execute({ userId: 1, amount: 12_345, reason: "분기 인센티브" });
      expect(r.newBalance).toBe(12_345n);

      // 잔액·원장 일관성.
      expect(await balanceOf(prisma, 1)).toBe(12_345n);
      const rows = await prisma.ledgerEntry.findMany({ where: { userId: 1n }, select: { actionType: true, amount: true, refNote: true } });
      expect(rows).toEqual([
        { actionType: "CREDIT_ADMIN", amount: 12_345n, refNote: "분기 인센티브" },
      ]);
    });

    it("rejects an empty / whitespace reason (audit 요구)", async () => {
      await createUser(prisma, { id: 1 });
      await expect(credit.execute({ userId: 1, amount: 100, reason: "" })).rejects.toThrow();
      await expect(credit.execute({ userId: 1, amount: 100, reason: "   " })).rejects.toThrow();
      // 거부됐으니 원장은 0행, 잔액 0.
      expect(await ledgerOf(prisma, 1)).toEqual([]);
      expect(await balanceOf(prisma, 1)).toBe(0n);
    });

    it("excludes CREDIT_ADMIN from escrow (NFR-2 등식 — 회사 적립금은 에스크로와 무관)", async () => {
      await createUser(prisma, { id: 1 });
      await credit.execute({ userId: 1, amount: 100_000, reason: "seed" });
      // 에스크로는 BID/WIN/REFUND/DIVIDEND만 — CREDIT_ADMIN은 제외돼야 함.
      expect((await stats.execute()).escrowBalance).toBe(0n);
    });
  });

  // ── FR-5.2 ────────────────────────────────────────────────────────
  describe("FR-5.2 잔액·내역 조회", () => {
    it("returns the latest balance after a bid (debit reflected immediately)", async () => {
      await createUser(prisma, { id: 1, balance: 10_000 });
      await createAuction(prisma, { id: "A-2026-801", startPrice: 5_000, endsAt: far() });
      await placeBid.execute({ auctionId: "A-2026-801", userId: 1, amount: 5_200 });

      const r = await balance.execute(1);
      expect(r.balance).toBe(4_800n);
    });

    it("ListMyActivity returns ordered ledger + correct summary counts", async () => {
      // 1이 입찰 → 2가 더 높게 입찰 → 1 환불(BID+REFUND), 2 차감(BID).
      await createUser(prisma, { id: 1, balance: 10_000 });
      await createUser(prisma, { id: 2, balance: 10_000 });
      await createAuction(prisma, { id: "A-2026-802", startPrice: 5_000, endsAt: far() });
      await placeBid.execute({ auctionId: "A-2026-802", userId: 1, amount: 5_200 });
      await placeBid.execute({ auctionId: "A-2026-802", userId: 2, amount: 5_400 });

      const a1 = await activity.execute(1);
      // 1번: BID(-5200) + REFUND(+5200) — 2건. 최신순.
      expect(a1.history.map((h) => h.actionType)).toEqual(["REFUND", "BID"]);
      expect(a1.summary).toEqual({
        totalBids: 1,
        totalWins: 0,
        totalRefunds: 1,
        activeAuctions: 0, // 더 이상 1이 최고가가 아님(2가 잡고 있음)
      });

      const a2 = await activity.execute(2);
      expect(a2.history.map((h) => h.actionType)).toEqual(["BID"]);
      expect(a2.summary).toEqual({
        totalBids: 1,
        totalWins: 0,
        totalRefunds: 0,
        activeAuctions: 1, // 2가 현재 최고가
      });
    });
  });

  // ── FR-2.2 UNSOLD 경로 ────────────────────────────────────────────
  describe("FR-2.2 UNSOLD (입찰 없는 경매 마감)", () => {
    it("settles a no-bid auction as UNSOLD — no leave grant, no escrow change", async () => {
      // 입찰자 없는 경매. endsAt을 과거로 당겨 정산 가능 상태로.
      await createAuction(prisma, {
        id: "A-2026-810",
        startPrice: 5_000,
        endsAt: new Date(Date.now() - 1_000),
        leaveDays: 2,
      });

      const r = await settle.execute("A-2026-810");
      expect(r.outcome).toBe("UNSOLD");
      expect(r.winnerId).toBeUndefined();

      // DB: 상태 UNSOLD, settledAt 기록, 입찰자/원장/연차 부여 없음.
      const a = await prisma.auction.findUnique({ where: { id: "A-2026-810" } });
      expect(a?.status).toBe("UNSOLD");
      expect(a?.settledAt).not.toBeNull();
      expect(a?.highestBidder).toBeNull();
      expect(await prisma.ledgerEntry.count({ where: { auctionId: "A-2026-810" } })).toBe(0);
      expect(await prisma.leaveBalance.count({ where: { leaveType: "AUCTION" } })).toBe(0);
      // 에스크로 변동 없음.
      expect((await stats.execute()).escrowBalance).toBe(0n);
    });
  });
});
