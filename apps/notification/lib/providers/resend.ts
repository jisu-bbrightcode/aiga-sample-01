/**
 * Resend email provider (PB-NOTI-001) — the `email` channel implementation of
 * {@link NotificationChannelProvider}.
 *
 * EXTEND of product-builder-base `packages/features/email` `ResendProvider`:
 * same Resend REST contract, but adapted to the provider-agnostic port so the
 * service treats it identically to AlimTalk / in-app. Network I/O is injected
 * as a {@link ResendTransport} so this is unit-testable and the production wire
 * (real `fetch` to https://api.resend.com/emails) lives in one place.
 */

import {
  type NotificationChannelProvider,
  type ProviderResult,
  type Recipient,
  type RenderedMessage,
} from '../types.ts';

/** Minimal Resend send payload (subset we use). */
export interface ResendSendPayload {
  from: string;
  to: string;
  subject: string;
  text: string;
}

/** Transport response — `ok` + carrier id, or an error with retryability. */
export interface ResendTransportResult {
  ok: boolean;
  id?: string;
  error?: string;
  /** HTTP status, used to classify retryability when the transport sets it. */
  status?: number;
}

/** Injected network call. Production passes a `fetch`-backed impl. */
export type ResendTransport = (
  payload: ResendSendPayload,
) => Promise<ResendTransportResult>;

export interface ResendProviderConfig {
  /** Verified sender, e.g. `AIGA <no-reply@aiga.example>`. */
  from: string;
  transport: ResendTransport;
}

/** Resend statuses worth retrying: rate limit + server errors. */
function isRetryableStatus(status: number | undefined): boolean {
  if (status === undefined) return true; // network/unknown → retry
  return status === 429 || status >= 500;
}

export class ResendProvider implements NotificationChannelProvider {
  readonly channel = 'email' as const;
  readonly #config: ResendProviderConfig;

  constructor(config: ResendProviderConfig) {
    this.#config = config;
  }

  async send(input: {
    recipient: Recipient;
    message: RenderedMessage;
  }): Promise<ProviderResult> {
    const { recipient, message } = input;
    if (!recipient.email) {
      return { ok: false, error: 'no email address', retryable: false };
    }
    let res: ResendTransportResult;
    try {
      res = await this.#config.transport({
        from: this.#config.from,
        to: recipient.email,
        subject: message.subject ?? '(no subject)',
        text: message.body,
      });
    } catch (err) {
      // Transport threw (network) — treat as retryable transient failure.
      return { ok: false, error: errMessage(err), retryable: true };
    }
    if (res.ok) {
      return { ok: true, providerMessageId: res.id };
    }
    return {
      ok: false,
      error: res.error ?? `resend error (status ${res.status ?? 'n/a'})`,
      retryable: isRetryableStatus(res.status),
    };
  }
}

function errMessage(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}
