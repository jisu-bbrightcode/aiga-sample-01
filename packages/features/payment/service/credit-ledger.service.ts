/**
 * CreditLedgerService — append-only credit ledger with serialized writes.
 *
 * Responsibilities:
 *  - getBalance(org)                                         (read)
 *  - grantSubscriptionCycle / grantTopUp / grantAdmin         (positive delta)
 *  - revokeAdmin                                              (negative delta, blocks if balance would go < 0)
 *  - spend                                                    (negative delta, returns allowed=false instead of throwing)
 *  - refundReverse                                            (FIFO partial refund, idempotent on refundId)
 *
 * Concurrency:
 *  Every balance-mutating call wraps its work in `db.transaction(...)` and
 *  acquires a per-organization `pg_advisory_xact_lock` BEFORE doing the
 *  `SELECT … FOR UPDATE` of the latest balance_after row. The combination
 *  of advisory lock + row lock guarantees serialized writes per org even
 *  under concurrent traffic (verified by the 100-parallel-spend test).
 *
 * Idempotency:
 *  Two partial unique indexes on payment_credit_ledger handle dedup:
 *   - (org, ref_type, ref_id) WHERE ref_type IS NOT NULL  → grant lots, spend events
 *   - (org, idempotency_key) WHERE idempotency_key IS NOT NULL → admin actions, refunds
 *  All inserts use `.onConflictDoNothing()` so a second call returns silently.
 *
 * Schema mapping note:
 *  payment_credit_ledger.ref_type is a fixed enum
 *  ('subscription' | 'order' | 'spend_event' | 'admin_action').
 *  Caller-supplied `refType` strings on `spend()` (e.g. "agent_call",
 *  "concurrent") are kept in `spend_meta.refType` for traceability;
 *  the row's actual ref_type is always 'spend_event'. Refund rows use
 *  ref_type=NULL and dedup via idempotency_key='refund:{refundId}'.
 *  Admin grant/revoke also use idempotency_key only.
 */
import { and, desc, eq, gt, sql } from "drizzle-orm";
import { type DrizzleDB, paymentCreditLedger, type PaymentCreditLedgerRow } from "@repo/drizzle";
import type { CreditReason } from "../common/constants";

interface GrantSubscriptionInput {
  organizationId: string;
  amount: number;
  subscriptionId: string;
  /** e.g. polar period start ISO or `${subId}:${period}` — must be stable per cycle. */
  periodKey: string;
}

interface GrantTopUpInput {
  organizationId: string;
  amount: number;
  orderId: string;
}

interface GrantAdminInput {
  organizationId: string;
  amount: number;
  actorUserId: string;
  idempotencyKey: string;
}

interface RevokeAdminInput {
  organizationId: string;
  amount: number;
  actorUserId: string;
  idempotencyKey: string;
}

interface SpendInput {
  organizationId: string;
  modelKey: string;
  inputTokens: number;
  outputTokens: number;
  /** Caller-supplied category (e.g. "agent_call"). Stored in spend_meta. */
  refType: string;
  /** Caller-supplied unique id for this spend event (used for idempotency). */
  refId: string;
  credits: number;
  idempotencyKey?: string;
}

interface RefundReverseInput {
  organizationId: string;
  /** Either subscriptionPeriodKey or orderId must be provided. */
  subscriptionPeriodKey?: string;
  orderId?: string;
  refundId: string;
}

type LedgerRow = typeof paymentCreditLedger.$inferSelect;

interface AppendEntryOpts {
  organizationId: string;
  delta: number;
  reason: CreditReason;
  refType?: "subscription" | "order" | "spend_event" | "admin_action" | null;
  refId?: string | null;
  actorUserId?: string;
  idempotencyKey?: string;
  spendMeta?: Record<string, unknown>;
  /** When true, throw if the new balance would be < 0 (admin revoke / spend). */
  checkNonNegative?: boolean;
}

export class CreditLedgerService {
  constructor(private readonly db: DrizzleDB) {}

  // ────────────────────────────────────────────────────────────────
  // Reads
  // ────────────────────────────────────────────────────────────────

  async getBalance(organizationId: string): Promise<number> {
    const rows = await this.db
      .select({ balanceAfter: paymentCreditLedger.balanceAfter })
      .from(paymentCreditLedger)
      .where(eq(paymentCreditLedger.organizationId, organizationId))
      .orderBy(desc(paymentCreditLedger.id))
      .limit(1);
    return rows[0]?.balanceAfter ?? 0;
  }

