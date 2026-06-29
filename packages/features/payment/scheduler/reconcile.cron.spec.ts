/**
 * ReconcileCron — verifies the @Cron handler delegates to
 * WebhookRetryService.retry(now).
 */
import { ReconcileCron } from "./reconcile.cron";

describe("ReconcileCron", () => {
  it("webhookRetry() delegates to WebhookRetryService.retry(new Date())", async () => {
    const calls: Date[] = [];
    const fakeRetry = {
      retry: async (now: Date) => {
        calls.push(now);
        return {
          scanned: 0,
          succeeded: 0,
          stillDeferred: 0,
          deadLettered: 0,
          errors: 0,
        };
      },
    } as unknown as ConstructorParameters<typeof ReconcileCron>[0];

    const cron = new ReconcileCron(fakeRetry);
    await cron.webhookRetry();
    expect(calls).toHaveLength(1);
    expect(calls[0]).toBeInstanceOf(Date);
  });

  it("webhookRetry() handles non-empty scan", async () => {
    const fakeRetry = {
      retry: async () => ({
        scanned: 3,
        succeeded: 1,
        stillDeferred: 1,
        deadLettered: 1,
        errors: 0,
      }),
    } as unknown as ConstructorParameters<typeof ReconcileCron>[0];

    const cron = new ReconcileCron(fakeRetry);
    await expect(cron.webhookRetry()).resolves.toBeUndefined();
  });

  // Task 5 §3.2 item O — full e2e of the deferred → cron recovery loop.
  // Coverage today is split across unit specs:
  //   - DeferredEventLoggerService.spec — writer inserts/refreshes the row
  //   - PolarWebhookDispatcher.spec — dispatcher calls deferredLogger on defer
  //   - WebhookRetryService.spec — cron picks up deferred rows + re-dispatches
  //   - PaymentModule wiring — DeferredEventLoggerService is the
  //     dispatcher's deferredLogger provider (see payment.module.ts).
  // A real-DB end-to-end (order.paid before subscription.created → row →
  // subscription.created → fast-forward → cron retry → ledger granted)
  // would require seeded products/plans/orgs/users and full SubscriptionService
  // + CreditLedgerService + OrderMirrorService construction; deferred to a
  // follow-up so this commit stays surgical.
  it.todo("e2e: order.paid → defers → subscription.created → cron retry → ledger granted");
});
