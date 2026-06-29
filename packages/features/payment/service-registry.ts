import type { AiUsageMeterService } from "./service/ai-usage-meter.service";
import type { AuditService } from "./service/audit.service";
import type { AutoRechargeService } from "./service/auto-recharge.service";
import type { CouponService } from "./service/coupon.service";
import type { CreditLedgerService } from "./service/credit-ledger.service";
import type { DunningService } from "./service/dunning.service";
import type { ExtraUsageService } from "./service/extra-usage.service";
import type { NotificationService } from "./service/notification.service";
import type { PolarAdapter } from "./service/polar.adapter";
import type { SubscriptionService } from "./service/subscription.service";

export type PaymentServices = {
  polar: PolarAdapter;
  subscription: SubscriptionService;
  creditLedger: CreditLedgerService;
  coupon: CouponService;
  dunning: DunningService;
  notification: NotificationService;
  audit: AuditService;
  aiUsageMeter: AiUsageMeterService;
  extraUsage: ExtraUsageService;
  autoRecharge: AutoRechargeService;
};

let paymentServices: PaymentServices | undefined;

export const getPaymentServices = (): PaymentServices => {
  if (!paymentServices) {
    throw new Error("Payment services are not configured");
  }
  return paymentServices;
};

export const injectPaymentServices = (services: PaymentServices): void => {
  paymentServices = services;
};

export const resetPaymentServices = (): void => {
  paymentServices = undefined;
};
