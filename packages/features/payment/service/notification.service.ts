/**
 * NotificationService — transactional email wrapper around Resend.
 *
 * Phase 12 scope:
 *  - 6 transactional templates rendered via `@react-email/render`. The
 *    `onSubscriptionCreated` hook keeps its inline-HTML stub (not in the
 *    spec §10 list — left untouched per surgical-changes rule).
 *  - Disabled mode: when `cfg.apiKey` is empty (CI / pre-Phase 13 boot),
 *    the service silently no-ops on every send.
 *  - Best-effort delivery: a Resend failure must NOT bust the webhook
 *    pipeline that triggered it. We log and swallow.
 *
 * Recipient lookup:
 *  Callers are responsible for resolving `userEmail` (typically from
 *  better-auth `users` via the org owner). When `userEmail` is missing we
 *  silently skip.
 */
import { render } from "@react-email/render";
import { Resend } from "resend";
import {
  PaymentFailedEmail,
  PaymentSucceededEmail,
  RefundCompletedEmail,
  RenewalUpcomingEmail,
  SoftSuspendEmail,
  TopUpCompletedEmail,
  paymentFailedSubject,
  paymentSucceededSubject,
  refundCompletedSubject,
  renewalUpcomingSubject,
  softSuspendSubject,
  topUpCompletedSubject,
} from "../templates";

export interface NotificationConfig {
  /** Empty string disables sending. */
  apiKey: string;
  /** RFC 5322 from address — e.g. "Product Builder <noreply@example.com>". */
  from: string;
}

interface SubscriptionPayload {
  id: string;
  organizationId: string;
  userEmail?: string;
  planName?: string;
}

interface PaymentSucceededPayload extends SubscriptionPayload {
  amountCents?: number;
  nextBillingDate?: Date;
  userName?: string;
}

interface PaymentFailedPayload extends SubscriptionPayload {
  reason?: string;
  gracePeriodEndsAt?: Date;
  retryUrl?: string;
}

interface RenewalUpcomingPayload extends SubscriptionPayload {
  amountCents?: number;
  renewsAt?: Date;
}

interface RefundPayload {
  refundId: string;
  organizationId: string;
  userEmail?: string;
  amountCents?: number;
  reason?: string;
}

interface SoftSuspendPayload extends SubscriptionPayload {
  gracePeriodEndsAt?: Date;
  dataPurgeAt?: Date;
  restoreUrl?: string;
}

interface TopUpPayload {
  orderId: string;
  organizationId: string;
  userEmail?: string;
  amountCents?: number;
  credits?: number;
  newBalance?: number;
}

export class NotificationService {
  private readonly client: Resend | null;

  constructor(
    private readonly cfg: NotificationConfig,
    clientOverride?: Resend,
  ) {
    this.client = clientOverride ?? (cfg.apiKey ? new Resend(cfg.apiKey) : null);
  }

  /** True iff a real Resend client is wired up. Useful for tests. */
  get enabled(): boolean {
    return this.client !== null;
  }

  async onSubscriptionCreated(p: SubscriptionPayload): Promise<void> {
    // Not in spec §10 — keep simple inline stub (no template).
    await this.send({
      to: p.userEmail,
      subject: `[Product Builder] 구독이 시작되었습니다${p.planName ? ` — ${p.planName}` : ""}`,
      html: `<p>구독이 시작되었습니다. 플랜: ${p.planName ?? "(unknown)"}.</p>`,
    });
  }

  async onPaymentSucceeded(p: PaymentSucceededPayload): Promise<void> {
    if (!this.client || !p.userEmail) return;
    const props = {
      planName: p.planName ?? "구독",
      amountCents: p.amountCents ?? 0,
      nextBillingDate: p.nextBillingDate,
      userName: p.userName,
    };
    const html = await render(PaymentSucceededEmail(props));
    await this.send({
      to: p.userEmail,
      subject: paymentSucceededSubject(props),
      html,
    });
  }

  async onPaymentFailed(p: PaymentFailedPayload): Promise<void> {
    if (!this.client || !p.userEmail) return;
    const props = {
      planName: p.planName,
      reason: p.reason,
      gracePeriodEndsAt: p.gracePeriodEndsAt,
      retryUrl: p.retryUrl,
    };
    const html = await render(PaymentFailedEmail(props));
    await this.send({
      to: p.userEmail,
      subject: paymentFailedSubject(props),
      html,
    });
  }

  async onRenewalUpcoming(p: RenewalUpcomingPayload): Promise<void> {
    if (!this.client || !p.userEmail) return;
    const props = {
      planName: p.planName ?? "구독",
      amountCents: p.amountCents ?? 0,
      renewsAt: p.renewsAt ?? new Date(),
    };
    const html = await render(RenewalUpcomingEmail(props));
    await this.send({
      to: p.userEmail,
      subject: renewalUpcomingSubject(props),
      html,
    });
  }

  async onRefundCompleted(p: RefundPayload): Promise<void> {
    if (!this.client || !p.userEmail) return;
    const props = {
      amountCents: p.amountCents ?? 0,
      refundId: p.refundId,
      reason: p.reason,
    };
    const html = await render(RefundCompletedEmail(props));
    await this.send({
      to: p.userEmail,
      subject: refundCompletedSubject(props),
      html,
    });
  }

  async onSoftSuspend(p: SoftSuspendPayload): Promise<void> {
    if (!this.client || !p.userEmail) return;
    const props = {
      planName: p.planName ?? "구독",
      gracePeriodEndsAt: p.gracePeriodEndsAt ?? new Date(),
      dataPurgeAt: p.dataPurgeAt ?? new Date(),
      restoreUrl: p.restoreUrl ?? "https://example.com/billing",
    };
    const html = await render(SoftSuspendEmail(props));
    await this.send({
      to: p.userEmail,
      subject: softSuspendSubject(props),
      html,
    });
  }

  async onTopUpCompleted(p: TopUpPayload): Promise<void> {
    if (!this.client || !p.userEmail) return;
    const props = {
      credits: p.credits ?? 0,
      amountCents: p.amountCents ?? 0,
      newBalance: p.newBalance ?? 0,
    };
    const html = await render(TopUpCompletedEmail(props));
    await this.send({
      to: p.userEmail,
      subject: topUpCompletedSubject(props),
      html,
    });
  }

  // ──────────────────────────────────────────────────────────────────
  // Internals
  // ──────────────────────────────────────────────────────────────────

  private async send(args: {
    to: string | undefined;
    subject: string;
    html: string;
  }): Promise<void> {
    if (!this.client || !args.to) return;
    try {
      const result = await this.client.emails.send({
        from: this.cfg.from,
        to: args.to,
        subject: args.subject,
        html: args.html,
      });
      if (result.error) {
        // eslint-disable-next-line no-console
        console.warn("[notification] resend error", result.error.message);
      }
    } catch (err) {
      // Best-effort: don't bust the upstream pipeline.
      // eslint-disable-next-line no-console
      console.warn("[notification] resend threw", (err as Error).message);
    }
  }
}
