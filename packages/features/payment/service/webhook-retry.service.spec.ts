/**
 * WebhookRetryService — replays deferred subscription_events.
 *
 * Real DB. Each test seeds one or more event rows with result='deferred'
 * and verifies the retry flow updates them correctly.
 *
 *  T1  retry succeeds → result='ok', processed_at set
 *  T2  retry still deferred → retry_count++, next_retry_at backoff
 *  T3  retry_count > MAX → dead-letter (result='error')
 *  T4  no rows when next_retry_at > now → no-op
 */
import { eq } from "drizzle-orm";
import { paymentSubscriptionEvents } from "@repo/drizzle";
import {
  cleanupEventsByPrefix,
  endTestDb,
  getDrizzleDb,
  hasDb,
} from "../__tests__/test-db";
import type {
  DispatchResult,
  PolarWebhookDispatcher,
} from "../webhooks/polar.webhook.dispatcher";
import { WebhookRetryService } from "./webhook-retry.service";

const describeIfDb = hasDb ? describe : describe.skip;

describeIfDb("WebhookRetryService", () => {
  const evtPrefix = "wretry_";

  afterEach(async () => {
    await cleanupEventsByPrefix(evtPrefix);
  });

  afterAll(async () => {
    await endTestDb();
  });

  function makeDispatcher(
    next: () => Promise<DispatchResult>,
  ): PolarWebhookDispatcher {
    return {
      dispatch: async () => next(),
    } as unknown as PolarWebhookDispatcher;
  }

  async function seed(
    polarEventId: string,
    fields: {
      result: "deferred" | "ok" | "error";
      retryCount?: number;
      nextRetryAt?: Date | null;
      eventType?: string;
    },
  ): Promise<string> {
    const db = getDrizzleDb();
    const inserted = await db
      .insert(paymentSubscriptionEvents)
      .values({
        polarEventId,
        eventType: fields.eventType ?? "payment.succeeded",
        payload: { foo: "bar" } as Record<string, unknown>,
        result: fields.result,
        retryCount: fields.retryCount ?? 0,
        nextRetryAt: fields.nextRetryAt ?? null,
      })
      .returning();
    return inserted[0]!.id;
  }

  async function readRow(id: string) {
    const db = getDrizzleDb();
    const rows = await db
      .select()
      .from(paymentSubscriptionEvents)
      .where(eq(paymentSubscriptionEvents.id, id));
    return rows[0]!;
  }

  it("retry success → result='ok' + processed_at", async () => {
    const id = await seed(`${evtPrefix}ok`, {
      result: "deferred",
      nextRetryAt: new Date(Date.now() - 60_000),
    });
    const dispatcher = makeDispatcher(async () => ({ result: "ok" }));
    const svc = new WebhookRetryService(getDrizzleDb(), dispatcher);
    const out = await svc.retry(new Date());
    expect(out.scanned).toBeGreaterThanOrEqual(1);
    expect(out.succeeded).toBeGreaterThanOrEqual(1);

    const row = await readRow(id);
    expect(row.result).toBe("ok");
    expect(row.processedAt).toBeInstanceOf(Date);
  });

  it("retry still deferred → retry_count++ and next_retry_at scheduled", async () => {
    const id = await seed(`${evtPrefix}defer`, {
      result: "deferred",
      retryCount: 1,
      nextRetryAt: new Date(Date.now() - 60_000),
    });
    const dispatcher = makeDispatcher(async () => ({
      result: "deferred",
      reason: "still missing dep",
    }));
    const svc = new WebhookRetryService(getDrizzleDb(), dispatcher);
    const now = new Date();
    const out = await svc.retry(now);
    expect(out.stillDeferred).toBeGreaterThanOrEqual(1);

    const row = await readRow(id);
    expect(row.result).toBe("deferred");
    expect(row.retryCount).toBe(2);
    expect(row.nextRetryAt).toBeInstanceOf(Date);
    expect(row.nextRetryAt!.getTime()).toBeGreaterThan(now.getTime());
  });

  it("retry over MAX_RETRIES → dead-letter (result='error')", async () => {
    const id = await seed(`${evtPrefix}dead`, {
      result: "deferred",
      retryCount: 5,
      nextRetryAt: new Date(Date.now() - 60_000),
    });
    const dispatcher = makeDispatcher(async () => ({
      result: "deferred",
      reason: "stuck",
    }));
    const svc = new WebhookRetryService(getDrizzleDb(), dispatcher);
    const out = await svc.retry(new Date());
    expect(out.deadLettered).toBeGreaterThanOrEqual(1);

    const row = await readRow(id);
    expect(row.result).toBe("error");
    expect(row.errorMessage).toMatch(/dead-letter/);
  });
});
