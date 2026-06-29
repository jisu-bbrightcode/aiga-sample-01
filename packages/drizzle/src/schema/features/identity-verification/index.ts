import { sql } from "drizzle-orm";
import { index, pgEnum, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";

import { users } from "../../core/better-auth";

// ============================================================================
// Enums
// ============================================================================
export const identityVerificationProviderEnum = pgEnum("identity_verification_provider", ["kcb"]);

export const identityVerificationModeEnum = pgEnum("identity_verification_mode", [
  "standard",
  "custom",
]);

export const identityVerificationRequestStatusEnum = pgEnum(
  "identity_verification_request_status",
  ["created", "redirected", "verified", "failed", "expired"],
);

// ============================================================================
// Tables
// ============================================================================
//
// The external provider (KCB) performs and bills for the actual verification, so
// we keep only two slim tables:
//
// 1. identity_verification_requests — one row per verification transaction. It is
//    the handshake-correlation record (state/nonce/module-token hashes), the audit
//    record (provider_transaction_id must be retained for KCB 민원조회), and the
//    basis for rate limiting (user_id / client_ip + created_at). Transient by
//    nature — safe to prune expired rows.
// 2. identity_verifications — the verified identity result, linked to a user. The
//    user link is nullable so verification can run before signup (anonymous); the
//    builder attaches user_id afterwards.
//
// Provider session/redirect state (redirect form, mdl token, popup url) is returned
// to the client in the API response and never persisted. No consent / event-timeline
// / admin-action tables — consent is collected by the KCB popup and operational
// history lives in structured logs.

export const identityVerificationRequests = pgTable(
  "identity_verification_requests",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: text("user_id").references(() => users.id, { onDelete: "set null" }),
    clientIp: text("client_ip"),
    provider: identityVerificationProviderEnum("provider").notNull().default("kcb"),
    mode: identityVerificationModeEnum("mode").notNull().default("standard"),
    targetAction: text("target_action").notNull(),
    status: identityVerificationRequestStatusEnum("status").notNull().default("created"),
    moduleTokenHash: text("module_token_hash"),
    stateHash: text("state_hash").notNull(),
    nonceHash: text("nonce_hash").notNull(),
    providerTransactionId: text("provider_transaction_id"),
    resultCode: text("result_code"),
    failureCode: text("failure_code"),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("identity_verification_requests_user_created_idx").on(
      table.userId,
      sql`${table.createdAt} DESC`,
    ),
    index("identity_verification_requests_ip_created_idx").on(
      table.clientIp,
      sql`${table.createdAt} DESC`,
    ),
    index("identity_verification_requests_status_expires_idx").on(table.status, table.expiresAt),
    index("identity_verification_requests_module_token_idx").on(table.moduleTokenHash),
    index("identity_verification_requests_provider_tx_idx").on(table.providerTransactionId),
  ],
);

export const identityVerifications = pgTable(
  "identity_verifications",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    requestId: uuid("request_id")
      .notNull()
      .references(() => identityVerificationRequests.id, { onDelete: "cascade" }),
    userId: text("user_id").references(() => users.id, { onDelete: "cascade" }),
    provider: identityVerificationProviderEnum("provider").notNull().default("kcb"),
    ciHash: text("ci_hash"),
    diHash: text("di_hash"),
    nameMasked: text("name_masked"),
    phoneMasked: text("phone_masked"),
    birthYear: text("birth_year"),
    verifiedAt: timestamp("verified_at", { withTimezone: true }).notNull(),
    retainedUntil: timestamp("retained_until", { withTimezone: true }),
    deletedAt: timestamp("deleted_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("identity_verifications_user_verified_idx").on(
      table.userId,
      sql`${table.verifiedAt} DESC`,
    ),
    index("identity_verifications_ci_hash_idx").on(table.ciHash),
    index("identity_verifications_request_idx").on(table.requestId),
  ],
);

// ============================================================================
// Type Exports
// ============================================================================
export type IdentityVerificationRequest = typeof identityVerificationRequests.$inferSelect;
export type NewIdentityVerificationRequest = typeof identityVerificationRequests.$inferInsert;
export type IdentityVerification = typeof identityVerifications.$inferSelect;
export type NewIdentityVerification = typeof identityVerifications.$inferInsert;
