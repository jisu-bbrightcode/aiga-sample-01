/**
 * In-app provider (PB-NOTI-001) — the `inapp` channel implementation of
 * {@link NotificationChannelProvider}.
 *
 * REUSE of product-builder-base `packages/features/notification` (the existing
 * inbox + WebSocket gateway). This provider adapts that inbox behind the common
 * port: it appends one inbox row via an injected {@link InboxSink}. The base
 * gateway/WebSocket push is unchanged and out of scope here.
 */

import {
  type NotificationChannelProvider,
  type ProviderResult,
  type Recipient,
  type RenderedMessage,
} from '../types.ts';

/** One inbox entry to persist for a user (handed to the base inbox repo). */
export interface InboxEntry {
  userId: string;
  body: string;
}

/** Append-to-inbox port. Production wires this to the base notification repo. */
export type InboxSink = (entry: InboxEntry) => Promise<{ id: string }>;

export class InAppProvider implements NotificationChannelProvider {
  readonly channel = 'inapp' as const;
  readonly #sink: InboxSink;

  constructor(sink: InboxSink) {
    this.#sink = sink;
  }

  async send(input: {
    recipient: Recipient;
    message: RenderedMessage;
  }): Promise<ProviderResult> {
    const { recipient, message } = input;
    if (!recipient.userId) {
      return { ok: false, error: 'no userId', retryable: false };
    }
    try {
      const { id } = await this.#sink({
        userId: recipient.userId,
        body: message.body,
      });
      return { ok: true, providerMessageId: id };
    } catch (err) {
      return {
        ok: false,
        error: err instanceof Error ? err.message : String(err),
        retryable: true,
      };
    }
  }
}
