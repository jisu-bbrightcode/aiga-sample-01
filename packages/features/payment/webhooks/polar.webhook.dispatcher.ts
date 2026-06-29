/**
 * PolarWebhookDispatcher — single dispatch point for Polar webhook events.
 *
 * Spec §4.3 / §8.B / §8.A. Called by `PolarWebhookController` after the
 * standardwebhooks signature has already been verified. The dispatcher's job
 * is purely routing — no signature, no replay-window, no DB transaction
 * orchestration beyond what each downstream service already provides.
 *
 * Result codes:
 *   ok        — handler ran (or no-op type), no further action.
 *   deferred  — handler couldn't run yet (e.g. payment.succeeded arrived
 *               before subscription.created). Webhook reply is still 200 so
 *               Polar doesn't retry tightly; a reconcile job (Phase 6) will
 *               replay deferred events.
 *   error     — handler threw. Controller maps to 500 so Polar retries.
 *
 * Idempotency:
 *   Phase 4's `SubscriptionService.processEvent` and Phase 3's
 *   `CreditLedgerService.grant*` are already idempotent on
 *   `polar_event_id` / `(refType,refId)` / `idempotencyKey`. The dispatcher
 *   does not need its own dedup table — replays are absorbed downstream.
 *
 * Type-only imports for Phase 6/7:
 *   `DunningService` and `CouponService` don't exist yet. We declare them as
 *   interfaces here so Phase 5 can compile and test (with jest.fn stubs);
 *   Phase 6/7 will provide real classes that `implements` these.
 */

import type { AutoRechargeService } from "../service/auto-recharge.service";
import type { CreditLedgerService } from "../service/credit-ledger.service";
import type { NotificationService } from "../service/notification.service";
import type { OrderMirrorService } from "../service/order-mirror.service";
import type { SubscriptionService } from "../service/subscription.service";
import {
  polarRefundDataSchema,
  polarSubscriptionDataSchema,
} from "./polar.payload.schema";

/** Phase 6 — real class lands with the dunning cron. */
export interface DunningService {
  markPastDue(input: {
    polarSubscriptionId: string;
    reason?: string;
  }): Promise<void>;
}

/** Phase 7 — real class lands with the coupon redemption ledger. */
export interface CouponService {
  recordRedemption(input: {
    polarDiscountId: string;
    polarEventRef: string;
    organizationId: string;
    subscriptionId?: string;
    orderId?: string;
  }): Promise<void>;
}

/**
 * Phase 6 follow-up: when an event resolves to `deferred`, the webhook-retry
 * cron needs a row in payment_subscription_events with result='deferred' and
 * a next_retry_at to scan. SubscriptionService.processEvent only inserts
 * rows for subscription.* types — payment.* / order.* deferrals would
 * otherwise leave nothing on disk to retry. The dispatcher delegates the
 * "make sure a deferred row exists" step to this optional logger so the
 * controller / module wiring can plug in a DB-backed implementation; tests
 * pass a jest.fn or omit it entirely.
 */
export interface DeferredEventLogger {
  recordDeferred(input: {
    polarEventId: string;
    eventType: string;
    payload: Record<string, unknown>;
    nextRetryAt: Date;
    reason: string;
  }): Promise<void>;
}

export interface WebhookHandlerDeps {
  subSvc: SubscriptionService;
  ledger: CreditLedgerService;
  dunning: DunningService;
  coupon: CouponService;
  notif: NotificationService;
  orderMirror: OrderMirrorService;
  deferredLogger?: DeferredEventLogger;
  autoRecharge?: AutoRechargeService;
}

const DEFERRED_BACKOFF_MS = 5 * 60_000;

export type DispatchResult =
  | { result: "ok" }
  | { result: "deferred"; reason: string }
  | { result: "error"; error: string };

/** Polar webhook envelope as we receive it (only fields we read). */
export interface PolarWebhookPayload {
  type: string;
  data: Record<string, unknown> & {
    id?: string;
    metadata?: Record<string, string | undefined>;
  };
}

export class PolarWebhookDispatcher {
  constructor(private readonly deps: WebhookHandlerDeps) {}

