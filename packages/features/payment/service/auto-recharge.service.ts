/**
 * AutoRechargeService — threshold trigger + advisory lock + webhook order.paid handler.
 *
 * spec §4.4 / T5.
 *
 * trigger():
 *   1. pre-tx validation — settings / package / active sub / comp_* 가드
 *   2. tx — pg_advisory_xact_lock(hashtext(orgId)) + inflight 검사 +
 *            monthly cap 검사 + pending row insert + audit log
 *   3. tx 밖 — Polar createCheckout (PR #62 plan-change v2 패턴)
 *
 * onOrderPaid():
 *   webhook 핸들러 — recharge_history.status='paid' + payment_usage_ledger insert
 *   (delta_cents=+amountCents, reason='auto_recharge') + cached_paid_balance update.
 *   단일 tx 멱등 (status='pending' 만 처리).
 */

import { Injectable } from "@nestjs/common";
import {
  type DrizzleDB,
  paymentAuditLog,
  paymentExtraUsageSettings,
  paymentRechargeHistory,
  paymentSubscriptions,
  paymentTopUpPackages,
  paymentUsageLedger,
} from "@repo/drizzle";
import { and, eq, sql } from "drizzle-orm";
import type { PolarAdapter } from "./polar.adapter";

@Injectable()
export class AutoRechargeService {
  constructor(
    private readonly db: DrizzleDB,
    private readonly polar?: PolarAdapter,
  ) {}

  async trigger(
    orgId: string,
    opts: { now?: Date } = {},
  ): Promise<{ rechargeHistoryId: string; checkoutUrl: string }> {
    const now = opts.now ?? new Date();
    if (!this.polar) throw new Error("AutoRechargeService requires PolarAdapter");

    // ── Step 1: pre-tx validation (settings + package + sub + comp_* 가드) ──
    const [settings] = await this.db
      .select()
      .from(paymentExtraUsageSettings)
      .where(eq(paymentExtraUsageSettings.organizationId, orgId))
      .limit(1);

    if (!settings?.autoRechargePackageId) {
      throw new Error("auto_recharge_package_not_configured");
    }

    const [pkg] = await this.db
      .select()
      .from(paymentTopUpPackages)
      .where(eq(paymentTopUpPackages.id, settings.autoRechargePackageId))
      .limit(1);

    if (!pkg?.polarProductId) {
      throw new Error(`package ${settings.autoRechargePackageId} missing polar product`);
    }

    const [sub] = await this.db
      .select()
      .from(paymentSubscriptions)
      .where(
        and(
          eq(paymentSubscriptions.organizationId, orgId),
          eq(paymentSubscriptions.status, "active"),
        ),
      )
      .limit(1);

    if (!sub) throw new Error("no_active_subscription");
    const polarSubscriptionId = sub.polarSubscriptionId;
    if (!polarSubscriptionId) throw new Error("active_subscription_missing_polar_id");
    if (polarSubscriptionId.startsWith("comp_")) {
      throw new Error(`AutoRecharge not supported for non-Polar subscription ${sub.id}`);
    }

    // ── Step 2: tx — advisory lock + inflight 검사 + cap 검사 + pending insert ──
    const txResult = await this.db.transaction(async (tx) => {
      // advisory lock — orgId 별 동시 trigger 차단
      await tx.execute(sql`SELECT pg_advisory_xact_lock(hashtext(${orgId}))`);

      // inflight 검사
      const [inflight] = await tx
        .select()
        .from(paymentRechargeHistory)
        .where(
          and(
            eq(paymentRechargeHistory.organizationId, orgId),
            eq(paymentRechargeHistory.status, "pending"),
          ),
        )
        .limit(1);
      if (inflight) throw new Error("auto_recharge_already_in_progress");

      // monthly cap 검사
      const cycleHistory = await tx
        .select()
        .from(paymentRechargeHistory)
        .where(
          and(
            eq(paymentRechargeHistory.organizationId, orgId),
            eq(paymentRechargeHistory.periodStart, sub.currentPeriodStart),
          ),
        );

      const countedStatuses = new Set(["paid", "pending"]);
      const completedCount = cycleHistory.filter((h) => countedStatuses.has(h.status)).length;

      if (
        settings.monthlyRechargeCapCount !== null &&
        settings.monthlyRechargeCapCount !== undefined &&
        completedCount >= settings.monthlyRechargeCapCount
      ) {
        throw new Error("monthly_recharge_cap_exceeded");
      }

      // idempotency_key: orgId:periodStart:sequence
      const sequence = cycleHistory.length + 1;
      const idempotencyKey = `${orgId}:${sub.currentPeriodStart.toISOString()}:${sequence}`;

      // pending row insert
      const [history] = await tx
        .insert(paymentRechargeHistory)
        .values({
          organizationId: orgId,
          periodStart: sub.currentPeriodStart,
          periodEnd: sub.currentPeriodEnd,
          triggerReason: "threshold",
          packageId: settings.autoRechargePackageId!,
          amountCents: pkg.priceCents,
          idempotencyKey,
          status: "pending",
          attemptedAt: now,
        })
        .returning();

      // audit log — actorUserId = sub.userId (FK 호환, cron 패턴과 동일)
      await tx.insert(paymentAuditLog).values({
        actorUserId: sub.userId,
        action: "auto_recharge_triggered",
        targetOrgId: orgId,
        payloadAfter: {
          rechargeHistoryId: history!.id,
          idempotencyKey,
          packageId: pkg.id,
          amountCents: pkg.priceCents,
        },
      });

      return { history: history!, idempotencyKey };
    });

    // ── Step 3: tx 밖 — Polar createCheckout (PR #62 plan-change v2 패턴) ──
    try {
      const checkout = await this.polar.createCheckout({
        productId: pkg.polarProductId,
        customerEmail: `${sub.userId}@example.com`, // service layer: user email lookup 생략 (T5 scope)
        customerExternalId: orgId,
        successUrl: process.env.APP_URL
          ? `${process.env.APP_URL}/billing/recharge-success`
          : "https://example.com/billing/recharge-success",
        metadata: {
          trigger: "auto_recharge",
          recharge_history_id: txResult.history.id,
        },
        idempotencyKey: txResult.idempotencyKey,
      });
      return {
        rechargeHistoryId: txResult.history.id,
        checkoutUrl: checkout.url,
      };
    } catch (e) {
      await this.markFailed(txResult.history.id, sub.userId, (e as Error).message);
      throw e;
    }
  }

