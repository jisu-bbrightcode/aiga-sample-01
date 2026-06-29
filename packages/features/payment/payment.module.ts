/**
 * PaymentModule — conditional provider shell for the payment feature.
 *
 * Polar and INICIS are registered as independent provider modules. The shell
 * imports only the modules whose env is complete, so an INICIS-only deployment
 * does not evaluate Polar config and a Polar-only deployment does not require
 * INICIS merchant keys.
 *
 * Polar webhook note: `PolarWebhookController` is still registered manually in
 * `apps/server/src/main.ts` because signature verification needs the raw body.
 */

import { type DynamicModule, Inject, Module, type OnModuleInit } from "@nestjs/common";
import { ScheduleModule } from "@nestjs/schedule";
import { DRIZZLE, type DrizzleDB } from "@repo/drizzle";
import {
  isPolarPaymentConfigured,
  loadPaymentConfig,
  type PaymentConfig,
} from "./config/payment.config";
import { isAnyPaymentConfigured } from "./config/provider.config";
import {
  InicisAdminController,
  InicisOrderPublicController,
  InicisPublicController,
  InicisWebhookController,
  PaymentAdminController,
  PaymentController,
  PaymentPublicController,
} from "./controller";
import { PolarWebhookController } from "./controller/public/polar-webhook.controller";
import { InicisPaymentService } from "./inicis/inicis.service";
import { isInicisPaymentConfigured } from "./inicis/src/config";
import { DataPurgeCron } from "./scheduler/data-purge.cron";
import { DunningCron } from "./scheduler/dunning.cron";
import { PendingPlanChangeCron } from "./scheduler/pending-plan-change.cron";
import { ReconcileCron } from "./scheduler/reconcile.cron";
import { UsageReserveCron } from "./scheduler/usage-reserve.cron";
import { AiUsageMeterService } from "./service/ai-usage-meter.service";
import { AuditService } from "./service/audit.service";
import { AutoRechargeService } from "./service/auto-recharge.service";
import { CouponService } from "./service/coupon.service";
import { CreditLedgerService } from "./service/credit-ledger.service";
import { DeferredEventLoggerService } from "./service/deferred-event-logger.service";
import { DunningService } from "./service/dunning.service";
import { ExtraUsageService } from "./service/extra-usage.service";
import { NotificationService } from "./service/notification.service";
import { OrderMirrorService } from "./service/order-mirror.service";
import { PolarAdapter } from "./service/polar.adapter";
import { SubscriptionService } from "./service/subscription.service";
import { UsageNotificationService } from "./service/usage-notification.service";
import { WebhookRetryService } from "./service/webhook-retry.service";
import { injectPaymentServices } from "./service-registry";
import { PolarWebhookDispatcher } from "./webhooks/polar.webhook.dispatcher";

const PAYMENT_CONFIG = "PAYMENT_CONFIG" as const;

