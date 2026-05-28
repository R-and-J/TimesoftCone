// 통합 테스트 공용 헬퍼 — 실제 AppModule(=실제 Prisma 어댑터/UnitOfWork/이벤트버스)을
// 임시 SQLite DB에 대고 띄우고, fixture를 직접 INSERT한 뒤 유스케이스를 호출한다.
import { Test, type TestingModule } from "@nestjs/testing";
import { AppModule } from "@/app.module";
import { PrismaService } from "@/adapters/persistence/prisma.service";

export const CURRENCY = "WELFARE_POINT";

export async function bootstrapE2E(): Promise<TestingModule> {
  const moduleRef = await Test.createTestingModule({
    imports: [AppModule],
  }).compile();
  // init()으로 onModuleInit 라이프사이클 실행(Prisma $connect 등). 스케줄러는
  // env-e2e에서 꺼놨으므로 타이머가 생기지 않는다.
  await moduleRef.init();
  return moduleRef;
}

/**
 * 테스트 간 격리 — 모든 테이블을 FK 의존 순서로 비운다.
 *
 * ledger_entry는 insert-only 트리거(DB-RULE-1)로 DELETE가 막혀 있어서, 리셋
 * 동안에만 delete 트리거를 잠깐 내렸다 곧바로 복구한다 — 유스케이스가 도는
 * 동안에는 insert-only가 그대로 살아있다.
 */
export async function resetDb(prisma: PrismaService): Promise<void> {
  await prisma.$executeRawUnsafe('DROP TRIGGER IF EXISTS "ledger_entry_no_delete"');
  try {
    await prisma.bidEvent.deleteMany();
    await prisma.ledgerEntry.deleteMany();
    await prisma.leaveBalance.deleteMany();
    await prisma.notification.deleteMany();
    await prisma.wallet.deleteMany();
    await prisma.auction.deleteMany();
    await prisma.user.deleteMany();
  } finally {
    await prisma.$executeRawUnsafe(
      `CREATE TRIGGER "ledger_entry_no_delete"
       BEFORE DELETE ON "ledger_entry"
       BEGIN
         SELECT RAISE(ABORT, 'DB-RULE-1: ledger_entry is INSERT-ONLY. DELETE blocked. Use a compensating INSERT (REFUND / CREDIT_ADMIN).');
       END`,
    );
  }
}

export async function createUser(
  prisma: PrismaService,
  opts: {
    id: number | bigint;
    name?: string;
    balance?: number | bigint;
    contributedDays?: number;
    role?: "EMPLOYEE" | "ADMIN";
  },
): Promise<void> {
  const id = BigInt(opts.id);
  await prisma.user.create({
    data: {
      id,
      empId: `E2E-${id}`,
      name: opts.name ?? `User ${id}`,
      email: `u${id}@e2e.test`,
      role: opts.role ?? "EMPLOYEE",
      contributedDays: opts.contributedDays ?? 0,
    },
  });
  if (opts.balance !== undefined) {
    await prisma.wallet.create({
      data: { userId: id, currency: CURRENCY, balance: BigInt(opts.balance) },
    });
  }
}

export async function createAuction(
  prisma: PrismaService,
  opts: {
    id: string;
    startPrice: number | bigint;
    endsAt: Date;
    minIncrement?: number | bigint;
    leaveDays?: number;
    status?: string;
    startedAt?: Date;
  },
): Promise<void> {
  await prisma.auction.create({
    data: {
      id: opts.id,
      status: opts.status ?? "OPEN",
      startPrice: BigInt(opts.startPrice),
      highest: BigInt(opts.startPrice),
      minIncrement: BigInt(opts.minIncrement ?? 100),
      leaveDays: opts.leaveDays ?? 1,
      startedAt: opts.startedAt ?? new Date(Date.now() - 3_600_000),
      endsAt: opts.endsAt,
    },
  });
}

export async function balanceOf(
  prisma: PrismaService,
  userId: number | bigint,
): Promise<bigint> {
  const w = await prisma.wallet.findUnique({
    where: {
      uq_wallet_user_currency: { userId: BigInt(userId), currency: CURRENCY },
    },
  });
  return w?.balance ?? 0n;
}

export async function ledgerOf(
  prisma: PrismaService,
  userId: number | bigint,
): Promise<{ actionType: string; amount: bigint }[]> {
  const rows = await prisma.ledgerEntry.findMany({
    where: { userId: BigInt(userId) },
    orderBy: { id: "asc" },
    select: { actionType: true, amount: true },
  });
  return rows;
}
