/**
 * ReconcileCron — every 5 minutes, replay deferred webhook events.
 *
 * Spec §3.2.6, §4.4 ("monthly 00:05 UTC of period_start"), §8.A2, §8.B3.
 * The spec describes TWO different concerns under "reconcile":
 *
 *   (1) Webhook deferred-event retry (every few minutes) — replay
 *       subscription_events rows where result='deferred' AND next_retry_at
 *       <= now. This is what Phase 6 implements.
 *
 *   (2) Monthly Polar drift reconcile (period_start +5min) — call
 *       polar.subscriptions.get for each active sub and patch local DB if
 *       Polar has rotated cycles we missed. This is deferred to Phase 8 where
 *       PolarAdapter has the surface area we need (subscription get, listing,
 *       diffing). Filed as TODO below.
 *
 * Naming kept as `reconcile.cron.ts` per Phase 6 plan §6 Task 6.2 step 3,
 * even though only concern (1) is implemented now. When (2) lands it will be
 * a sibling method on this same class so the cron scheduler stays simple.
 */
import { Injectable, Logger } from "@nestjs/common";
import { Cron, CronExpression } from "@nestjs/schedule";

import { WebhookRetryService } from "../service/webhook-retry.service";

@Injectable()
export class ReconcileCron {
  private readonly logger = new Logger(ReconcileCron.name);

  constructor(private readonly retry: WebhookRetryService) {}

  @Cron(CronExpression.EVERY_5_MINUTES, { name: "payment-webhook-retry" })
  async webhookRetry(): Promise<void> {
    const start = Date.now();
    const out = await this.retry.retry(new Date());
    if (out.scanned === 0) {
      // Quiet log — nothing to do is the steady state.
      return;
    }
    this.logger.log(
      `webhook-retry: scanned=${out.scanned} ok=${out.succeeded} stillDeferred=${out.stillDeferred} deadLettered=${out.deadLettered} errors=${out.errors} elapsedMs=${Date.now() - start}`,
    );
  }

  // TODO(Phase 8): monthly Polar drift reconcile —
  //   @Cron("5 0 1 * *", { timeZone: "UTC", name: "payment-polar-reconcile" })
  //   async polarReconcile() { /* compare DB ↔ Polar, grant missed cycles */ }
}
