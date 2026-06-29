/**
 * notification.core shared types + ports (PB-NOTI-001).
 *
 * EXTEND of product-builder-base @111d7721:
 *   - `packages/features/notification/` — in-app inbox + WebSocket gateway
 *     (no templates, no external send, no retry). We keep `inapp` as a channel.
 *   - `packages/features/email/` — `EmailProvider.send()` port + `ResendProvider`
 *     + template service, and an `email_logs` table that already carries
 *     `status` / `providerMessageId` / `retryCount` / `error`.
 *
 * The delta this capability implements:
 *   1. Generalize the single-channel `EmailProvider.send()` into a
 *      provider-agnostic {@link NotificationChannelProvider} per channel.
 *   2. A `<domain>.<event>` {@link TemplateKey} registry so new notifications
 *      are added by config, not code (acceptance #1).
 *   3. Channel routing driven by feature selection (acceptance #2).
 *   4. A unified send-history + retry model that generalizes `email_logs`
 *      to every channel (acceptance #3).
 *
 * Privacy alignment (PB-API-001 §1.6 / PB-LOG-001): history records store the
 * resolved channel address only as a redactable `to` field — never RRN / KCB
 * CI·DI. Render variables must not include raw secrets.
 */

/**
 * Delivery channels. `email` and `alimtalk` are the two selectable external
 * channels from the AIGA feature set; `inapp` is the always-available base
 * notification inbox (product-builder-base packages/features/notification).
 */
export type Channel = 'email' | 'alimtalk' | 'inapp';

/** All channels known to the capability, in routing-preference order. */
export const ALL_CHANNELS: readonly Channel[] = ['inapp', 'email', 'alimtalk'];

/**
 * A template key in `<domain>.<event>` form, e.g. `auth.password_reset`,
 * `payment.receipt`. Validated by {@link TEMPLATE_KEY_PATTERN}.
 */
export type TemplateKey = string;

/** `<domain>.<event>` — lowercase domain + single dot + lowercase event. */
export const TEMPLATE_KEY_PATTERN = /^[a-z][a-z0-9_]*\.[a-z][a-z0-9_]*$/;

/** Per-channel rendered payload handed to a provider. */
export interface RenderedMessage {
  /** Subject line (email) — ignored by channels that have no subject. */
  subject?: string;
  /** Plain-text / template body. */
  body: string;
  /**
   * For `alimtalk`: the Kakao-approved template code the body corresponds to.
   * AlimTalk requires a pre-registered template code; free-form text is rejected
   * by the carrier, so this is required when routing to `alimtalk`.
   */
  alimtalkTemplateCode?: string;
}

/** A renderer turns template variables into a per-channel {@link RenderedMessage}. */
export type ChannelRenderer = (vars: TemplateVars) => RenderedMessage;

/** Free-form, JSON-serialisable template variables. Must not carry secrets. */
export type TemplateVars = Record<string, string | number | boolean>;

/**
 * A registered template: a `<domain>.<event>` key, the channels it may be
 * delivered on (in preference order), and a renderer per channel.
 */
export interface TemplateDefinition {
  key: TemplateKey;
  /** Channels this template supports, in fallback-preference order. */
  channels: readonly Channel[];
  /** Renderer per supported channel. Missing renderer for a channel is invalid. */
  renderers: Partial<Record<Channel, ChannelRenderer>>;
}

/** Recipient addressing, resolved per channel by the caller. */
export interface Recipient {
  /** Stable user id for in-app delivery + history correlation. */
  userId?: string;
  /** Email address (required to deliver on `email`). */
  email?: string;
  /** E.164 phone for `alimtalk` (required to deliver on `alimtalk`). */
  phone?: string;
}

/** What the caller asks the service to send. */
export interface SendRequest {
  templateKey: TemplateKey;
  recipient: Recipient;
  vars: TemplateVars;
  /**
   * Caller-supplied idempotency key. Two sends with the same key resolve to the
   * same history record instead of double-sending (mirrors payment receipts).
   */
  idempotencyKey?: string;
  /** Restrict delivery to a subset of the template's channels (optional). */
  onlyChannels?: readonly Channel[];
}

/** Terminal/transient status of a single channel attempt — mirrors `email_logs.status`. */
export type DeliveryStatus = 'pending' | 'sent' | 'failed' | 'skipped';

/** Result of one provider send attempt. */
export interface ProviderResult {
  ok: boolean;
  /** Carrier message id on success (→ history `providerMessageId`). */
  providerMessageId?: string;
  /** Error message on failure (→ history `error`). */
  error?: string;
  /**
   * Whether a failure is worth retrying (rate limit / 5xx / network) vs.
   * permanent (invalid address, unknown template). Defaults to non-retryable.
   */
  retryable?: boolean;
}

/**
 * The provider port. Generalizes product-builder-base `EmailProvider.send()`
 * to any channel. One implementation per channel (Resend, AlimTalk, in-app).
 */
export interface NotificationChannelProvider {
  readonly channel: Channel;
  /** Deliver one rendered message to one recipient. Must not throw for
   *  expected delivery failures — return `{ ok: false, ... }` instead. */
  send(input: {
    recipient: Recipient;
    message: RenderedMessage;
  }): Promise<ProviderResult>;
}

/**
 * One persisted send-history row — the unified generalization of `email_logs`.
 * Written for every (send, channel) pair so history + retry are queryable.
 */
export interface NotificationLogRecord {
  id: string;
  /** Groups all channel rows for a single {@link SendRequest}. */
  correlationId: string;
  templateKey: TemplateKey;
  channel: Channel;
  /** Redactable resolved address (email/phone/userId). */
  to: string;
  status: DeliveryStatus;
  /** 0 on first attempt; incremented per retry (mirrors `email_logs.retryCount`). */
  retryCount: number;
  providerMessageId?: string;
  error?: string;
  idempotencyKey?: string;
  /** ISO-8601 UTC. */
  createdAt: string;
  updatedAt: string;
}

/** Persistence port for send history. In-memory + Drizzle impls exist. */
export interface NotificationHistoryStore {
  /** Look up an existing record by idempotency key + channel, if any. */
  findByIdempotencyKey(
    key: string,
    channel: Channel,
  ): Promise<NotificationLogRecord | null>;
  /** Insert a new record (status usually `pending`). */
  create(record: NotificationLogRecord): Promise<void>;
  /** Patch status/retryCount/providerMessageId/error/updatedAt. */
  update(
    id: string,
    patch: Partial<
      Pick<
        NotificationLogRecord,
        'status' | 'retryCount' | 'providerMessageId' | 'error' | 'updatedAt'
      >
    >,
  ): Promise<void>;
  /** All rows for a correlation id (for the service result + debugging). */
  listByCorrelation(correlationId: string): Promise<NotificationLogRecord[]>;
}

/** Injectable clock — real `Date` in production, frozen in tests. */
export type Clock = () => Date;

/** Injectable id generator — uuid in production, deterministic in tests. */
export type IdGen = () => string;