  async dispatch(
    payload: PolarWebhookPayload,
    polarEventId: string,
  ): Promise<DispatchResult> {
    let result: DispatchResult;
    try {
      switch (payload.type) {
        // ─── subscription.* — Polar emits these as-is. trial_end is not
        //     a separate Polar event but kept for backward-compat with
        //     internal callers; Polar surfaces trial transitions via
        //     subscription.updated.
        case "subscription.created":
        case "subscription.active":
        case "subscription.uncanceled":
        case "subscription.revoked":
        case "subscription.canceled":
        case "subscription.trial_end":
          result = await this.handleSubscriptionEvent(payload, polarEventId);
          break;

        // subscription.updated — also funnels past_due transitions into
        // dunning. Polar may surface past_due either as a dedicated
        // subscription.past_due event or as subscription.updated with
        // data.status === "past_due"; both route through this branch.
        case "subscription.updated":
        case "subscription.past_due": {
          result = await this.handleSubscriptionEvent(payload, polarEventId);
          const status = (payload.data.status as string | undefined) ?? payload.type;
          if (
            result.result === "ok" &&
            (status === "past_due" || payload.type === "subscription.past_due")
          ) {
            const polarSubId = payload.data.id as string | undefined;
            if (polarSubId) {
              await this.deps.dunning.markPastDue({
                polarSubscriptionId: polarSubId,
                reason: payload.type,
              });
            }
          }
          break;
        }

        // ─── order.* — paid/refunded handled below; updated/created are
        //     forward-compat no-ops (Polar emits them around order
        //     lifecycle but we only act on paid/refunded).
        case "order.updated":
        case "order.created":
          result = { result: "ok" };
          break;

        // ─── order.paid — Polar's actual recurring + top-up event.
        //     Aliased with the spec name `payment.succeeded` (recurring)
        //     and `order.completed` (top-up) for backward compat with
        //     callers / fixtures that predate the Polar reconciliation.
        case "order.paid":
        case "payment.succeeded":
        case "order.completed":
          result = await this.handleOrderPaid(payload, polarEventId);
          break;

        // order.refunded — mirror-only. refund.created handles the ledger
        // reversal; here we just sync payment_orders.status / refunded_amount.
        case "order.refunded":
          await this.deps.orderMirror.upsertFromOrderRefunded(payload);
          result = { result: "ok" };
          break;

        // payment.failed — kept as alias; Polar does not emit it
        // directly (we receive past_due via subscription.updated above),
        // but internal/test callers may still send it.
        case "payment.failed":
          result = await this.handlePaymentFailed(payload);
          break;

        // ─── refund.* — Polar emits refund.created when the refund is
        //     issued, refund.updated when its status changes. We treat
        //     refund.created and the legacy refund.completed identically;
        //     for refund.updated we only act when status flipped to
        //     succeeded (otherwise it's a no-op so Polar stops retrying).
        case "refund.created":
        case "refund.completed":
          result = await this.handleRefundCompleted(payload);
          break;

        case "refund.updated": {
          const status = payload.data.status as string | undefined;
          if (status === "succeeded") {
            result = await this.handleRefundCompleted(payload);
          } else {
            result = { result: "ok" };
          }
          break;
        }

        // ─── checkout.* — informational only in v1; we acknowledge to
        //     stop Polar's retry pressure but take no domain action.
        case "checkout.created":
        case "checkout.updated":
        case "checkout.expired":
          result = { result: "ok" };
          break;

        // ─── benefit_grant.* — Polar's benefits engine; we don't grant
        //     benefits in v1 but acknowledge to silence retries.
        case "benefit_grant.created":
        case "benefit_grant.updated":
        case "benefit_grant.cycled":
        case "benefit_grant.revoked":
          result = { result: "ok" };
          break;

        case "discount.applied":
          result = await this.handleDiscountApplied(payload, polarEventId);
          break;

        // Any unknown / not-yet-handled type is a successful no-op so
        // Polar doesn't retry — forward-compat with new Polar event types.
        default:
          result = { result: "ok" };
      }
    } catch (e) {
      result = { result: "error", error: (e as Error).message };
    }

    // Phase 6 follow-up: persist deferred state so the webhook-retry cron
    // has something to scan. SubscriptionService.processEvent already
    // writes rows for subscription.* types; payment.* deferrals are
    // covered here. If no logger is wired (tests / pre-Phase-9 wiring),
    // we silently skip — the result is unchanged.
    if (result.result === "deferred" && this.deps.deferredLogger) {
      try {
        await this.deps.deferredLogger.recordDeferred({
          polarEventId,
          eventType: payload.type,
          payload: payload.data as Record<string, unknown>,
          nextRetryAt: new Date(Date.now() + DEFERRED_BACKOFF_MS),
          reason: result.reason,
        });
      } catch {
        // Logger failure must not turn a deferred into an error — Polar
        // already got 200 for the original event in our controller.
      }
    }
    return result;
  }

