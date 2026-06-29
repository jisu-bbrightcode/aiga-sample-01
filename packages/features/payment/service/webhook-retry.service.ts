/**
 * WebhookRetryService — re-dispatch deferred subscription_events.
 *
 * Spec §3.2.6 / §4.4 / §8.B3. The webhook dispatcher (Phase 5) returns
 * `result: 'deferred'` when a dependent event hasn't arrived yet (e.g.
 * payment.succeeded before subscription.created). Polar gets a 200 reply so
 * it doesn't tightly retry; we re-process from our own DB on a 5-minute cron.
 *
 * Retry policy:
 *   - Poll rows where `result='deferred' AND next_retry_at <= now`.
 *   - On re-dispatch success → result='ok', processed_at=now.
 *   - On re-dispatch deferred → bump retry_count, schedule next_retry_at
 *     with exponential-ish backoff (5min × 2^retry_count, capped 1h).
 *   - retry_count > 5 → result='error' (dead-letter), errorMessage logged.
 *
 * Phase 6 limitation (deliberate gap, documented in handoff):
 *   The Phase 5 dispatcher writes subscription_events only for
 *   subscription.* event types via SubscriptionService.processEvent — and
 *   that helper does NOT currently set result='deferred' itself. Until the
 *   dispatcher is taught to back-fill `result` and `next_retry_at` after a
 *   deferred outcome, this service will find no rows to retry and the cron
 *   is effectively a no-op. Phase 8 will close that loop when wiring the
 *   dispatcher into PaymentModule.
 */
import { and, eq, lte } from "drizzle-orm";
import {
  type DrizzleDB,
  paymentSubscriptionEvents,
} from "@repo/drizzle";

import type {
  PolarWebhookDispatcher,
  PolarWebhookPayload,
} from "../webhooks/polar.webhook.dispatcher";

const MAX_RETRIES = 5;
const BASE_BACKOFF_MS = 5 * 60_000; // 5 minutes
const MAX_BACKOFF_MS = 60 * 60_000; // 1 hour

export class WebhookRetryService {
  constructor(
    private readonly db: DrizzleDB,
    private readonly dispatcher: PolarWebhookDispatcher,
  ) {}

  /**
   * Process all deferred events whose retry window has elapsed. Returns
   * counts so the cron can log observability.
   */
  async retry(now: Date): Promise<{
    scanned: number;
    succeeded: number;
    stillDeferred: number;
    deadLettered: number;
    errors: number;
  }> {
    const rows = await this.db
      .select({
        id: paymentSubscriptionEvents.id,
        polarEventId: paymentSubscriptionEvents.polarEventId,
        eventType: paymentSubscriptionEvents.eventType,
        payload: paymentSubscriptionEvents.payload,
        retryCount: paymentSubscriptionEvents.retryCount,
      })
      .from(paymentSubscriptionEvents)
      .where(
        and(
          eq(paymentSubscriptionEvents.result, "deferred"),
          lte(paymentSubscriptionEvents.nextRetryAt, now),
        ),
      )
      .limit(100); // safety cap

    let succeeded = 0;
    let stillDeferred = 0;
    let deadLettered = 0;
    let errors = 0;

    for (const row of rows) {
      const envelope: PolarWebhookPayload = {
        type: row.eventType,
        data: (row.payload ?? {}) as PolarWebhookPayload["data"],
      };
      const out = await this.dispatcher.dispatch(envelope, row.polarEventId);
      if (out.result === "ok") {
        await this.db
          .update(paymentSubscriptionEvents)
          .set({ result: "ok", processedAt: now, nextRetryAt: null })
          .where(eq(paymentSubscriptionEvents.id, row.id));
        succeeded += 1;
      } else if (out.result === "error") {
        await this.db
          .update(paymentSubscriptionEvents)
          .set({
            result: "error",
            errorMessage: out.error.slice(0, 500),
            processedAt: now,
            nextRetryAt: null,
          })
          .where(eq(paymentSubscriptionEvents.id, row.id));
        errors += 1;
      } else {
        // Still deferred. Bump retry count and pick next slot.
        const nextCount = row.retryCount + 1;
        if (nextCount > MAX_RETRIES) {
          await this.db
            .update(paymentSubscriptionEvents)
            .set({
              result: "error",
              errorMessage: `dead-letter after ${MAX_RETRIES} retries: ${out.reason.slice(0, 300)}`,
              processedAt: now,
              retryCount: nextCount,
              nextRetryAt: null,
            })
            .where(eq(paymentSubscriptionEvents.id, row.id));
          deadLettered += 1;
        } else {
          const backoff = Math.min(
            BASE_BACKOFF_MS * 2 ** (nextCount - 1),
            MAX_BACKOFF_MS,
          );
          await this.db
            .update(paymentSubscriptionEvents)
            .set({
              retryCount: nextCount,
              nextRetryAt: new Date(now.getTime() + backoff),
              errorMessage: out.reason.slice(0, 500),
            })
            .where(eq(paymentSubscriptionEvents.id, row.id));
          stillDeferred += 1;
        }
      }
    }

    return {
      scanned: rows.length,
      succeeded,
      stillDeferred,
      deadLettered,
      errors,
    };
  }
}

