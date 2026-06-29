/**
 * DeferredEventLoggerService — verifies the dispatcher's deferredLogger slot
 * writes payment_subscription_events rows that the WebhookRetryService cron
 * can later scan. Idempotent on polarEventId (UNIQUE column → onConflictDoUpdate
 * refreshes nextRetryAt + errorMessage but never duplicates the row).
 *
 * Spec §3.2 item O / Task 5 — closes the gap noted in
 * webhook-retry.service.ts:16-23.
 */
import { eq } from "drizzle-orm";
import { paymentSubscriptionEvents } from "@repo/drizzle";
import {
  cleanupEventsByPrefix,
  endTestDb,
  getDrizzleDb,
  hasDb,
} from "../__tests__/test-db";
import { DeferredEventLoggerService } from "./deferred-event-logger.service";

const describeIfDb = hasDb ? describe : describe.skip;

describeIfDb("DeferredEventLoggerService", () => {
  const evtPrefix = "deflog_";

  afterEach(async () => {
    await cleanupEventsByPrefix(evtPrefix);
  });

  afterAll(async () => {
    await endTestDb();
  });

  it("recordDeferred inserts a row with result='deferred' and nextRetryAt", async () => {
    const svc = new DeferredEventLoggerService(getDrizzleDb());
    const polarEventId = `${evtPrefix}1`;
    const nextRetryAt = new Date("2026-04-26T13:50:00Z");

    await svc.recordDeferred({
      polarEventId,
      eventType: "order.paid",
      payload: { id: "ord_pending", subscription_id: "sub_pending" },
      nextRetryAt,
      reason: "subscription not found",
    });

    const rows = await getDrizzleDb()
      .select()
      .from(paymentSubscriptionEvents)
      .where(eq(paymentSubscriptionEvents.polarEventId, polarEventId));
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      polarEventId,
      eventType: "order.paid",
      result: "deferred",
      retryCount: 0,
    });
    expect(rows[0]?.nextRetryAt).toBeInstanceOf(Date);
    expect(rows[0]?.nextRetryAt?.getTime()).toBe(nextRetryAt.getTime());
    expect(rows[0]?.errorMessage).toBe("subscription not found");
  });

  it("recordDeferred is idempotent on polarEventId (re-record updates nextRetryAt + errorMessage)", async () => {
    const svc = new DeferredEventLoggerService(getDrizzleDb());
    const polarEventId = `${evtPrefix}2`;

    await svc.recordDeferred({
      polarEventId,
      eventType: "order.paid",
      payload: {},
      nextRetryAt: new Date("2026-04-26T14:00:00Z"),
      reason: "first",
    });
    await svc.recordDeferred({
      polarEventId,
      eventType: "order.paid",
      payload: {},
      nextRetryAt: new Date("2026-04-26T15:00:00Z"),
      reason: "second",
    });

    const rows = await getDrizzleDb()
      .select()
      .from(paymentSubscriptionEvents)
      .where(eq(paymentSubscriptionEvents.polarEventId, polarEventId));
    expect(rows).toHaveLength(1);
    expect(rows[0]?.errorMessage).toBe("second");
    expect(rows[0]?.nextRetryAt?.toISOString()).toBe(
      "2026-04-26T15:00:00.000Z",
    );
  });
});
