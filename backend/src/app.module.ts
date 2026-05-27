// Composition root. Only file allowed to wire across all layers.

import { Module } from "@nestjs/common";
import { ConfigModule, ConfigService } from "@nestjs/config";
import { EventEmitterModule } from "@nestjs/event-emitter";

// Adapters
import { PrismaService } from "./adapters/persistence/prisma.service";
import { PrismaWalletRepository } from "./adapters/persistence/prisma-wallet.repository";
import { PrismaLedgerRepository } from "./adapters/persistence/prisma-ledger.repository";
import { PrismaAuctionRepository } from "./adapters/persistence/prisma-auction.repository";
import { PrismaUnitOfWork } from "./adapters/persistence/prisma-unit-of-work";
import { WelfarePointProvider } from "./adapters/currency/welfare-point.provider";
import { EzpassAuthProvider } from "./adapters/auth/ezpass-auth.provider";
import { LocalAuthProvider } from "./adapters/auth/local-auth.provider";
import { CompositeAuthProvider } from "./adapters/auth/composite-auth.provider";
import { MsaportalMemberDirectoryAdapter } from "./adapters/directory/msaportal-member-directory.adapter";
import { NotificationObserver } from "./adapters/notification/notification.observer";
import { SettleDueAuctionsScheduler } from "./adapters/scheduling/settle-due-auctions.scheduler";

// Use cases
import { GetWalletBalanceUseCase } from "./application/wallet/get-wallet-balance.use-case";
import { CreditWalletAdminUseCase } from "./application/wallet/credit-wallet-admin.use-case";
import { CreateAuctionUseCase } from "./application/auction/create-auction.use-case";
import { ListAuctionsUseCase } from "./application/auction/list-auctions.use-case";
import { GetAuctionDetailUseCase } from "./application/auction/get-auction-detail.use-case";
import { PlaceBidUseCase } from "./application/auction/place-bid.use-case";
import { SettleAuctionUseCase } from "./application/auction/settle-auction.use-case";
import { SettleDueAuctionsUseCase } from "./application/auction/settle-due-auctions.use-case";
import { ListMyActivityUseCase } from "./application/user/list-my-activity.use-case";
import { GetUserLeaveUseCase } from "./application/user/get-user-leave.use-case";
import { LoginUseCase } from "./application/auth/login.use-case";
import { GetAdminStatsUseCase } from "./application/admin/get-admin-stats.use-case";
import { ListLedgerUseCase } from "./application/admin/list-ledger.use-case";
import { ExportSettlementUseCase } from "./application/admin/export-settlement.use-case";
import { ListMembersUseCase } from "./application/admin/list-members.use-case";
import { SyncMembersUseCase } from "./application/admin/sync-members.use-case";
import { ManageMembersUseCase } from "./application/admin/manage-members.use-case";
import { ListNotificationsUseCase } from "./application/notification/list-notifications.use-case";
import { MarkNotificationsReadUseCase } from "./application/notification/mark-notifications-read.use-case";
import { GetMyDividendUseCase } from "./application/dividend/get-my-dividend.use-case";

// HTTP
import { WalletController } from "./interfaces/http/wallet.controller";
import { AdminWalletController } from "./interfaces/http/admin-wallet.controller";
import { AuctionsController } from "./interfaces/http/auctions.controller";
import { AdminAuctionsController } from "./interfaces/http/admin-auctions.controller";
import { MeController } from "./interfaces/http/me.controller";
import { AuthController } from "./interfaces/http/auth.controller";
import { AdminController } from "./interfaces/http/admin.controller";
import { AdminExportController } from "./interfaces/http/admin-export.controller";
import { AdminMembersController } from "./interfaces/http/admin-members.controller";
import { NotificationsController } from "./interfaces/http/notifications.controller";
import { DividendController } from "./interfaces/http/dividend.controller";

// Port symbols
import { BIDDING_CURRENCY } from "./ports/bidding-currency";
import { WALLET_REPOSITORY } from "./ports/wallet-repository";
import { LEDGER_REPOSITORY } from "./ports/ledger-repository";
import { AUCTION_REPOSITORY } from "./ports/auction-repository";
import { UNIT_OF_WORK } from "./ports/unit-of-work";
import { AUTH_PROVIDER } from "./ports/auth-provider";
import { MEMBER_DIRECTORY } from "./ports/member-directory";

@Module({
  imports: [ConfigModule.forRoot({ isGlobal: true }), EventEmitterModule.forRoot()],
  controllers: [
    AuthController,
    WalletController,
    AdminWalletController,
    AuctionsController,
    AdminAuctionsController,
    AdminController,
    AdminExportController,
    AdminMembersController,
    NotificationsController,
    DividendController,
    MeController,
  ],
  providers: [
    PrismaService,

    PrismaWalletRepository,
    PrismaLedgerRepository,
    PrismaAuctionRepository,
    PrismaUnitOfWork,
    WelfarePointProvider,
    EzpassAuthProvider,
    LocalAuthProvider,
    CompositeAuthProvider,
    MsaportalMemberDirectoryAdapter,
    NotificationObserver,

    { provide: WALLET_REPOSITORY, useExisting: PrismaWalletRepository },
    { provide: LEDGER_REPOSITORY, useExisting: PrismaLedgerRepository },
    { provide: AUCTION_REPOSITORY, useExisting: PrismaAuctionRepository },
    { provide: UNIT_OF_WORK, useExisting: PrismaUnitOfWork },
    { provide: BIDDING_CURRENCY, useExisting: WelfarePointProvider },
    // AUTH_MODE로 인증 어댑터 분기 (ADR-022): local → 순수 자체 비번,
    // 그 외(기본 ezpass) → Composite(로컬 비번 보유 계정은 로컬 검증, 나머지는 ezpass 위임).
    {
      provide: AUTH_PROVIDER,
      useFactory: (config: ConfigService, composite: CompositeAuthProvider, local: LocalAuthProvider) =>
        config.get<string>("AUTH_MODE") === "local" ? local : composite,
      inject: [ConfigService, CompositeAuthProvider, LocalAuthProvider],
    },
    { provide: MEMBER_DIRECTORY, useExisting: MsaportalMemberDirectoryAdapter },

    GetWalletBalanceUseCase,
    CreditWalletAdminUseCase,
    CreateAuctionUseCase,
    ListAuctionsUseCase,
    GetAuctionDetailUseCase,
    PlaceBidUseCase,
    SettleAuctionUseCase,
    SettleDueAuctionsUseCase,
    ListMyActivityUseCase,
    GetUserLeaveUseCase,
    LoginUseCase,
    GetAdminStatsUseCase,
    ListLedgerUseCase,
    ExportSettlementUseCase,
    ListMembersUseCase,
    SyncMembersUseCase,
    ManageMembersUseCase,
    ListNotificationsUseCase,
    MarkNotificationsReadUseCase,
    GetMyDividendUseCase,

    SettleDueAuctionsScheduler,
  ],
})
export class AppModule {}
