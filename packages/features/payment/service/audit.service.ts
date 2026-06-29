/**
 * AuditService — append-only writer for `payment_audit_log` (spec §3.2.11, §8.J).
 *
 * Every admin mutation in the payment domain (refund, grant_credits,
 * cancel_sub, release_soft_suspend, archive_coupon, …) records a row here.
 *
 * Design:
 *  - `log()` is a single INSERT — cheap, no locks. Append-only, never updates.
 *  - `list()` powers the Phase 8 admin.auditLog.list tRPC procedure with simple
 *    cursor pagination (id DESC + WHERE filters).
 *
 * Concurrency: the table uses a `bigserial` primary key, so concurrent
 * inserts never collide.
 *
 * The shape of `AuditEntry` is deliberately a superset of the inline
 * `AuditService` interface declared by Phase 6's DunningService — instances
 * of THIS class are structurally compatible with that interface so we can
 * inject a single AuditService everywhere.
 */
import { and, desc, eq, lt , type SQL} from "drizzle-orm";
import { type DrizzleDB, paymentAuditLog } from "@repo/drizzle";

/**
 * T14 — plan-change v2 audit 액션 enum.
 * action 컬럼은 string 이지만 상수화해 오탈자 방지.
 */
export const PaymentAuditAction = {
  change_plan_v2: "change_plan_v2",
  schedule_downgrade: "schedule_downgrade",
  cancel_pending_change: "cancel_pending_change",
  apply_pending_change: "apply_pending_change",
  cancel_at_period_end: "cancel_at_period_end",
  cancel_with_refund: "cancel_with_refund",
  uncancel: "uncancel",
} as const;
export type PaymentAuditAction = (typeof PaymentAuditAction)[keyof typeof PaymentAuditAction];

export interface AuditEntry {
  actorUserId: string;
  action: string;
  targetOrgId?: string;
  targetSubscriptionId?: string;
  targetUserId?: string;
  payloadBefore?: unknown;
  payloadAfter?: unknown;
  ipAddress?: string;
  userAgent?: string;
  reason?: string;
}

export interface AuditListFilter {
  actorUserId?: string;
  targetOrgId?: string;
  action?: string;
  /** Pagination: return rows with id < cursor (DESC). */
  cursor?: bigint | number;
  /** Page size, default 50, hard cap 200. */
  limit?: number;
}

export interface AuditListResult {
  rows: Array<{
    id: bigint;
    actorUserId: string;
    action: string;
    targetOrgId: string | null;
    targetSubscriptionId: string | null;
    targetUserId: string | null;
    payloadBefore: unknown;
    payloadAfter: unknown;
    ipAddress: string | null;
    userAgent: string | null;
    reason: string | null;
    createdAt: Date;
  }>;
  /** id of the last row, or null if no more pages. */
  nextCursor: bigint | null;
}

const DEFAULT_LIMIT = 50;
const MAX_LIMIT = 200;

export class AuditService {
  constructor(private readonly db: DrizzleDB) {}

  async log(entry: AuditEntry): Promise<void> {
    await this.db.insert(paymentAuditLog).values({
      actorUserId: entry.actorUserId,
      action: entry.action,
      targetOrgId: entry.targetOrgId ?? null,
      targetSubscriptionId: entry.targetSubscriptionId ?? null,
      targetUserId: entry.targetUserId ?? null,
      payloadBefore: (entry.payloadBefore ?? null) as never,
      payloadAfter: (entry.payloadAfter ?? null) as never,
      ipAddress: entry.ipAddress ?? null,
      userAgent: entry.userAgent ?? null,
      reason: entry.reason ?? null,
    });
  }

  async list(filter: AuditListFilter = {}): Promise<AuditListResult> {
    const limit = Math.min(filter.limit ?? DEFAULT_LIMIT, MAX_LIMIT);
    const conditions: SQL[] = [];
    if (filter.actorUserId) {
      conditions.push(eq(paymentAuditLog.actorUserId, filter.actorUserId));
    }
    if (filter.targetOrgId) {
      conditions.push(eq(paymentAuditLog.targetOrgId, filter.targetOrgId));
    }
    if (filter.action) {
      conditions.push(eq(paymentAuditLog.action, filter.action));
    }
    if (filter.cursor !== undefined) {
      conditions.push(lt(paymentAuditLog.id, BigInt(filter.cursor)));
    }

    const where = conditions.length ? and(...conditions) : undefined;

    const rows = await this.db
      .select()
      .from(paymentAuditLog)
      .where(where)
      .orderBy(desc(paymentAuditLog.id))
      .limit(limit);

    const nextCursor = rows.length === limit ? rows[rows.length - 1]!.id : null;
    return { rows, nextCursor };
  }
}