  /**
   * Most recent ledger row for a balance, with metadata. Used by
   * `payment.getMyCreditBalance` to expose `lastUpdatedAt` and `source`.
   */
  async getBalanceWithMeta(
    organizationId: string,
  ): Promise<{ balance: number; lastUpdatedAt: Date | null; source: CreditReason | null }> {
    const rows = await this.db
      .select({
        balanceAfter: paymentCreditLedger.balanceAfter,
        createdAt: paymentCreditLedger.createdAt,
        reason: paymentCreditLedger.reason,
      })
      .from(paymentCreditLedger)
      .where(eq(paymentCreditLedger.organizationId, organizationId))
      .orderBy(desc(paymentCreditLedger.id))
      .limit(1);
    if (rows.length === 0) {
      return { balance: 0, lastUpdatedAt: null, source: null };
    }
    const r = rows[0]!;
    return { balance: r.balanceAfter, lastUpdatedAt: r.createdAt, source: r.reason };
  }

  /**
   * Paginated ledger history (descending id). Spec §5.3 `getMyCreditHistory`.
   * Cursor = the last seen ledger id (bigint string). `nextCursor` is null when
   * fewer than `limit` rows are returned.
   */
  async listHistory(input: {
    organizationId: string;
    cursor?: string;
    limit?: number;
    reasonFilter?: CreditReason;
  }): Promise<{ rows: PaymentCreditLedgerRow[]; nextCursor: string | null }> {
    const limit = Math.min(Math.max(input.limit ?? 50, 1), 200);
    const conditions = [eq(paymentCreditLedger.organizationId, input.organizationId)];
    if (input.cursor !== undefined) {
      conditions.push(sql`${paymentCreditLedger.id} < ${BigInt(input.cursor)}`);
    }
    if (input.reasonFilter !== undefined) {
      conditions.push(eq(paymentCreditLedger.reason, input.reasonFilter));
    }
    const rows = await this.db
      .select()
      .from(paymentCreditLedger)
      .where(and(...conditions))
      .orderBy(desc(paymentCreditLedger.id))
      .limit(limit);
    const nextCursor = rows.length === limit ? rows[rows.length - 1]!.id.toString() : null;
    return { rows, nextCursor };
  }

  /**
   * Aggregate spend stats over the last N days. Spec §5.3 `getMyUsageStats`.
   * Reads only `reason='spend'` rows so totals reflect actual usage.
   */
  async getUsageStats(input: { organizationId: string; rangeDays: number }): Promise<{
    byModel: Record<string, { calls: number; credits: number }>;
    totalCredits: number;
    totalCalls: number;
  }> {
    const since = new Date(Date.now() - input.rangeDays * 24 * 60 * 60 * 1000);
    const rows = await this.db
      .select({
        delta: paymentCreditLedger.delta,
        spendMeta: paymentCreditLedger.spendMeta,
      })
      .from(paymentCreditLedger)
      .where(
        and(
          eq(paymentCreditLedger.organizationId, input.organizationId),
          eq(paymentCreditLedger.reason, "spend"),
          sql`${paymentCreditLedger.createdAt} >= ${since}`,
        ),
      );

    const byModel: Record<string, { calls: number; credits: number }> = {};
    let totalCredits = 0;
    let totalCalls = 0;
    for (const r of rows) {
      const credits = Math.max(-r.delta, 0);
      const meta = (r.spendMeta ?? {}) as { modelKey?: string };
      const key = meta.modelKey ?? "unknown";
      const slot = byModel[key] ?? { calls: 0, credits: 0 };
      slot.calls += 1;
      slot.credits += credits;
      byModel[key] = slot;
      totalCredits += credits;
      totalCalls += 1;
    }
    return { byModel, totalCredits, totalCalls };
  }

  // ────────────────────────────────────────────────────────────────
  // Grants
  // ────────────────────────────────────────────────────────────────

  async grantSubscriptionCycle(i: GrantSubscriptionInput) {
    return this.appendEntry({
      organizationId: i.organizationId,
      delta: i.amount,
      reason: "subscription_grant",
      refType: "subscription",
      refId: `${i.subscriptionId}:${i.periodKey}`,
    });
  }

  async grantTopUp(i: GrantTopUpInput) {
    return this.appendEntry({
      organizationId: i.organizationId,
      delta: i.amount,
      reason: "top_up",
      refType: "order",
      refId: i.orderId,
    });
  }

