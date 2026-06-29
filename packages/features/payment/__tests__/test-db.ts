/**
 * Shared test DB utilities for the payment package.
 *
 * Two patterns:
 *
 *  1. `withRollback(body)` — postgres-js raw client wrapped in a tx that is
 *     ALWAYS rolled back. Used by schema-invariant tests that hit raw SQL
 *     and want zero side effects. Phase 1 follow-up #1 fix: properly
 *     re-throws body errors instead of returning an unsound `undefined`.
 *
 *  2. `getDrizzleDb()` + per-test `cleanupOrg(orgId)` — a real DrizzleDB
 *     backed by a small postgres-js pool. Used by service-layer specs
 *     (CreditLedgerService) that internally call `db.transaction(...)`
 *     and need real concurrent connections (e.g. the FOR UPDATE / advisory
 *     lock race test). Tests are isolated via per-test unique orgId; the
 *     org and its ledger rows are cleaned up in afterEach.
 *
 * Both patterns share a single postgres-js client (lazy-init).
 */
import { randomUUID } from "node:crypto";
import * as dotenv from "dotenv";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import type { DrizzleDB } from "@repo/drizzle";

dotenv.config({ path: `${__dirname}/../../../../.env.local` });
dotenv.config({ path: `${__dirname}/../../../../.env` });

export const DATABASE_URL = process.env.DATABASE_URL;
export const hasDb = Boolean(DATABASE_URL);

const POOL_MAX = 10;

let _sql: ReturnType<typeof postgres> | null = null;
let _db: DrizzleDB | null = null;

function getSql(): ReturnType<typeof postgres> {
  if (!DATABASE_URL) throw new Error("DATABASE_URL not set");
  if (!_sql) _sql = postgres(DATABASE_URL, { max: POOL_MAX });
  return _sql;
}

export function getDrizzleDb(): DrizzleDB {
  if (!_db) _db = drizzle(getSql()) as unknown as DrizzleDB;
  return _db;
}

export async function endTestDb(): Promise<void> {
  if (_sql) {
    await _sql.end({ timeout: 5 });
    _sql = null;
    _db = null;
  }
}

const ROLLBACK_SENTINEL = "__test_rollback__";

/**
 * Run `body` inside a postgres-js transaction that is always rolled back.
 * Returns body's value. If body throws, the original error is re-thrown
 * (no silent swallow — Phase 1 follow-up #1 fix).
 *
 * `tx` is typed loosely (any) because postgres-js's `TransactionSql`
 * generic is awkward to surface and downstream usage is tagged-template
 * call syntax which TS struggles to type without parameters.
 */
// biome-ignore lint/suspicious/noExplicitAny: see comment above
export async function withRollback<T>(
  body: (tx: any) => Promise<T>,
): Promise<T> {
  const sql = getSql();
  let captured: T;
  let done = false;
  let bodyError: unknown;
  await sql
    .begin(async (tx) => {
      try {
        captured = await body(tx);
        done = true;
      } catch (err) {
        bodyError = err;
      }
      throw new Error(ROLLBACK_SENTINEL);
    })
    .catch((err) => {
      if (err instanceof Error && err.message === ROLLBACK_SENTINEL) return;
      throw err;
    });
  if (bodyError) throw bodyError;
  if (!done) throw new Error("withRollback: body did not complete");
  return captured!;
}

/** Generate a unique organization id suitable for an isolated test run. */
export function newOrgId(prefix = "test"): string {
  return `${prefix}-${randomUUID()}`;
}

/** Generate a unique user id suitable for an isolated test run. */
export function newUserId(prefix = "user"): string {
  return `${prefix}-${randomUUID()}`;
}

/**
 * Insert a temporary organization row (FK target for credit_ledger inserts).
 * Uses the shared connection — caller is responsible for cleanup.
 */
export async function ensureOrg(orgId: string): Promise<void> {
  const sql = getSql();
  await sql`
    INSERT INTO organizations (id, name, created_at)
    VALUES (${orgId}, ${`org-${orgId}`}, NOW())
    ON CONFLICT (id) DO NOTHING
  `;
}

/**
 * Insert a temporary better-auth user row (FK target for payment_subscriptions.user_id).
 * Uses the shared connection — caller is responsible for cleanup.
 */
export async function ensureUser(userId: string): Promise<void> {
  const sql = getSql();
  await sql`
    INSERT INTO users (id, name, email, email_verified, created_at, updated_at)
    VALUES (${userId}, ${`user-${userId}`}, ${`${userId}@test.local`}, false, NOW(), NOW())
    ON CONFLICT (id) DO NOTHING
  `;
}

/**
 * Insert a temporary payment_plans row. Caller passes a fresh uuid per test.
 * `priceCents` defaults to 1000 (Pro-tier-ish).
 */
