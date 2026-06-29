export const INICIS_PAYMENT_CAPABILITIES = [
  {
    id: "payment.inicis.config",
    source: "packages/features/payment/inicis/src/config.ts",
  },
  {
    id: "payment.inicis.checkout",
    source: "packages/features/payment/inicis/src/checkout.ts",
  },
  {
    id: "payment.inicis.approval",
    source: "packages/features/payment/inicis/src/approval.ts",
  },
  {
    id: "payment.inicis.noti",
    source: "packages/features/payment/inicis/src/noti.ts",
  },
  {
    id: "payment.inicis.cancel",
    source: "packages/features/payment/inicis/src/cancel.ts",
  },
  {
    id: "payment.inicis.inquiry",
    source: "packages/features/payment/inicis/src/inquiry.ts",
  },
  {
    id: "payment.inicis.billing.blocker",
    source: "packages/features/payment/inicis/src/billing.ts",
    status: "blocked",
    blocker: "inicis_billing_contract_unverified",
  },
  {
    id: "payment.inicis.vbank-refund.blocker",
    source: "packages/features/payment/inicis/src/cancel.ts",
    status: "blocked",
    blocker: "inicis_vbank_refund_account_encryption_unverified",
  },
  {
    id: "payment.inicis.admin",
    source: "apps/admin/src/features/payment/pages/inicis-page.tsx",
  },
] as const;

export type InicisPaymentCapabilityId = (typeof INICIS_PAYMENT_CAPABILITIES)[number]["id"];
