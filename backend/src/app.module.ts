// Composition root. Only file allowed to wire across all layers.

import { Module } from "@nestjs/common";
import { ConfigModule, ConfigService } from "@nestjs/config";
import { EventEmitterModule } from "@nestjs/event-emitter";
import { JwtModule } from "@nestjs/jwt";
import { APP_GUARD } from "@nestjs/core";

// Adapters
import { PrismaService } from "./adapters/persistence/prisma.service";
import { PrismaWalletRepository } from "./adapters/persistence/prisma-wallet.repository";
import { PrismaLedgerRepository } from "./adapters/persistence/prisma-ledger.repository";
import { PrismaAuctionRepository } from "./adapters/persistence/prisma-auction.repository";
import { PrismaUnitOfWork } from "./adapters/persistence/prisma-unit-of-work";
import { PrismaLeavePoolAdapter } from "./adapters/persistence/prisma-leave-pool.adapter";
import { PrismaLeaveAdminAdapter } from "./adapters/persistence/prisma-leave-admin.adapter";
import { PrismaReleasePolicyRepository } from "./adapters/persistence/prisma-release-policy.repository";
import { WelfarePointProvider } from "./adapters/currency/welfare-point.provider";
import { EzpassAuthProvider } from "./adapters/auth/ezpass-auth.provider";
import { LocalAuthProvider } from "./adapters/auth/local-auth.provider";
import { CompositeAuthProvider } from "./adapters/auth/composite-auth.provider";
import { MsaportalMemberDirectoryAdapter } from "./adapters/directory/msaportal-member-directory.adapter";
import { NotificationObserver } from "./adapters/notification/notification.observer";
import { HrLeaveClientAdapter } from "./adapters/hr/hr-leave.client";
import { EzpassHrLeaveClient } from "./adapters/hr/ezpass-hr-leave.client";
import { EzpassAdminTokenService } from "./adapters/auth/ezpass-admin-token.service";
import { InternalCatalogRedemption } from "./adapters/redemption/internal-catalog-redemption.adapter";
import { AuctionStream } from "./adapters/realtime/auction-stream";
import { SettleDueAuctionsScheduler } from "./adapters/scheduling/settle-due-auctions.scheduler";
import { OpenDueAuctionsScheduler } from "./adapters/scheduling/open-due-auctions.scheduler";
import { YearEndDividendScheduler } from "./adapters/scheduling/year-end-dividend.scheduler";
import { LeavePoolScheduler } from "./adapters/scheduling/leave-pool.scheduler";
import { PurgeUnsoldAuctionsScheduler } from "./adapters/scheduling/purge-unsold.scheduler";
import { OutboxRelayScheduler } from "./adapters/scheduling/outbox-relay.scheduler";

