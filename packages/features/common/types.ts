import type { EmailLog, EmailStatus, EmailTemplateType } from "@repo/drizzle/schema";

export type { EmailStatus, EmailTemplateType };

export interface SendEmailInput {
  recipientEmail: string;
  recipientName?: string | null;
  recipientId?: string;
  templateType: EmailTemplateType;
  subject: string;
  variables: Record<string, unknown>;
}

/**
 * Send an email by stable template key (PB-NOTI-EMAIL-TEMPLATE-001 / BBR-656).
 * The published version's variable schema is validated before send; subject and
 * body are rendered from the registry rather than supplied by the caller.
 */
export interface SendTemplateEmailInput {
  key: string;
  recipientEmail: string;
  recipientName?: string | null;
  recipientId?: string;
  variables: Record<string, unknown>;
  /**
   * Optional idempotency key (PB-NOTI-EMAIL-SEND-001 / BBR-661). When supplied, a
   * prior send recorded under the same key is returned without re-sending, so a
   * retried transactional request does not double-send.
   */
  idempotencyKey?: string;
}

/**
 * Operator test send of a template (PB-NOTI-EMAIL-SEND-001 / BBR-661). Renders the
 * published version and sends through the real provider so the operator can verify
 * delivery. `variables` is optional — when omitted a type-correct sample is
 * synthesized from the template's schema. Test sends bypass the duplicate-send
 * window but are still rate-limited and recorded in the send log.
 */
export interface TestSendEmailInput {
  key: string;
  recipientEmail: string;
  recipientName?: string | null;
  variables?: Record<string, unknown>;
  idempotencyKey?: string;
  /** Admin who triggered the test send (recorded in the log metadata). */
  actorUserId?: string | null;
}

export interface EmailLogsFilters {
  page?: number;
  limit?: number;
  status?: EmailStatus;
  templateType?: EmailTemplateType;
  search?: string;
}

export interface SendEmailOptions {
  to: string;
  subject: string;
  html: string;
  from?: string;
}

export interface SendEmailResult {
  messageId: string;
  success: boolean;
}

export interface EmailProvider {
  send(options: SendEmailOptions): Promise<SendEmailResult>;
}

export interface WelcomeEmailVariables {
  userName: string;
  loginUrl: string;
}

export interface EmailVerificationVariables {
  userName: string;
  verifyUrl: string;
}

export interface PasswordResetVariables {
  userName: string;
  resetUrl: string;
  expiresIn: string;
}

export interface PasswordChangedVariables {
  userName: string;
  changedAt: string;
  supportUrl: string;
}

export interface NotificationEmailVariables {
  title: string;
  body: string;
  actionLabel?: string;
  actionUrl?: string;
}

export interface IEmailService {
  getEmailLogs(filters: EmailLogsFilters): Promise<EmailLog[]>;
  getEmailLog(logId: string): Promise<EmailLog | null>;
  resendEmail(logId: string): Promise<EmailLog>;
}

export type ReactionType = "like" | "love" | "haha" | "wow" | "sad" | "angry";

export interface ReactionTypeCount {
  type: ReactionType;
  count: number;
}

export interface ReactionCounts {
  total: number;
  byType: ReactionTypeCount[];
}

export interface UserReactionStatus {
  hasReacted: boolean;
  types: ReactionType[];
}

export interface ToggleReactionResult {
  added: boolean;
  type: ReactionType;
}

export interface RemoveReactionResult {
  removed: boolean;
  counts: ReactionCounts;
}

export interface SetReactionResult {
  type: ReactionType;
  // false when the user already had this exact reaction (idempotent no-op).
  changed: boolean;
  counts: ReactionCounts;
}

export interface NotificationListResponse {
  items: unknown[];
  total: number;
  page: number;
  limit: number;
  hasMore: boolean;
}

export interface UnreadCountResponse {
  count: number;
}
