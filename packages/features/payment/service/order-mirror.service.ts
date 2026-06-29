/**
 * OrderMirrorService — keeps payment_orders in sync with Polar order events.
 *
 * Spec §3.2 item M: auth.router.ts:357 already lists from payment_orders
 * but no upsert path existed from the dispatcher. Called by the dispatcher
 * on order.paid (insert) and order.refunded (update).
 *
 * Idempotent on polar_order_id (UNIQUE in schema → onConflictDoUpdate).
 *
 * INV-7: payment_orders requires packageId OR subscriptionId. For subscription
 * orders we set subscriptionId from the SubscriptionService lookup; for top-up
 * orders we'd need package lookup (deferred to a future task — top-up rows
 * are skipped silently here).
 */
import { eq } from "drizzle-orm";
import { type DrizzleDB, paymentOrders } from "@repo/drizzle";

import {
  polarOrderPaidDataSchema,
  polarOrderRefundedDataSchema,
} from "../webhooks/polar.payload.schema";
import type { SubscriptionService } from "./subscription.service";

interface PolarEnvelope {
  type: string;
  data: Record<string, unknown>;
}

export class OrderMirrorService {
  constructor(
    private readonly db: DrizzleDB,
    private readonly subSvc: SubscriptionService,
  ) {}

  async upsertFromOrderPaid(envelope: PolarEnvelope): Promise<void> {
    const d = polarOrderPaidDataSchema.parse(envelope.data);
    const meta = d.metadata ?? {};
    const orgId = meta.organization_id ?? "";
    const userId = meta.user_id ?? "";

    if (!orgId || !userId) {
      // Forward-compat: order without our metadata (e.g. Polar dashboard
      // manual order). Don't crash the webhook.
      return;
    }

    let subscriptionId: string | null = null;
    if (d.subscription_id) {
      const sub = await this.subSvc.findByPolarId(d.subscription_id);
      subscriptionId = sub?.id ?? null;
    }

    if (!subscriptionId) {
      // INV-7 requires packageId OR subscriptionId. Top-up package lookup
      // is deferred — skip silently for now.
      return;
    }

    const currency = d.currency.toUpperCase();
    await this.db
      .insert(paymentOrders)
      .values({
        polarOrderId: d.id,
        organizationId: orgId,
        userId,
        subscriptionId,
        // gross charged (post-tax) — matches user-facing receipt amount.
        amountCents: d.total_amount,
        currency,
        status: "paid",
        refundedAmountCents: 0,
      })
      .onConflictDoUpdate({
        target: paymentOrders.polarOrderId,
        set: {
          status: "paid",
          amountCents: d.total_amount,
          currency,
        },
      });
  }

  async upsertFromOrderRefunded(envelope: PolarEnvelope): Promise<void> {
    const d = polarOrderRefundedDataSchema.parse(envelope.data);
    await this.db
      .update(paymentOrders)
      .set({
        status: d.status,
        refundedAmountCents: d.refunded_amount,
      })
      .where(eq(paymentOrders.polarOrderId, d.id));
  }

  /**
   * Resolve the owning organization for a polar order id from the mirrored
   * payment_orders row. Used by the refund handler when the refund payload's
   * metadata is empty (Polar's top-level correlation case — spec §3.2 N).
   */
  async getOrganizationByPolarOrderId(
    polarOrderId: string,
  ): Promise<string | undefined> {
    const rows = await this.db
      .select({ organizationId: paymentOrders.organizationId })
      .from(paymentOrders)
      .where(eq(paymentOrders.polarOrderId, polarOrderId))
      .limit(1);
    return rows[0]?.organizationId;
  }
}
