/**
 * AdminAuditService — append-only writer/reader for `admin_audit_log`.
 *
 * The admin shell records one row here for every privileged admin mutation
 * that is not already covered by a domain-specific audit log (payment keeps
 * its own `payment_audit_log`). This is the general audit foundation for the
 * `admin.shell-rbac` capability (PB-ADMIN-001).
 *
 * Design mirrors the payment AuditService:
 *  - `log()` is a single append-only INSERT — cheap, no locks.
 *  - `list()` powers the admin shell's audit viewer with simple cursor
 *    pagination (id DESC + optional filters).
 */

import { Injectable } from "@nestjs/common";
import { adminAuditLog, type DrizzleDB, InjectDrizzle } from "@repo/drizzle";
import { and, desc, eq, lt, type SQL } from "drizzle-orm";

/** Known admin audit actions (enforced here, not via DB enum). */
export const AdminAuditAction = {
  user_role_changed: "user.role_changed",
  user_status_changed: "user.status_changed",
} as const;
export type AdminAuditAction = (typeof AdminAuditAction)[keyof typeof AdminAuditAction];

export interface AdminAuditEntry {
  actorUserId: string;
  action: string;
  targetType?: string;
  targetId?: string;
  payloadBefore?: unknown;
  payloadAfter?: unknown;
  ipAddress?: string;
  userAgent?: string;
  reason?: string;
}

export interface AdminAuditListFilter {
  actorUserId?: string;
  action?: string;
  targetType?: string;
  targetId?: string;
  /** Pagination: return rows with id < cursor (DESC). */
  cursor?: bigint | number | string;
  /** Page size, default 50, hard cap 200. */
  limit?: number;
}

export interface AdminAuditListItem {
  id: string;
  actorUserId: string;
  action: string;
  targetType: string | null;
  targetId: string | null;
  payloadBefore: unknown;
  payloadAfter: unknown;
  ipAddress: string | null;
  userAgent: string | null;
  reason: string | null;
  createdAt: string;
}

export interface AdminAuditListResponse {
  rows: AdminAuditListItem[];
  /** id of the last row (string-encoded bigint), or null if no more pages. */
  nextCursor: string | null;
}

const DEFAULT_LIMIT = 50;
const MAX_LIMIT = 200;

@Injectable()
export class AdminAuditService {
  constructor(@InjectDrizzle() private readonly db: DrizzleDB) {}

  async log(entry: AdminAuditEntry): Promise<void> {
    await this.db.insert(adminAuditLog).values({
      actorUserId: entry.actorUserId,
      action: entry.action,
      targetType: entry.targetType ?? null,
      targetId: entry.targetId ?? null,
      payloadBefore: (entry.payloadBefore ?? null) as never,
      payloadAfter: (entry.payloadAfter ?? null) as never,
      ipAddress: entry.ipAddress ?? null,
      userAgent: entry.userAgent ?? null,
      reason: entry.reason ?? null,
    });
  }

  async list(filter: AdminAuditListFilter = {}): Promise<AdminAuditListResponse> {
    const limit = Math.min(Math.max(filter.limit ?? DEFAULT_LIMIT, 1), MAX_LIMIT);
    const conditions: SQL[] = [];
    if (filter.actorUserId) {
      conditions.push(eq(adminAuditLog.actorUserId, filter.actorUserId));
    }
    if (filter.action) {
      conditions.push(eq(adminAuditLog.action, filter.action));
    }
    if (filter.targetType) {
      conditions.push(eq(adminAuditLog.targetType, filter.targetType));
    }
    if (filter.targetId) {
      conditions.push(eq(adminAuditLog.targetId, filter.targetId));
    }
    if (filter.cursor !== undefined && filter.cursor !== null) {
      conditions.push(lt(adminAuditLog.id, BigInt(filter.cursor)));
    }

    const where = conditions.length ? and(...conditions) : undefined;

    const rows = await this.db
      .select()
      .from(adminAuditLog)
      .where(where)
      .orderBy(desc(adminAuditLog.id))
      .limit(limit);

    const nextCursor = rows.length === limit ? rows[rows.length - 1]!.id.toString() : null;

    return {
      rows: rows.map((row) => ({
        id: row.id.toString(),
        actorUserId: row.actorUserId,
        action: row.action,
        targetType: row.targetType,
        targetId: row.targetId,
        payloadBefore: row.payloadBefore,
        payloadAfter: row.payloadAfter,
        ipAddress: row.ipAddress,
        userAgent: row.userAgent,
        reason: row.reason,
        createdAt: row.createdAt.toISOString(),
      })),
      nextCursor,
    };
  }
}
