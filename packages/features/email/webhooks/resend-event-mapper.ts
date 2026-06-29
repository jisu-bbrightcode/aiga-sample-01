import type { EmailStatus } from "@repo/drizzle/schema";
import type { ResendWebhookPayload } from "./resend.payload.schema";

/**
 * Pure mapping from a Resend webhook event to an `email_logs` update.
 *
 * Status precedence prevents regression: a later "opened" event must not
 * downgrade a row already marked "bounced". Timestamps (deliveredAt/openedAt)
 * are independent facts and are always recorded when first observed.
 *
 * NOTE: the `email_status` enum has no dedicated `complained` value, so spam
 * complaints are recorded as the terminal `bounced` status with an explicit
 * `failureReason`; the precise provider event is preserved in `metadata`.
 * Adding a first-class `complained` enum value is a tracked follow-up that
 * requires a Drizzle migration.
 */

const STATUS_PRIORITY: Record<EmailStatus, number> = {
  pending: 0,
  sending: 1,
  sent: 2,
  delivered: 3,
  opened: 4,
  failed: 5,
  bounced: 6,
};

export interface ResendEventUpdate {
  /** Resend message id used to locate the email_logs row. */
  emailId: string;
  /** Desired status for this event (subject to no-regression precedence). */
  desiredStatus?: EmailStatus;
  failureReason?: string;
  setDeliveredAt?: boolean;
  setOpenedAt?: boolean;
  /** Raw provider event type, persisted into metadata for audit. */
  eventType: string;
}

/**
 * Returns `null` when the event carries no `email_id` (nothing to correlate)
 * or is an event type we intentionally ignore (e.g. `email.clicked`).
 */
export function mapResendEvent(payload: ResendWebhookPayload): ResendEventUpdate | null {
  const emailId = payload.data.email_id;
  if (!emailId) return null;

  const base = { emailId, eventType: payload.type };

  switch (payload.type) {
    case "email.sent":
      return { ...base, desiredStatus: "sent" };
    case "email.delivered":
      return { ...base, desiredStatus: "delivered", setDeliveredAt: true };
    case "email.opened":
      return { ...base, desiredStatus: "opened", setOpenedAt: true };
    case "email.bounced": {
      const detail = payload.data.bounce;
      const reason = [detail?.type, detail?.subType, detail?.message]
        .filter(Boolean)
        .join(": ");
      return {
        ...base,
        desiredStatus: "bounced",
        failureReason: reason ? `bounce: ${reason}` : "bounce",
      };
    }
    case "email.complained":
      return {
        ...base,
        desiredStatus: "bounced",
        failureReason: "spam complaint (email.complained)",
      };
    case "email.failed":
      return { ...base, desiredStatus: "failed", failureReason: "provider reported failure" };
    default:
      // email.delivery_delayed (transient), email.clicked, unknown → ignore.
      return null;
  }
}

/**
 * Applies no-regression precedence. Returns the status to persist, or
 * `undefined` when the current status already dominates the desired one.
 */
export function resolveStatusUpdate(
  current: EmailStatus,
  desired: EmailStatus | undefined,
): EmailStatus | undefined {
  if (!desired) return undefined;
  return STATUS_PRIORITY[desired] > STATUS_PRIORITY[current] ? desired : undefined;
}
