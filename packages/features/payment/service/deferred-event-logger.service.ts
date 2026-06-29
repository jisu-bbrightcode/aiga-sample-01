/**
 * DeferredEventLoggerService — concrete impl of the dispatcher's
 * DeferredEventLogger interface. Writes a payment_subscription_events row
 * so WebhookRetryService.retry() (5min cron) can find it and re-dispatch.
 *
 * Spec §3.2 item O: closes the gap noted in webhook-retry.service.ts:16-23.
 * Without this writer, the cron is a no-op for non-subscription events that
 * defer (payment.succeeded before subscription.created, etc).
 *
 * Idempotent on polarEventId (UNIQUE column → onConflictDoUpdate refreshes
 * nextRetryAt + errorMessage but keeps the existing retry_count so the cron
 * keeps progressing through its backoff schedule).
 */
import { paymentSubscriptionEvents, type DrizzleDB } from "@repo/drizzle";
import type { DeferredEventLogger } from "../webhooks/polar.webhook.dispatcher";

export class DeferredEventLoggerService implements DeferredEventLogger {
  constructor(private readonly db: DrizzleDB) {}

  async recordDeferred(input: {
    polarEventId: string;
    eventType: string;
    payload: Record<string, unknown>;
    nextRetryAt: Date;
    reason: string;
  }): Promise<void> {
    const errorMessage = input.reason.slice(0, 500);
    await this.db
      .insert(paymentSubscriptionEvents)
      .values({
        polarEventId: input.polarEventId,
        eventType: input.eventType,
        payload: input.payload,
        result: "deferred",
        retryCount: 0,
        nextRetryAt: input.nextRetryAt,
        errorMessage,
      })
      .onConflictDoUpdate({
        target: paymentSubscriptionEvents.polarEventId,
        set: {
          nextRetryAt: input.nextRetryAt,
          errorMessage,
        },
      });
  }
}