  // ──────────────────────────────────────────────────────────────────
  // subscription.* — feeds the subscription_events ledger
  // ──────────────────────────────────────────────────────────────────

  private async handleSubscriptionEvent(
    payload: PolarWebhookPayload,
    polarEventId: string,
  ): Promise<DispatchResult> {
    const evt = parseSubscriptionEvent(payload, polarEventId);
    const out = await this.deps.subSvc.processEvent(evt);
    if (payload.type === "subscription.created" && out.processed) {
      await this.deps.notif.onSubscriptionCreated({
        id: evt.payload.id,
        organizationId: evt.payload.organizationId,
        userEmail: payload.data.metadata?.user_email,
      });
    }
    return { result: "ok" };
  }

  // ──────────────────────────────────────────────────────────────────
  // order.paid — Polar's unified recurring + top-up event. Routes to
  // the matching legacy handler based on payload shape:
  //   - data.subscription_id present  → recurring (handlePaymentSucceeded)
  //   - data.metadata.kind === 'topup' → top-up (handleOrderCompleted)
  //   - else → log + skip (forward compat with checkout-only orders)
  // ──────────────────────────────────────────────────────────────────

  private async handleOrderPaid(
    payload: PolarWebhookPayload,
    polarEventId: string,
  ): Promise<DispatchResult> {
    // M: mirror into payment_orders before the existing routing. If the
    // mirror throws, propagate so Polar retries — order accounting must
    // stay consistent with the ledger.
    await this.deps.orderMirror.upsertFromOrderPaid(payload);

    const meta = payload.data.metadata ?? {};

    // auto_recharge 분기 — metadata.trigger === 'auto_recharge' 이면 AutoRechargeService 로 위임
    if (meta.trigger === "auto_recharge" && meta.recharge_history_id) {
      if (this.deps.autoRecharge) {
        const orderId = (payload.data.id ?? payload.data.order_id) as string | undefined;
        const amountCents = numeric(payload.data.total_amount ?? payload.data.amount) ?? 0;
        await this.deps.autoRecharge.onOrderPaid(
          meta.recharge_history_id,
          orderId ?? polarEventId,
          amountCents,
        );
      }
      return { result: "ok" };
    }

    const polarSubId = (payload.data.subscription_id ??
      payload.data.subscriptionId) as string | undefined;
    if (polarSubId) {
      return this.handlePaymentSucceeded(payload, polarEventId);
    }
    if (meta.kind === "topup") {
      return this.handleOrderCompleted(payload);
    }
    // Forward-compat: a plain order with no recurring/top-up signal —
    // nothing to grant. Return ok so Polar doesn't retry.
    return { result: "ok" };
  }

  // ──────────────────────────────────────────────────────────────────
  // payment.succeeded — grants subscription cycle credits
  // ──────────────────────────────────────────────────────────────────

  private async handlePaymentSucceeded(
    payload: PolarWebhookPayload,
    polarEventId: string,
  ): Promise<DispatchResult> {
    const polarSubId = (payload.data.subscription_id ??
      payload.data.subscriptionId) as string | undefined;
    if (!polarSubId) {
      return { result: "error", error: "missing subscription_id" };
    }
    const sub = await this.deps.subSvc.findByPolarId(polarSubId);
    if (!sub) {
      // payment.succeeded arrived before subscription.created. Defer; a
      // reconcile cron (Phase 6) will replay.
      return {
        result: "deferred",
        reason: `subscription not found: ${polarSubId}`,
      };
    }
    // [L fix] order.paid does NOT carry data.period_start — Polar surfaces
    // period boundaries on subscription.* events only. Derive the cycle key
    // from the matched subscription row (DB-of-record), falling back to the
    // event id only if currentPeriodStart somehow ends up null/invalid.
    const periodKey = isoOrEmpty(sub.currentPeriodStart) || polarEventId;
    await this.deps.ledger.grantSubscriptionCycle({
      organizationId: sub.organizationId,
      amount: sub.includedCreditsPerCycle,
      subscriptionId: sub.id,
      periodKey,
    });
    await this.deps.notif.onPaymentSucceeded({
      id: sub.id,
      organizationId: sub.organizationId,
      userEmail: payload.data.metadata?.user_email,
      // Use total_amount (gross charged) for user-facing receipt, not amount
      // (post-tax net). Polar's `amount` = subtotal − tax; `total_amount` =
      // what hits the customer's bank statement.
      amountCents: numeric(payload.data.total_amount ?? payload.data.amount),
      planName: sub.planSlug,
    });
    return { result: "ok" };
  }