// Use cases
import { GetWalletBalanceUseCase } from "./application/wallet/get-wallet-balance.use-case";
import { CreditWalletAdminUseCase } from "./application/wallet/credit-wallet-admin.use-case";
import { CreateAuctionUseCase } from "./application/auction/create-auction.use-case";
import { OpenAuctionUseCase } from "./application/auction/open-auction.use-case";
import { ScheduleAuctionUseCase } from "./application/auction/schedule-auction.use-case";
import { OpenDueAuctionsUseCase } from "./application/auction/open-due-auctions.use-case";
import { CancelAuctionsUseCase } from "./application/auction/cancel-auctions.use-case";
import { GetAuctionsSummaryUseCase } from "./application/auction/get-auctions-summary.use-case";
import { GetNextAuctionIdUseCase } from "./application/auction/get-next-auction-id.use-case";
import { ExtendAuctionDeadlineUseCase } from "./application/auction/extend-auction-deadline.use-case";
import { CloseAuctionImmediatelyUseCase } from "./application/auction/close-auction-immediately.use-case";
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
import { ListRedemptionItemsUseCase } from "./application/redemption/list-redemption-items.use-case";
import { RedeemItemUseCase } from "./application/redemption/redeem-item.use-case";
import { ListMyRedemptionOrdersUseCase } from "./application/redemption/list-my-redemption-orders.use-case";
import { SubmitRedemptionRequestUseCase } from "./application/redemption/submit-redemption-request.use-case";
import { ApproveRedemptionRequestUseCase } from "./application/redemption/approve-redemption-request.use-case";
import { RejectRedemptionRequestUseCase } from "./application/redemption/reject-redemption-request.use-case";
import { ConfirmRedemptionReceivedUseCase } from "./application/redemption/confirm-redemption-received.use-case";
import { ListRedemptionRequestsUseCase } from "./application/redemption/list-redemption-requests.use-case";
import { GetRedemptionSummaryUseCase } from "./application/redemption/get-redemption-summary.use-case";
import { GetLeaveSyncReportUseCase } from "./application/leave-sync/get-leave-sync-report.use-case";
import { ReconcileUserLeaveUseCase } from "./application/leave-sync/reconcile-user-leave.use-case";
import { SubmitChargeRequestUseCase } from "./application/wallet/charge/submit-charge-request.use-case";
import { ApproveChargeRequestUseCase } from "./application/wallet/charge/approve-charge-request.use-case";
import { RejectChargeRequestUseCase } from "./application/wallet/charge/reject-charge-request.use-case";
import { ListChargeRequestsUseCase } from "./application/wallet/charge/list-charge-requests.use-case";
import { GetMyDividendUseCase } from "./application/dividend/get-my-dividend.use-case";
import { SettleYearEndDividendUseCase } from "./application/dividend/settle-year-end-dividend.use-case";
import { CollectLeavePoolUseCase } from "./application/leave-pool/collect-leave-pool.use-case";
import { GetReleasePolicyUseCase } from "./application/leave-pool/get-release-policy.use-case";
import { UpdateReleasePolicyUseCase } from "./application/leave-pool/update-release-policy.use-case";
import { UseLeaveUseCase } from "./application/leave/use-leave.use-case";
import { GrantEventFromUnsoldUseCase } from "./application/leave/grant-event-from-unsold.use-case";
import { PurgeUnsoldAuctionsUseCase } from "./application/leave/purge-unsold-auctions.use-case";

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
import { RedemptionController, UserRedemptionOrdersController } from "./interfaces/http/redemption.controller";
import { RedemptionRequestsController } from "./interfaces/http/redemption-requests.controller";
import { AdminRedemptionRequestsController } from "./interfaces/http/admin-redemption-requests.controller";
import { AdminLeaveSyncController } from "./interfaces/http/admin-leave-sync.controller";
import { WalletChargeController } from "./interfaces/http/wallet-charge.controller";
import { AdminChargesController } from "./interfaces/http/admin-charges.controller";
import { DividendController } from "./interfaces/http/dividend.controller";
import { AdminDividendController } from "./interfaces/http/admin-dividend.controller";
import { AdminLeavePoolController } from "./interfaces/http/admin-leave-pool.controller";
import { AdminReleasePolicyController } from "./interfaces/http/admin-release-policy.controller";
import { AdminLeaveController } from "./interfaces/http/admin-leave.controller";

// RBAC guards (전역)
import { JwtAuthGuard } from "./interfaces/http/auth/jwt-auth.guard";
import { RolesGuard } from "./interfaces/http/auth/roles.guard";
import { SelfOrAdminGuard } from "./interfaces/http/auth/self-or-admin.guard";

