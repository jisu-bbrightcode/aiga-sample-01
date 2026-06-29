/**
 * Re-exports the credit-ledger reason enum values from the drizzle schema so
 * service code can import a single canonical list. Keep the source of truth
 * in `@repo/drizzle` — this file is purely a convenience surface.
 */

import { paymentCreditLedgerReasonEnum } from "@repo/drizzle";

export const CREDIT_REASONS = paymentCreditLedgerReasonEnum.enumValues;
export type CreditReason = (typeof CREDIT_REASONS)[number];
