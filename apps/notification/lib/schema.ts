/**
 * `notification_logs` table (PB-NOTI-001) — the persisted send-history model.
 *
 * EXTEND of product-builder-base `email_logs` (which already carries
 * `status` / `provider_message_id` / `retry_count` / `error`): we generalize
 * it from email-only to every channel by adding `channel`, `template_key`,
 * `correlation_id`, and `idempotency_key`.
 *
 * Stack is Neon (Postgres) + Drizzle per PB-REPO-001 §6 / workflow rules. The
 * real Drizzle table object lives in `packages/drizzle/**\/notification` on the
 * delivery repo seed; this module ships the migration DDL + a typed column spec
 * so the shape is defined and testable without importing the drizzle package
 * into this framework-agnostic capability core.
 */

import { type Channel, type DeliveryStatus } from './types.ts';

/** Column spec mirrored 1:1 by the Drizzle table + the DDL below. */
export interface NotificationLogColumns {
  id: string;
  correlation_id: string;
  template_key: string;
  channel: Channel;
  to_address: string;
  status: DeliveryStatus;
  retry_count: number;
  provider_message_id: string | null;
  error: string | null;
  idempotency_key: string | null;
  created_at: string;
  updated_at: string;
}

/** Allowed status values — kept in sync with {@link DeliveryStatus}. */
export const NOTIFICATION_STATUS_VALUES: readonly DeliveryStatus[] = [
  'pending',
  'sent',
  'failed',
  'skipped',
];

/** Allowed channel values — kept in sync with {@link Channel}. */
export const NOTIFICATION_CHANNEL_VALUES: readonly Channel[] = [
  'email',
  'alimtalk',
  'inapp',
];

/**
 * Forward migration DDL for Neon/Postgres. The partial unique index on
 * (idempotency_key, channel) enforces the idempotent-resend guarantee at the
 * database level, not just in app code.
 */
export const NOTIFICATION_LOGS_UP_SQL = `
CREATE TABLE IF NOT EXISTS notification_logs (
  id                  text PRIMARY KEY,
  correlation_id      text NOT NULL,
  template_key        text NOT NULL,
  channel             text NOT NULL,
  to_address          text NOT NULL,
  status              text NOT NULL DEFAULT 'pending',
  retry_count         integer NOT NULL DEFAULT 0,
  provider_message_id text,
  error               text,
  idempotency_key     text,
  created_at          timestamptz NOT NULL DEFAULT now(),
  updated_at          timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS notification_logs_correlation_idx
  ON notification_logs (correlation_id);
CREATE INDEX IF NOT EXISTS notification_logs_template_idx
  ON notification_logs (template_key, created_at);
CREATE UNIQUE INDEX IF NOT EXISTS notification_logs_idem_uq
  ON notification_logs (idempotency_key, channel)
  WHERE idempotency_key IS NOT NULL;
`.trim();

/** Down migration. */
export const NOTIFICATION_LOGS_DOWN_SQL = `
DROP TABLE IF EXISTS notification_logs;
`.trim();
