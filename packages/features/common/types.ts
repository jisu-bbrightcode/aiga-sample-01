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