  // ──────────────────────────────────────────────────────────────────
  // payment.failed — flags the sub past_due via DunningService
  // ──────────────────────────────────────────────────────────────────

  private async handlePaymentFailed(
    payload: PolarWebhookPayload,
  ): Promise<DispatchResult> {
    const polarSubId = (payload.data.subscription_id ??
      payload.data.subscriptionId) as string | undefined;
    if (!polarSubId) {
      return { result: "error", error: "missing subscription_id" };
    }
    await this.deps.dunning.markPastDue({
      polarSubscriptionId: polarSubId,
      reason: (payload.data.failure_reason as string | undefined) ?? undefined,
    });
    return { result: "ok" };
  }

  // ──────────────────────────────────────────────────────────────────
  // order.completed — top-up grants
  // ──────────────────────────────────────────────────────────────────

  private async handleOrderCompleted(
    payload: PolarWebhookPayload,
  ): Promise<DispatchResult> {
    const meta = payload.data.metadata ?? {};
    if (meta.kind !== "topup") {
      // Subscription orders flow through subscription.created; only top-up
      // orders need ledger grants here.
      return { result: "ok" };
    }
    const orgId = meta.organization_id;
    const orderId = (payload.data.id ?? payload.data.order_id) as
      | string
      | undefined;
    // [F] Polar metadata values are always strings — parse credits explicitly
    // and reject NaN / non-positive values with a diagnostic error rather than
    // silently granting 0. Split orgId/orderId from credits so logs surface
    // which field is missing.
    const credits = Number.parseInt(meta.credits ?? "", 10);
    if (!Number.isFinite(credits) || credits <= 0) {
      return { result: "error", error: "topup metadata: credits invalid" };
    }
    if (!orgId || !orderId) {
      return { result: "error", error: "topup metadata: orgId/orderId missing" };
    }
    await this.deps.ledger.grantTopUp({
      organizationId: orgId,
      amount: credits,
      orderId,
    });
    await this.deps.notif.onTopUpCompleted({
      orderId,
      organizationId: orgId,
      userEmail: meta.user_email,
      amountCents: numeric(payload.data.amount),
      credits,
    });
    return { result: "ok" };
  }

  // ──────────────────────────────────────────────────────────────────
  // refund.completed — FIFO reverse credit
  // ──────────────────────────────────────────────────────────────────

  private async handleRefundCompleted(
    payload: PolarWebhookPayload,
  ): Promise<DispatchResult> {
    // [N] Polar refund payloads carry correlation at the top level —
    // metadata is often empty. Prefer parsed.order_id / parsed.subscription_id;
    // fall back to metadata for legacy/test payloads that wrote correlation
    // into metadata.
    const parsed = polarRefundDataSchema.parse(payload.data);
    const meta = (payload.data.metadata ?? {}) as Record<
      string,
      string | undefined
    >;
    const refundId = parsed.id;
    const orderId = parsed.order_id ?? meta.order_id ?? undefined;
    const subscriptionId = parsed.subscription_id ?? undefined;

    // org id still must come from metadata or — when absent — from the
    // mirrored order row.
    const orgId =
      meta.organization_id ??
      (orderId
        ? await this.deps.orderMirror.getOrganizationByPolarOrderId(orderId)
        : undefined);

    if (!orgId) {
      return { result: "error", error: "refund: organization_id unresolvable" };
    }
    if (!orderId && !subscriptionId) {
      return {
        result: "error",
        error: "refund: target (order/subscription) missing",
      };
    }

    const subscriptionPeriodKey = subscriptionId
      ? await this.lookupCurrentPeriodKey(subscriptionId)
      : meta.subscription_period_key || undefined;

    await this.deps.ledger.refundReverse({
      organizationId: orgId,
      refundId,
      subscriptionPeriodKey,
      orderId,
    });
    await this.deps.notif.onRefundCompleted({
      refundId,
      organizationId: orgId,
      userEmail: meta.user_email,
      amountCents: parsed.amount,
    });
    return { result: "ok" };
  }

  /** Helper: derive subscription_period_key from current sub state. */
  private async lookupCurrentPeriodKey(
    polarSubId: string,
  ): Promise<string | undefined> {
    const sub = await this.deps.subSvc.findByPolarId(polarSubId);
    if (!sub?.currentPeriodStart) return undefined;
    return new Date(sub.currentPeriodStart).toISOString();
  }

