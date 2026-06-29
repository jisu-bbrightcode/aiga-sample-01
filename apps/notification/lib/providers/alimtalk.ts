/**
 * Kakao 알림톡 (AlimTalk) provider (PB-NOTI-001) — the `alimtalk` channel
 * implementation of {@link NotificationChannelProvider}.
 *
 * AlimTalk is NEW for this build (no base impl) but is wired through the same
 * port as Resend, so the service is channel-agnostic. AlimTalk requires a
 * carrier-approved template code; a send without one is a permanent (non-
 * retryable) failure, since free-form text is rejected by the gateway.
 * Network I/O is injected as {@link AlimTalkTransport}.
 */

import {
  type NotificationChannelProvider,
  type ProviderResult,
  type Recipient,
  type RenderedMessage,
} from '../types.ts';

export interface AlimTalkSendPayload {
  /** Sender profile key (Kakao 채널 발신 프로필). */
  senderKey: string;
  /** Carrier-approved template code (from the rendered message). */
  templateCode: string;
  /** E.164 recipient phone. */
  to: string;
  /** Rendered text that must match the approved template. */
  text: string;
}

export interface AlimTalkTransportResult {
  ok: boolean;
  messageId?: string;
  error?: string;
  /** Gateway result code; >=3000 (server) treated retryable, others permanent. */
  code?: number;
}

export type AlimTalkTransport = (
  payload: AlimTalkSendPayload,
) => Promise<AlimTalkTransportResult>;

export interface AlimTalkProviderConfig {
  senderKey: string;
  transport: AlimTalkTransport;
}

/** Server-side gateway codes (>=3000) are transient; client codes are permanent. */
function isRetryableCode(code: number | undefined): boolean {
  if (code === undefined) return true;
  return code >= 3000;
}

export class AlimTalkProvider implements NotificationChannelProvider {
  readonly channel = 'alimtalk' as const;
  readonly #config: AlimTalkProviderConfig;

  constructor(config: AlimTalkProviderConfig) {
    this.#config = config;
  }

  async send(input: {
    recipient: Recipient;
    message: RenderedMessage;
  }): Promise<ProviderResult> {
    const { recipient, message } = input;
    if (!recipient.phone) {
      return { ok: false, error: 'no phone number', retryable: false };
    }
    if (!message.alimtalkTemplateCode) {
      return {
        ok: false,
        error: 'missing alimtalkTemplateCode (AlimTalk requires approved template)',
        retryable: false,
      };
    }
    let res: AlimTalkTransportResult;
    try {
      res = await this.#config.transport({
        senderKey: this.#config.senderKey,
        templateCode: message.alimtalkTemplateCode,
        to: recipient.phone,
        text: message.body,
      });
    } catch (err) {
      return { ok: false, error: errMessage(err), retryable: true };
    }
    if (res.ok) {
      return { ok: true, providerMessageId: res.messageId };
    }
    return {
      ok: false,
      error: res.error ?? `alimtalk error (code ${res.code ?? 'n/a'})`,
      retryable: isRetryableCode(res.code),
    };
  }
}

function errMessage(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}