  async markFailed(historyId: string, actorUserId: string, reason: string): Promise<void> {
    await this.db.transaction(async (tx) => {
      const [history] = await tx
        .update(paymentRechargeHistory)
        .set({ status: "failed", completedAt: new Date() })
        .where(eq(paymentRechargeHistory.id, historyId))
        .returning();

      if (history) {
        await tx.insert(paymentAuditLog).values({
          actorUserId,
          action: "auto_recharge_failed",
          targetOrgId: history.organizationId,
          payloadAfter: { rechargeHistoryId: historyId, reason },
        });
      }
    });
  }

  /**
   * Webhook order.paid 핸들러.
   * recharge_history.status='paid' + payment_usage_ledger insert
   * (delta_cents=+amountCents, reason='auto_recharge') + cached_paid_balance update.
   *
   * 단일 tx 멱등 — status='pending' 인 row 만 처리.
   */
  async onOrderPaid(
    rechargeHistoryId: string,
    polarOrderId: string,
    amountCents: number,
  ): Promise<void> {
    await this.db.transaction(async (tx) => {
      const [history] = await tx
        .select()
        .from(paymentRechargeHistory)
        .where(eq(paymentRechargeHistory.id, rechargeHistoryId))
        .for("update");

      if (!history) throw new Error(`recharge_history ${rechargeHistoryId} not found`);
      // 멱등: pending 이 아니면 no-op
      if (history.status !== "pending") return;

      await tx
        .update(paymentRechargeHistory)
        .set({ status: "paid", polarOrderId, completedAt: new Date() })
        .where(eq(paymentRechargeHistory.id, rechargeHistoryId));

      const [sub] = await tx
        .select()
        .from(paymentSubscriptions)
        .where(
          and(
            eq(paymentSubscriptions.organizationId, history.organizationId),
            eq(paymentSubscriptions.status, "active"),
          ),
        )
        .for("update")
        .limit(1);

      if (!sub) throw new Error(`active subscription not found for org ${history.organizationId}`);

      const newBalance = (sub.cachedPaidBalanceCents ?? 0) + amountCents;

      await tx.insert(paymentUsageLedger).values({
        organizationId: history.organizationId,
        deltaCents: amountCents,
        balanceAfterCents: newBalance,
        reason: "auto_recharge",
        refType: "polar_order",
        refId: polarOrderId,
        periodStart: history.periodStart,
        periodEnd: history.periodEnd,
        metadata: { rechargeHistoryId },
      });

      await tx
        .update(paymentSubscriptions)
        .set({
          cachedPaidBalanceCents: newBalance,
          cachedBalanceUpdatedAt: new Date(),
        })
        .where(eq(paymentSubscriptions.id, sub.id));
    });
  }
}