@Module({
  imports: [ScheduleModule.forRoot()],
  controllers: [PaymentPublicController, PaymentController, PaymentAdminController],
  providers: [
    // ── config ────────────────────────────────────────────────────
    {
      provide: PAYMENT_CONFIG,
      useFactory: (): PaymentConfig => loadPaymentConfig(),
    },

    // ── services ──────────────────────────────────────────────────
    {
      provide: AiUsageMeterService,
      useFactory: (db: DrizzleDB) => new AiUsageMeterService(db),
      inject: [DRIZZLE],
    },
    {
      provide: ExtraUsageService,
      useFactory: (db: DrizzleDB) => new ExtraUsageService(db),
      inject: [DRIZZLE],
    },
    {
      provide: UsageNotificationService,
      useFactory: (db: DrizzleDB) => new UsageNotificationService(db),
      inject: [DRIZZLE],
    },
    {
      provide: AutoRechargeService,
      useFactory: (db: DrizzleDB, polar: PolarAdapter) => new AutoRechargeService(db, polar),
      inject: [DRIZZLE, PolarAdapter],
    },
    {
      provide: PolarAdapter,
      useFactory: (cfg: PaymentConfig) => new PolarAdapter(cfg),
      inject: [PAYMENT_CONFIG],
    },
    {
      provide: NotificationService,
      useFactory: () =>
        new NotificationService({
          apiKey: process.env.RESEND_API_KEY ?? "",
          from: process.env.RESEND_FROM ?? "noreply@example.com",
        }),
    },
    {
      provide: AuditService,
      useFactory: (db: DrizzleDB) => new AuditService(db),
      inject: [DRIZZLE],
    },
    {
      provide: CreditLedgerService,
      useFactory: (db: DrizzleDB) => new CreditLedgerService(db),
      inject: [DRIZZLE],
    },
    {
      provide: SubscriptionService,
      useFactory: (db: DrizzleDB, polar: PolarAdapter, audit: AuditService) =>
        new SubscriptionService(db, polar, audit),
      inject: [DRIZZLE, PolarAdapter, AuditService],
    },
    {
      provide: DunningService,
      useFactory: (db: DrizzleDB, notif: NotificationService, audit: AuditService) =>
        new DunningService(db, { notif, audit }),
      inject: [DRIZZLE, NotificationService, AuditService],
    },
    {
      provide: CouponService,
      useFactory: (db: DrizzleDB, polar: PolarAdapter, audit: AuditService) =>
        new CouponService(db, { polarAdapter: polar, audit }),
      inject: [DRIZZLE, PolarAdapter, AuditService],
    },
    {
      provide: OrderMirrorService,
      useFactory: (db: DrizzleDB, sub: SubscriptionService) => new OrderMirrorService(db, sub),
      inject: [DRIZZLE, SubscriptionService],
    },
    {
      provide: DeferredEventLoggerService,
      useFactory: (db: DrizzleDB) => new DeferredEventLoggerService(db),
      inject: [DRIZZLE],
    },

    // ── webhook plumbing ──────────────────────────────────────────
    {
      provide: PolarWebhookDispatcher,
      // biome-ignore lint/complexity/useMaxParams: NestJS provider factory wires feature services into one dispatcher.
      useFactory: (
        sub: SubscriptionService,
        ledger: CreditLedgerService,
        dunning: DunningService,
        coupon: CouponService,
        notif: NotificationService,
        orderMirror: OrderMirrorService,
        deferredLogger: DeferredEventLoggerService,
        autoRecharge: AutoRechargeService,
      ) =>
        new PolarWebhookDispatcher({
          subSvc: sub,
          ledger,
          dunning,
          coupon,
          notif,
          orderMirror,
          deferredLogger,
          autoRecharge,
        }),
      inject: [
        SubscriptionService,
        CreditLedgerService,
        DunningService,
        CouponService,
        NotificationService,
        OrderMirrorService,
        DeferredEventLoggerService,
        AutoRechargeService,
      ],
    },
    {
      provide: WebhookRetryService,
      useFactory: (db: DrizzleDB, dispatcher: PolarWebhookDispatcher) =>
        new WebhookRetryService(db, dispatcher),
      inject: [DRIZZLE, PolarWebhookDispatcher],
    },
    {
      provide: PolarWebhookController,
      useFactory: (cfg: PaymentConfig, dispatcher: PolarWebhookDispatcher) =>
        new PolarWebhookController(cfg.webhookSecret, dispatcher),
      inject: [PAYMENT_CONFIG, PolarWebhookDispatcher],
    },

    // ── crons (registered via @Cron decorators) ───────────────────
    DunningCron,
    DataPurgeCron,
    ReconcileCron,
    {
      provide: PendingPlanChangeCron,
      useFactory: (db: DrizzleDB, polar: PolarAdapter, audit: AuditService) =>
        new PendingPlanChangeCron(db, polar, 100, audit),
      inject: [DRIZZLE, PolarAdapter, AuditService],
    },
    {
      provide: UsageReserveCron,
      useFactory: (db: DrizzleDB) => new UsageReserveCron(db),
      inject: [DRIZZLE],
    },
  ],
  exports: [
    AiUsageMeterService,
    PolarAdapter,
    CreditLedgerService,
    SubscriptionService,
    CouponService,
    AuditService,
    NotificationService,
    DunningService,
    PolarWebhookDispatcher,
    PolarWebhookController,
  ],
})
export class PolarPaymentProviderModule implements OnModuleInit {
  // biome-ignore lint/complexity/useMaxParams: NestJS DI constructor for payment feature service bridge.
  constructor(
    @Inject(PolarAdapter) private readonly polar: PolarAdapter,
    @Inject(CreditLedgerService) private readonly ledger: CreditLedgerService,
    @Inject(SubscriptionService) private readonly subscription: SubscriptionService,
    @Inject(DunningService) private readonly dunning: DunningService,
    @Inject(CouponService) private readonly coupon: CouponService,
    @Inject(NotificationService) private readonly notification: NotificationService,
    @Inject(AuditService) private readonly audit: AuditService,
    @Inject(AiUsageMeterService) private readonly aiUsageMeter: AiUsageMeterService,
    @Inject(ExtraUsageService) private readonly extraUsage: ExtraUsageService,
    @Inject(AutoRechargeService) private readonly autoRecharge: AutoRechargeService,
  ) {}

  onModuleInit(): void {
    injectPaymentServices({
      polar: this.polar,
      subscription: this.subscription,
      creditLedger: this.ledger,
      coupon: this.coupon,
      dunning: this.dunning,
      notification: this.notification,
      audit: this.audit,
      aiUsageMeter: this.aiUsageMeter,
      extraUsage: this.extraUsage,
      autoRecharge: this.autoRecharge,
    });
  }
}

@Module({
  controllers: [
    InicisPublicController,
    InicisOrderPublicController,
    InicisWebhookController,
    InicisAdminController,
  ],
  providers: [
    {
      provide: InicisPaymentService,
      useFactory: (db: DrizzleDB) => new InicisPaymentService(db),
      inject: [DRIZZLE],
    },
    {
      provide: AuditService,
      useFactory: (db: DrizzleDB) => new AuditService(db),
      inject: [DRIZZLE],
    },
  ],
  exports: [InicisPaymentService],
})
export class InicisPaymentProviderModule {}

@Module({})
// biome-ignore lint/complexity/noStaticOnlyClass: NestJS dynamic module shell exposes static forRoot/isConfigured.
export class PaymentModule {
  static forRoot(env: NodeJS.ProcessEnv = process.env): DynamicModule {
    const imports: Array<typeof PolarPaymentProviderModule | typeof InicisPaymentProviderModule> =
      [];
    if (isPolarPaymentConfigured(env)) imports.push(PolarPaymentProviderModule);
    if (isInicisPaymentConfigured(env)) imports.push(InicisPaymentProviderModule);

    return {
      module: PaymentModule,
      imports,
      exports: imports,
    };
  }

  static isConfigured(env: NodeJS.ProcessEnv = process.env): boolean {
    return isAnyPaymentConfigured(env);
  }
}