export async function ensurePlan(
  planId: string,
  opts: {
    priceCents?: number;
    slug?: string;
    cycle?: "lifetime" | "monthly" | "yearly";
    polarProductId?: string;
  } = {},
): Promise<void> {
  const sql = getSql();
  const slug = opts.slug ?? `plan-${planId.slice(0, 8)}`;
  const cycle = opts.cycle ?? "monthly";
  const priceCents = opts.priceCents ?? 1000;
  const polarProductId = opts.polarProductId ?? null;
  await sql`
    INSERT INTO payment_plans
      (id, slug, cycle, name, price_cents, currency, included_credits_per_cycle, seats, trial_days, is_active, polar_product_id, created_at, updated_at)
    VALUES (
      ${planId}, ${slug}, ${cycle}, ${`Plan ${slug}`}, ${priceCents}, 'USD', 0, 1, 0, true, ${polarProductId}, NOW(), NOW()
    )
    ON CONFLICT (id) DO NOTHING
  `;
}

/**
 * Insert a payment_subscriptions row for tests. Caller passes a fresh uuid.
 * Defaults to status='active' with a 30-day current period. Optional dunning
 * timestamps (`pastDueSince`, `graceEndsAt`) let tests stage the state machine.
 */
export async function ensureSubscription(
  subId: string,
  opts: {
    orgId: string;
    userId: string;
    planId: string;
    polarSubId?: string;
    status?: "trialing" | "active" | "past_due" | "grace" | "canceled";
    pastDueSince?: Date | null;
    graceEndsAt?: Date | null;
  },
): Promise<void> {
  const sql = getSql();
  const polar = opts.polarSubId ?? `polar_${subId}`;
  const status = opts.status ?? "active";
  // postgres-js doesn't accept Date objects as parameters in tagged-template
  // bindings — convert to ISO strings (Postgres timestamptz parses both).
  const pastDueSince = opts.pastDueSince ? opts.pastDueSince.toISOString() : null;
  const graceEndsAt = opts.graceEndsAt ? opts.graceEndsAt.toISOString() : null;
  await sql`
    INSERT INTO payment_subscriptions
      (id, polar_subscription_id, organization_id, user_id, plan_id, status,
       current_period_start, current_period_end,
       past_due_since, grace_ends_at,
       created_at, updated_at)
    VALUES (
      ${subId}, ${polar}, ${opts.orgId}, ${opts.userId}, ${opts.planId}, ${status},
      NOW(), NOW() + INTERVAL '30 days',
      ${pastDueSince}, ${graceEndsAt},
      NOW(), NOW()
    )
    ON CONFLICT (id) DO NOTHING
  `;
}

/**
 * Delete the org and any rows the payment-feature tests may have inserted
 * (subscription events, subscriptions, ledger, audit log). Tables that use
 * FKs without ON DELETE CASCADE still need explicit deletes.
 */
export async function cleanupOrg(orgId: string): Promise<void> {
  const sql = getSql();
  await sql`DELETE FROM payment_subscription_events WHERE subscription_id IN (
    SELECT id FROM payment_subscriptions WHERE organization_id = ${orgId}
  )`;
  await sql`DELETE FROM payment_audit_log WHERE target_org_id = ${orgId}`;
  await sql`DELETE FROM payment_coupon_redemptions WHERE organization_id = ${orgId}`;
  await sql`DELETE FROM payment_subscriptions WHERE organization_id = ${orgId}`;
  await sql`DELETE FROM payment_credit_ledger WHERE organization_id = ${orgId}`;
  await sql`DELETE FROM organizations WHERE id = ${orgId}`;
}

/** Delete a user row. Safe to call after cleanupOrg. */
export async function cleanupUser(userId: string): Promise<void> {
  const sql = getSql();
  await sql`DELETE FROM users WHERE id = ${userId}`;
}

/** Delete payment_audit_log rows authored by `actorUserId`. Useful when a
 *  test seeds audit rows whose target_org_id is null (so cleanupOrg won't
 *  reach them) and we still need to drop the user FK. */
export async function cleanupAuditByActor(actorUserId: string): Promise<void> {
  const sql = getSql();
  await sql`DELETE FROM payment_audit_log WHERE actor_user_id = ${actorUserId}`;
}

/** Delete a payment_coupons row by code. Cascades to redemptions. Run
 *  before `cleanupUser` of the admin who created the coupon. */
export async function cleanupCouponByCode(code: string): Promise<void> {
  const sql = getSql();
  await sql`DELETE FROM payment_coupons WHERE code = ${code}`;
}

/** Delete a plan row. Safe to call after cleanupOrg (subscriptions reference plan). */
export async function cleanupPlan(planId: string): Promise<void> {
  const sql = getSql();
  await sql`DELETE FROM payment_plans WHERE id = ${planId}`;
}

/**
 * Delete subscription events whose polar_event_id starts with the given prefix.
 * Used by SubscriptionService tests where events may have NULL subscription_id
 * (e.g. after the first idempotent insert, before upsert succeeds in the test
 * setup). Also covers test rows that a thrown test left behind.
 */
export async function cleanupEventsByPrefix(prefix: string): Promise<void> {
  const sql = getSql();
  await sql`DELETE FROM payment_subscription_events WHERE polar_event_id LIKE ${`${prefix}%`}`;
}
