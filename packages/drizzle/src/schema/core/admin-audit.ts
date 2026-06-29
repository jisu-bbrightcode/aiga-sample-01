import { sql } from "drizzle-orm";
import { bigserial, index, jsonb, pgTable, text, timestamp } from "drizzle-orm/pg-core";
import { user } from "./auth-tables";

/**
 * Admin Audit Log (general admin shell / RBAC).
 *
 * Append-only trail of every privileged admin mutation that is NOT already
 * covered by a domain-specific audit log (e.g. payment has its own
 * `payment_audit_log`). The admin shell writes one row here whenever an
 * operator changes core admin/RBAC state — for example granting or revoking
 * an admin role.
 *
 * Design mirrors `payment_audit_log`: a single cheap INSERT, never updated,
 * `bigserial` PK so concurrent inserts never collide. `targetType` + `targetId`
 * are free-form so any admin surface can record what it touched without a new
 * column per domain.
 */
export const adminAuditLog = pgTable(
  "admin_audit_log",
  {
    id: bigserial("id", { mode: "bigint" }).primaryKey(),

    /** Operator who performed the action. */
    actorUserId: text("actor_user_id")
      .notNull()
      .references(() => user.id),

    /**
     * Known action values (enforced at the service layer, not a DB enum):
     *   user.role_changed | user.role_granted | user.role_revoked
     * New admin surfaces append their own `<domain>.<verb>` strings.
     */
    action: text("action").notNull(),

    /** Free-form target descriptor, e.g. "user", "organization". */
    targetType: text("target_type"),
    /** Identifier of the affected entity within `targetType`. */
    targetId: text("target_id"),

    payloadBefore: jsonb("payload_before"),
    payloadAfter: jsonb("payload_after"),

    ipAddress: text("ip_address"),
    userAgent: text("user_agent"),
    reason: text("reason"),

    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("admin_audit_log_actor_created_idx").on(table.actorUserId, sql`${table.createdAt} DESC`),
    index("admin_audit_log_target_idx").on(table.targetType, table.targetId),
  ],
);

export type AdminAuditLogRow = typeof adminAuditLog.$inferSelect;
export type NewAdminAuditLogRow = typeof adminAuditLog.$inferInsert;