  async grantAdmin(i: GrantAdminInput) {
    return this.appendEntry({
      organizationId: i.organizationId,
      delta: i.amount,
      reason: "admin_grant",
      actorUserId: i.actorUserId,
      idempotencyKey: i.idempotencyKey,
    });
  }

  async revokeAdmin(i: RevokeAdminInput) {
    return this.appendEntry({
      organizationId: i.organizationId,
      delta: -Math.abs(i.amount),
      reason: "admin_revoke",
      actorUserId: i.actorUserId,
      idempotencyKey: i.idempotencyKey,
      checkNonNegative: true,
    });
  }

  // ────────────────────────────────────────────────────────────────
  // Spend (hot path)
  // ────────────────────────────────────────────────────────────────

  async spend(
    i: SpendInput,
  ): Promise<{ allowed: boolean; deltaCharged: number; balanceAfter: number }> {
    return this.db.transaction(async (tx) => {
      const lockKey = bigIntFromOrgId(i.organizationId);
      await tx.execute(sql`SELECT pg_advisory_xact_lock(${lockKey})`);
      const last = await tx.execute<{ balance_after: number | null }>(sql`
        SELECT balance_after FROM payment_credit_ledger
        WHERE organization_id = ${i.organizationId}
        ORDER BY id DESC LIMIT 1
        FOR UPDATE
      `);
      const prev = (last as unknown as { balance_after: number | null }[])[0]?.balance_after ?? 0;

      if (prev < i.credits) {
        return { allowed: false, deltaCharged: 0, balanceAfter: prev };
      }
      const balanceAfter = prev - i.credits;

      await tx
        .insert(paymentCreditLedger)
        .values({
          organizationId: i.organizationId,
          delta: -i.credits,
          reason: "spend",
          refType: "spend_event",
          refId: i.refId,
          balanceAfter,
          spendMeta: {
            modelKey: i.modelKey,
            inputTokens: i.inputTokens,
            outputTokens: i.outputTokens,
            credits: i.credits,
            refType: i.refType,
          },
          idempotencyKey: i.idempotencyKey ?? null,
        })
        .onConflictDoNothing();

      return { allowed: true, deltaCharged: i.credits, balanceAfter };
    });
  }

  // ────────────────────────────────────────────────────────────────
  // Refund — FIFO partial reverse
  // ────────────────────────────────────────────────────────────────

  async refundReverse(i: RefundReverseInput): Promise<{ reverted: number }> {
    if (!i.subscriptionPeriodKey && !i.orderId) {
      throw new Error("refundReverse: subscriptionPeriodKey or orderId required");
    }
    return this.db.transaction(async (tx) => {
      const lockKey = bigIntFromOrgId(i.organizationId);
      await tx.execute(sql`SELECT pg_advisory_xact_lock(${lockKey})`);

      const refType: "subscription" | "order" = i.subscriptionPeriodKey ? "subscription" : "order";
      const refId = (i.subscriptionPeriodKey ?? i.orderId) as string;

      // 1. Locate the original grant lot.
      const grantRows = await tx
        .select({ id: paymentCreditLedger.id, delta: paymentCreditLedger.delta })
        .from(paymentCreditLedger)
        .where(
          and(
            eq(paymentCreditLedger.organizationId, i.organizationId),
            eq(paymentCreditLedger.refType, refType),
            eq(paymentCreditLedger.refId, refId),
          ),
        )
        .limit(1);

      if (grantRows.length === 0) {
        throw new Error(`refundReverse: original grant not found ${refType}:${refId}`);
      }
      const grant = grantRows[0]!;
      const original = grant.delta;

      // 2. Sum spend after this grant (FIFO: anything spent later is "from" it).
      // `GREATEST(-delta, 0)` keeps only the spend half of each ledger row (delta
      // is negative for spends), then COALESCE+SUM aggregates into an int. The
      // fragment lives inside select/where so the no-raw-sql-query rule allows it.
      const [usedRow] = await tx
        .select({
          used: sql<number>`COALESCE(SUM(GREATEST(-${paymentCreditLedger.delta}, 0)), 0)::int`,
        })
        .from(paymentCreditLedger)
        .where(
          and(
            eq(paymentCreditLedger.organizationId, i.organizationId),
            eq(paymentCreditLedger.reason, "spend"),
            gt(paymentCreditLedger.id, grant.id),
          ),
        );
      const usedRaw = usedRow?.used ?? 0;
      const used = Math.min(usedRaw, original);
      const refundAmount = original - used;
      if (refundAmount <= 0) return { reverted: 0 };

      // 3. Read current balance under FOR UPDATE before inserting.
      const last = await tx.execute<{ balance_after: number | null }>(sql`
        SELECT balance_after FROM payment_credit_ledger
        WHERE organization_id = ${i.organizationId}
        ORDER BY id DESC LIMIT 1
        FOR UPDATE
      `);
      const prev = (last as unknown as { balance_after: number | null }[])[0]?.balance_after ?? 0;
      const balanceAfter = prev - refundAmount;

      // 4. Insert the reverse entry. Idempotent on idempotency_key.
      await tx
        .insert(paymentCreditLedger)
        .values({
          organizationId: i.organizationId,
          delta: -refundAmount,
          reason: "refund_reverse",
          refType: null,
          refId: null,
          balanceAfter,
          idempotencyKey: `refund:${i.refundId}`,
        })
        .onConflictDoNothing();

      return { reverted: refundAmount };
    });
  }