// Port symbols
import { BIDDING_CURRENCY } from "./ports/bidding-currency";
import { WALLET_REPOSITORY } from "./ports/wallet-repository";
import { LEDGER_REPOSITORY } from "./ports/ledger-repository";
import { AUCTION_REPOSITORY } from "./ports/auction-repository";
import { UNIT_OF_WORK } from "./ports/unit-of-work";
import { AUTH_PROVIDER } from "./ports/auth-provider";
import { MEMBER_DIRECTORY } from "./ports/member-directory";
import { HR_LEAVE_CLIENT } from "./ports/hr-leave-client.port";
import { REDEMPTION_CHANNEL } from "./ports/redemption-channel.port";
import { PAYOUT_CHANNEL } from "./ports/payout-channel";
import { AUCTION_STREAM } from "./ports/auction-stream.port";
import { LEAVE_POOL } from "./ports/leave-pool.port";
import { LEAVE_ADMIN } from "./ports/leave-admin.port";
import { RELEASE_POLICY } from "./ports/release-policy.port";

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    EventEmitterModule.forRoot(),
    // 자체 JWT(RBAC) — 비밀키/만료는 .env. 로그인이 서명, 가드가 검증.
    JwtModule.registerAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        secret: config.get<string>("JWT_SECRET") ?? "dev-only-change-me",
        signOptions: { expiresIn: config.get<string>("JWT_EXPIRES_IN") ?? "12h" },
      }),
    }),
  ],
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
    RedemptionController,
    UserRedemptionOrdersController,
    RedemptionRequestsController,
    AdminRedemptionRequestsController,
    AdminLeaveSyncController,
    WalletChargeController,
    AdminChargesController,
    DividendController,
    AdminDividendController,
    AdminLeavePoolController,
    AdminReleasePolicyController,
    AdminLeaveController,
    MeController,
  ],
  providers: [
    // 전역 가드 — 실행 순서는 등록 순서: 인증 → 역할 → 소유자.
    { provide: APP_GUARD, useClass: JwtAuthGuard },
    { provide: APP_GUARD, useClass: RolesGuard },
    { provide: APP_GUARD, useClass: SelfOrAdminGuard },

    PrismaService,

    PrismaWalletRepository,
    PrismaLedgerRepository,
    PrismaAuctionRepository,
    PrismaUnitOfWork,
    PrismaLeavePoolAdapter,
    PrismaLeaveAdminAdapter,
    PrismaReleasePolicyRepository,
    WelfarePointProvider,
    EzpassAuthProvider,
    LocalAuthProvider,
    CompositeAuthProvider,
    MsaportalMemberDirectoryAdapter,
    NotificationObserver,
    HrLeaveClientAdapter,
    EzpassAdminTokenService,
    EzpassHrLeaveClient,
    InternalCatalogRedemption,
    AuctionStream,
    { provide: AUCTION_STREAM, useExisting: AuctionStream },

    { provide: WALLET_REPOSITORY, useExisting: PrismaWalletRepository },
    { provide: LEDGER_REPOSITORY, useExisting: PrismaLedgerRepository },
    { provide: AUCTION_REPOSITORY, useExisting: PrismaAuctionRepository },
    { provide: UNIT_OF_WORK, useExisting: PrismaUnitOfWork },
    { provide: BIDDING_CURRENCY, useExisting: WelfarePointProvider },
    // 배당 지급 경로(ADR-008) — 입찰 통화와 같은 구현체가 ISP로 분리된 포트 제공.
    { provide: PAYOUT_CHANNEL, useExisting: WelfarePointProvider },
    { provide: LEAVE_POOL, useExisting: PrismaLeavePoolAdapter },
    { provide: LEAVE_ADMIN, useExisting: PrismaLeaveAdminAdapter },
    { provide: RELEASE_POLICY, useExisting: PrismaReleasePolicyRepository },
    // AUTH_MODE로 인증 어댑터 분기 (ADR-022): local → 순수 자체 비번,
    // 그 외(기본 ezpass) → Composite(로컬 비번 보유 계정은 로컬 검증, 나머지는 ezpass 위임).
    {
      provide: AUTH_PROVIDER,
      useFactory: (config: ConfigService, composite: CompositeAuthProvider, local: LocalAuthProvider) =>
        config.get<string>("AUTH_MODE") === "local" ? local : composite,
      inject: [ConfigService, CompositeAuthProvider, LocalAuthProvider],
    },
    { provide: MEMBER_DIRECTORY, useExisting: MsaportalMemberDirectoryAdapter },
    // HR_LEAVE_CLIENT_KIND env로 어댑터 스왑 (ADR-025 개정).
    //   ezpass → EzpassHrLeaveClient (정식 REST: selectUserYrycInfo + streYryc)
    //   그 외   → HrLeaveClientAdapter (mock 로그 OR HR_API_URL POST)
    {
      provide: HR_LEAVE_CLIENT,
      useFactory: (
        config: ConfigService,
        mock: HrLeaveClientAdapter,
        ezp: EzpassHrLeaveClient,
      ) => (config.get<string>("HR_LEAVE_CLIENT_KIND") === "ezpass" ? ezp : mock),
      inject: [ConfigService, HrLeaveClientAdapter, EzpassHrLeaveClient],
    },
    { provide: REDEMPTION_CHANNEL, useExisting: InternalCatalogRedemption },

    GetWalletBalanceUseCase,
    CreditWalletAdminUseCase,
    CreateAuctionUseCase,
    OpenAuctionUseCase,
    ScheduleAuctionUseCase,
    OpenDueAuctionsUseCase,
    CancelAuctionsUseCase,
    GetAuctionsSummaryUseCase,
    GetNextAuctionIdUseCase,
    ExtendAuctionDeadlineUseCase,
    CloseAuctionImmediatelyUseCase,
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
    ListRedemptionItemsUseCase,
    RedeemItemUseCase,
    ListMyRedemptionOrdersUseCase,
    SubmitRedemptionRequestUseCase,
    ApproveRedemptionRequestUseCase,
    RejectRedemptionRequestUseCase,
    ConfirmRedemptionReceivedUseCase,
    ListRedemptionRequestsUseCase,
    GetRedemptionSummaryUseCase,
    GetLeaveSyncReportUseCase,
    ReconcileUserLeaveUseCase,
    SubmitChargeRequestUseCase,
    ApproveChargeRequestUseCase,
    RejectChargeRequestUseCase,
    ListChargeRequestsUseCase,
    GetMyDividendUseCase,
    SettleYearEndDividendUseCase,
    CollectLeavePoolUseCase,
    GetReleasePolicyUseCase,
    UpdateReleasePolicyUseCase,
    UseLeaveUseCase,
    GrantEventFromUnsoldUseCase,
    PurgeUnsoldAuctionsUseCase,

    SettleDueAuctionsScheduler,
    OpenDueAuctionsScheduler,
    YearEndDividendScheduler,
    LeavePoolScheduler,
    PurgeUnsoldAuctionsScheduler,
    OutboxRelayScheduler,
  ],
})
export class AppModule {}