  // ──────────────────────────────────────────────────────────────────
  // discount.applied — coupon redemption ledger (Phase 7)
  // ──────────────────────────────────────────────────────────────────

  private async handleDiscountApplied(
    payload: PolarWebhookPayload,
    polarEventId: string,
  ): Promise<DispatchResult> {
    const meta = payload.data.metadata ?? {};
    const polarDiscountId = (payload.data.discount_id ??
      payload.data.discountId ??
      payload.data.id) as string | undefined;
    const orgId =
      meta.organization_id ??
      (payload.data.organization_id as string | undefined);
    if (!polarDiscountId || !orgId) {
      return { result: "error", error: "discount.applied metadata incomplete" };
    }
    const subscriptionId = (payload.data.subscription_id ??
      payload.data.subscriptionId ??
      meta.subscription_id) as string | undefined;
    const orderId = (payload.data.order_id ??
      payload.data.orderId ??
      meta.order_id) as string | undefined;

    await this.deps.coupon.recordRedemption({
      polarDiscountId,
      polarEventRef: polarEventId,
      organizationId: orgId,
      subscriptionId,
      orderId,
    });
    return { result: "ok" };
  }
}

// ────────────────────────────────────────────────────────────────────
// Helpers
// ────────────────────────────────────────────────────────────────────

function parseSubscriptionEvent(
  payload: PolarWebhookPayload,
  polarEventId: string,
): Parameters<SubscriptionService["processEvent"]>[0] {
  // [C fix] Parse the Polar payload through zod first — required fields
  // missing now throws synchronously with a precise path, instead of
  // surfacing later as a NOT NULL constraint error in Drizzle.
  const d = polarSubscriptionDataSchema.parse(payload.data);
  const meta = (payload.data.metadata ?? {}) as Record<string, string | undefined>;
  const t = payload.type as
    | "subscription.created"
    | "subscription.updated"
    | "subscription.canceled"
    | "subscription.trial_end";
  // Polar's "incomplete" = "checkout done, first payment not yet succeeded"
  // → semantically equivalent to past_due (suspended pending payment), NOT
  //    trialing (which implies granted access during a paid trial period).
  //    The downstream SubscriptionService.SubEvent.SubStatus has no
  //    "incomplete" — past_due is the closest valid value and matches
  //    how subscription.updated:past_due is already routed through dunning.
  const status: "trialing" | "active" | "past_due" | "canceled" =
    d.status === "incomplete"
      ? "past_due"
      : (d.status as "trialing" | "active" | "past_due" | "canceled");
  // v2 plan-change mirror: forward Polar's product_id through to the service so
  // upsertSubscription can resolve it against paymentPlans (primary truth).
  // `d.product_id` is already validated as a required string by the zod schema
  // — no raw cast needed. Service falls back to payload.planId only when the
  // product lookup misses.
  const polarProductId = d.product_id;
  // metadata.plan_id is the legacy fallback path (v1). Polar does not always
  // refresh metadata after a plan switch, so this can be missing on v2 events.
  // Use a typed guard so SubEvent.payload.planId honestly reports `undefined`
  // and upsertSubscription's NOT-NULL guard can fire instead of leaking an
  // unsafe cast through to Drizzle.
  const planId =
    typeof meta.plan_id === "string" && meta.plan_id ? meta.plan_id : undefined;
  return {
    polarEventId,
    type: t,
    payload: {
      id: d.id,
      organizationId: meta.organization_id as string,
      userId: meta.user_id as string,
      planId,
      polarProductId,
      status,
      currentPeriodStart: parseDate(d.current_period_start),
      currentPeriodEnd: parseDate(d.current_period_end ?? new Date()),
      trialEnd: d.trial_end ? parseDate(d.trial_end) : null,
      cancelAtPeriodEnd: Boolean(d.cancel_at_period_end),
    },
  };
}

function parseDate(v: unknown): Date {
  if (v instanceof Date) return v;
  if (typeof v === "string" || typeof v === "number") return new Date(v);
  return new Date(); // last-resort default; real payloads always have these
}

function isoOrEmpty(v: unknown): string {
  if (v instanceof Date) return v.toISOString();
  if (typeof v === "string") return v;
  return "";
}

function numeric(v: unknown): number | undefined {
  if (typeof v === "number") return v;
  if (typeof v === "string") {
    const n = Number(v);
    return Number.isFinite(n) ? n : undefined;
  }
  return undefined;
}

