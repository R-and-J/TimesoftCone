// 정산 → 연말 배당 통합 테스트. 실제 입찰로 에스크로를 쌓고(=ADR-001 회사 예산 0),
// 경매를 낙찰 정산한 뒤(AUCTION 연차 적립 확인), 연말 배당 배치를 돌려
// NFR-2 등식(Σ배당 = 에스크로)·기여 지분 비례 분배·멱등성을 DB 상태로 검증한다.
import type { TestingModule } from "@nestjs/testing";
import { PlaceBidUseCase } from "@/application/auction/place-bid.use-case";
import { SettleAuctionUseCase } from "@/application/auction/settle-auction.use-case";
import { SettleYearEndDividendUseCase } from "@/application/dividend/settle-year-end-dividend.use-case";
import { GetAdminStatsUseCase } from "@/application/admin/get-admin-stats.use-case";
import { PrismaService } from "@/adapters/persistence/prisma.service";
import {
  balanceOf,
  bootstrapE2E,
  createAuction,
  createUser,
  resetDb,
} from "./e2e-utils";

describe("Settle → Year-end Dividend (integration, real SQLite)", () => {
  let moduleRef: TestingModule;
  let prisma: PrismaService;
  let placeBid: PlaceBidUseCase;
  let settle: SettleAuctionUseCase;
  let dividend: SettleYearEndDividendUseCase;
  let stats: GetAdminStatsUseCase;

  const far = () => new Date(Date.now() + 24 * 3_600_000);

  beforeAll(async () => {
    moduleRef = await bootstrapE2E();
    prisma = moduleRef.get(PrismaService);
    placeBid = moduleRef.get(PlaceBidUseCase);
    settle = moduleRef.get(SettleAuctionUseCase);
    dividend = moduleRef.get(SettleYearEndDividendUseCase);
    stats = moduleRef.get(GetAdminStatsUseCase);
  });

  afterAll(async () => {
    await moduleRef.close();
  });

  beforeEach(async () => {
    await resetDb(prisma);
  });

  it("settles an auction (AWARD + AUCTION leave grant) and pays year-end dividends s.t. Σ = escrow (NFR-2)", async () => {
    // 구매자 2명(입찰), 기여자 2명(연차 풀 기여 → 배당 대상).
    await createUser(prisma, { id: 1, name: "구매A", balance: 10_000 });
    await createUser(prisma, { id: 2, name: "구매B", balance: 10_000 });
    await createUser(prisma, { id: 11, name: "기여S1", balance: 0, contributedDays: 3 });
    await createUser(prisma, { id: 12, name: "기여S2", balance: 0, contributedDays: 1 });

    await createAuction(prisma, {
      id: "A-2026-911",
      startPrice: 5_000,
      endsAt: far(),
      leaveDays: 2,
    });

    // 입찰: A 5,200 → B 5,400 (A 자동환불). 에스크로엔 최고가 5,400만 남는다.
    await placeBid.execute({ auctionId: "A-2026-911", userId: 1, amount: 5_200 });
    await placeBid.execute({ auctionId: "A-2026-911", userId: 2, amount: 5_400 });
    expect((await stats.execute()).escrowBalance).toBe(5_400n);

    // 마감 시각을 과거로 당겨 정산 가능 상태로 만든 뒤 정산.
    await prisma.auction.update({
      where: { id: "A-2026-911" },
      data: { endsAt: new Date(Date.now() - 1_000) },
    });
    const s = await settle.execute("A-2026-911");
    expect(s.outcome).toBe("AWARDED");
    expect(s.winnerId).toBe(2n);

    // 낙찰자(2번)에게 AUCTION 연차 2일 적립 (같은 tx, 인바리언트 #6).
    const leave = await prisma.leaveBalance.findFirst({
      where: { userId: 2n, leaveType: "AUCTION" },
    });
    expect(leave?.adjustedDays).toBe(2);
    // WIN 원장은 audit-only(amount=0)라 에스크로 불변.
    expect((await stats.execute()).escrowBalance).toBe(5_400n);

    // ── 연말 배당: 기여 3:1 → floor(5400*3/4)=4050, floor(5400*1/4)=1350, 나머지 0.
    const d = await dividend.execute();
    expect(d.totalDistributed).toBe(5_400n);
    expect(d.escrowBalance).toBe(5_400n);
    expect(await balanceOf(prisma, 11)).toBe(4_050n);
    expect(await balanceOf(prisma, 12)).toBe(1_350n);

    // 지급 후 에스크로 정확히 0 (NFR-2: Σ배당 = 에스크로).
    expect((await stats.execute()).escrowBalance).toBe(0n);

    // DIVIDEND 원장이 기여자별로 적재됐는지.
    const divLedger = await prisma.ledgerEntry.findMany({
      where: { actionType: "DIVIDEND" },
      orderBy: { userId: "asc" },
      select: { userId: true, amount: true },
    });
    expect(divLedger).toEqual([
      { userId: 11n, amount: 4_050n },
      { userId: 12n, amount: 1_350n },
    ]);
  });

  it("is idempotent — a second settlement is rejected (no double payout)", async () => {
    await createUser(prisma, { id: 1, balance: 10_000 });
    await createUser(prisma, { id: 11, balance: 0, contributedDays: 5 });
    await createAuction(prisma, { id: "A-2026-912", startPrice: 5_000, endsAt: far() });
    await placeBid.execute({ auctionId: "A-2026-912", userId: 1, amount: 5_200 });

    await dividend.execute(); // 1차 지급
    expect(await balanceOf(prisma, 11)).toBe(5_200n);

    // 2차 호출은 거부(이미 DIVIDEND 원장 존재) → 잔액 변동 없음.
    await expect(dividend.execute()).rejects.toThrow();
    expect(await balanceOf(prisma, 11)).toBe(5_200n);
  });
});