  // ────────────────────────────────────────────────────────────────
  // Internal: serialized append
  // ────────────────────────────────────────────────────────────────

  private async appendEntry(
    opts: AppendEntryOpts,
  ): Promise<{ ledgerEntry: LedgerRow | null; balanceAfter: number }> {
    return this.db.transaction(async (tx) => {
      const lockKey = bigIntFromOrgId(opts.organizationId);
      await tx.execute(sql`SELECT pg_advisory_xact_lock(${lockKey})`);

      const last = await tx.execute<{ balance_after: number | null }>(sql`
        SELECT balance_after FROM payment_credit_ledger
        WHERE organization_id = ${opts.organizationId}
        ORDER BY id DESC LIMIT 1
        FOR UPDATE
      `);
      const prev = (last as unknown as { balance_after: number | null }[])[0]?.balance_after ?? 0;
      const balanceAfter = prev + opts.delta;

      if (opts.checkNonNegative && balanceAfter < 0) {
        throw new Error(`balance would go negative: prev=${prev} delta=${opts.delta}`);
      }

      const inserted = await tx
        .insert(paymentCreditLedger)
        .values({
          organizationId: opts.organizationId,
          delta: opts.delta,
          reason: opts.reason,
          refType: opts.refType ?? null,
          refId: opts.refId ?? null,
          balanceAfter,
          actorUserId: opts.actorUserId ?? null,
          idempotencyKey: opts.idempotencyKey ?? null,
          spendMeta: opts.spendMeta ?? null,
        })
        .onConflictDoNothing()
        .returning();

      // If onConflictDoNothing skipped, recover the existing row's balanceAfter.
      if (inserted.length === 0) {
        const existing = await this.findExistingByIdempotency(tx, opts);
        return {
          ledgerEntry: existing ?? null,
          balanceAfter: existing?.balanceAfter ?? prev,
        };
      }
      return { ledgerEntry: inserted[0]!, balanceAfter: inserted[0]!.balanceAfter };
    });
  }

  /** Look up the row that an idempotent insert would have matched. */
  private async findExistingByIdempotency(
    tx: Parameters<Parameters<DrizzleDB["transaction"]>[0]>[0],
    opts: AppendEntryOpts,
  ): Promise<LedgerRow | null> {
    if (opts.idempotencyKey) {
      const rows = await tx
        .select()
        .from(paymentCreditLedger)
        .where(
          and(
            eq(paymentCreditLedger.organizationId, opts.organizationId),
            eq(paymentCreditLedger.idempotencyKey, opts.idempotencyKey),
          ),
        )
        .limit(1);
      return rows[0] ?? null;
    }
    if (opts.refType && opts.refId) {
      const rows = await tx
        .select()
        .from(paymentCreditLedger)
        .where(
          and(
            eq(paymentCreditLedger.organizationId, opts.organizationId),
            eq(paymentCreditLedger.refType, opts.refType),
            eq(paymentCreditLedger.refId, opts.refId),
          ),
        )
        .limit(1);
      return rows[0] ?? null;
    }
    return null;
  }
}

/**
 * Hash an org id into a bigint for `pg_advisory_xact_lock(bigint)`.
 * Trim to signed 63 bits (Postgres bigint is signed) to avoid out-of-range.
 */
function bigIntFromOrgId(orgId: string): bigint {
  let h = 1469598103934665603n; // FNV-1a 64-bit offset basis
  const prime = 1099511628211n;
  for (let i = 0; i < orgId.length; i++) {
    h ^= BigInt(orgId.charCodeAt(i));
    h = (h * prime) & 0x7fffffffffffffffn; // keep within signed 63-bit
  }
  return h;
}
