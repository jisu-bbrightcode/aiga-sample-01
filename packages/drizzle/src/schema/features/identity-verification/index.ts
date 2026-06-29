import { sql } from "drizzle-orm";
import { boolean, index, integer, pgEnum, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";

import { users } from "../../core/better-auth";

// ============================================================================
// Enums
// ============================================================================
export const identityVerificationProviderEnum = pgEnum("identity_verification_provider", ["kcb"]);

export const identityVerificationModeEnum = pgEnum("identity_verification_mode", [
  "standard",
  "custom",
]);

// Aligned with the contract status set in
// packages/features/identity-verification/kcb/contracts.ts so the verification
// lifecycle (success/failure/cancel/expiry/retry) is fully distinguishable at the
// DB layer. `pending` covers the redirect→callback gap; `canceled` is the explicit
// user-abort outcome (the base 0045 enum omitted both).
export const identityVerificationRequestStatusEnum = pgEnum(
  "identity_verification_request_status",
  ["created", "redirected", "pending", "verified", "failed", "canceled", "expired"],
);

// Per-attempt terminal outcome recorded in identity_verification_attempts. A request
// may accumulate several attempts (retries); each one is an immutable audit row.
export const identityVerificationAttemptOutcomeEnum = pgEnum(
  "identity_verification_attempt_outcome",
  ["redirected", "verified", "failed", "canceled", "expired"],
);

// Minimal sex field retained from the verified KCB result (내외국인 여부 is stored
// separately as is_foreigner). KCB returns a binary sex code; richer values are not
// part of the verified payload, so the enum is intentionally narrow.
export const identityVerificationGenderEnum = pgEnum("identity_verification_gender", [
  "male",
  "female",
]);

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
// to the client in the API response and never persisted.
//
// AIGA EXTEND (PB-IDV-KCB-DATA-001 / BBR-572) adds the customer-required delta on top
// of the verified base capability:
//   - consent fields on the request (동의 버전/범위/시각) — the service's own consent
//     capture, retained as evidence independent of the provider popup;
//   - identity_verification_attempts — an immutable per-attempt audit log that also
//     drives retry accounting;
//   - minimal verified identity fields (생년월일 masked / 성별 / 내외국인 여부) and an
//     anonymized_at column distinct from deleted_at (anonymization vs hard delete).
//
// Privacy invariants (do not regress):
//   - 주민등록번호(RRN) and the raw KCB authentication payload are NEVER stored.
//   - CI/DI are persisted only as one-way salted hashes (ci_hash/di_hash) for
//     dedup/linking, never plaintext, never displayed; name/phone/birthdate are masked.
//   - Read access to hashes/masked identity is restricted to the admin controller.
// Retention/delete/anonymization/audit retention policy: see migration 0047 header and
// the BBR-572 issue thread.

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
    // Consent capture (AIGA delta). Recorded when the user agrees to the identity
    // verification, before the provider popup, and retained as the service's own
    // consent evidence regardless of the verification outcome.
    consentVersion: text("consent_version"),
    consentScope: text("consent_scope"),
    consentedAt: timestamp("consented_at", { withTimezone: true }),
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
    // Minimal verified identity fields retained for the service (AIGA delta). All are
    // masked/coarse — no RRN, no raw payload. birthDateMasked e.g. "1990-**-**".
    birthDateMasked: text("birth_date_masked"),
    gender: identityVerificationGenderEnum("gender"),
    isForeigner: boolean("is_foreigner"),
    verifiedAt: timestamp("verified_at", { withTimezone: true }).notNull(),
    retainedUntil: timestamp("retained_until", { withTimezone: true }),
    // anonymized_at: identity fields nulled/anonymized in place but the row kept for
    // audit linkage. deleted_at: soft hard-delete. The two are independent lifecycle
    // outcomes per the retention policy.
    anonymizedAt: timestamp("anonymized_at", { withTimezone: true }),
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

// identity_verification_attempts — immutable per-attempt audit log (AIGA delta).
// One row per redirect/callback attempt within a request. Serves two purposes:
//   1. Retry accounting (attempt_no within a request).
//   2. Audit trail (who/when/from-where + non-sensitive provider result codes).
// Only non-sensitive codes are stored here — never CI/DI, RRN, or raw payload.
export const identityVerificationAttempts = pgTable(
  "identity_verification_attempts",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    requestId: uuid("request_id")
      .notNull()
      .references(() => identityVerificationRequests.id, { onDelete: "cascade" }),
    attemptNo: integer("attempt_no").notNull(),
    outcome: identityVerificationAttemptOutcomeEnum("outcome").notNull(),
    resultCode: text("result_code"),
    failureCode: text("failure_code"),
    clientIp: text("client_ip"),
    userAgent: text("user_agent"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("identity_verification_attempts_request_attempt_idx").on(
      table.requestId,
      table.attemptNo,
    ),
    index("identity_verification_attempts_created_idx").on(sql`${table.createdAt} DESC`),
  ],
);

// ============================================================================
// Type Exports
// ============================================================================
export type IdentityVerificationRequest = typeof identityVerificationRequests.$inferSelect;
export type NewIdentityVerificationRequest = typeof identityVerificationRequests.$inferInsert;
export type IdentityVerification = typeof identityVerifications.$inferSelect;
export type NewIdentityVerification = typeof identityVerifications.$inferInsert;
export type IdentityVerificationAttempt = typeof identityVerificationAttempts.$inferSelect;
export type NewIdentityVerificationAttempt = typeof identityVerificationAttempts.$inferInsert;
