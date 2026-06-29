/**
 * Feature Common Types
 * Combined from email, community, notification features
 */

// ─── Email Types ────────────────────────────────────

import type { EmailLog as DrizzleEmailLog } from "@repo/drizzle/schema";

export type EmailStatus =
  | "pending"
  | "sending"
  | "sent"
  | "delivered"
  | "failed"
  | "bounced"
  | "opened";

export type EmailTemplateType =
  | "welcome"
  | "email-verification"
  | "password-reset"
  | "password-changed"
  | "notification";

export interface IEmailService {
  getEmailLogs(filters: EmailLogsFilters): Promise<DrizzleEmailLog[]>;
  getEmailLog(logId: string): Promise<DrizzleEmailLog | null>;
  resendEmail(logId: string): Promise<DrizzleEmailLog>;
}

export interface SendEmailInput {
  recipientEmail: string;
  recipientName?: string;
  recipientId?: string;
  templateType: EmailTemplateType;
  subject: string;
  variables: Record<string, unknown>;
}

export interface SendEmailResult {
  messageId: string;
  success: boolean;
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

export interface EmailProvider {
  send(options: SendEmailOptions): Promise<SendEmailResult>;
}

export type EmailLogSerialized = Omit<
  DrizzleEmailLog,
  "createdAt" | "updatedAt" | "sentAt" | "deliveredAt" | "openedAt" | "metadata"
> & {
  createdAt: string;
  updatedAt: string;
  sentAt: string | null;
  deliveredAt: string | null;
  openedAt: string | null;
  metadata?: unknown;
};

export const EMAIL_STATUS_LABELS: Record<EmailStatus, string> = {
  pending: "대기중",
  sending: "발송중",
  sent: "발송완료",
  delivered: "전달완료",
  failed: "실패",
  bounced: "반송",
  opened: "열람",
};

export const EMAIL_STATUS_COLORS: Record<
  EmailStatus,
  "default" | "secondary" | "destructive" | "outline"
> = {
  pending: "secondary",
  sending: "default",
  sent: "default",
  delivered: "default",
  failed: "destructive",
  bounced: "destructive",
  opened: "default",
};

export const EMAIL_TEMPLATE_LABELS: Record<EmailTemplateType, string> = {
  welcome: "환영 이메일",
  "email-verification": "이메일 인증",
  "password-reset": "비밀번호 재설정",
  "password-changed": "비밀번호 변경 알림",
  notification: "알림",
};

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
}

export interface NotificationVariables {
  userName: string;
  title: string;
  message: string;
  actionUrl?: string;
  actionText?: string;
}

// ─── Notification Types ─────────────────────────────

// ============================================================================
// API Response Types
// ============================================================================

export interface NotificationWithMeta {
  id: string;
  userId: string;
  type: "comment" | "like" | "follow" | "mention" | "system" | "announcement";
  title: string;
  content: string | null;
  data: unknown;
  readAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface NotificationListResponse {
  items: NotificationWithMeta[];
  total: number;
  page: number;
  limit: number;
  hasMore: boolean;
}

export interface UnreadCountResponse {
  count: number;
}

// ============================================================================
// Filter Types
// ============================================================================

export interface NotificationFilters {
  page?: number;
  limit?: number;
  unreadOnly?: boolean;
  type?: string;
}

export interface SettingsFilters {
  type?: string;
}

// ============================================================================
// Client Types (serialized dates)
// ============================================================================

export interface NotificationItem {
  id: string;
  userId: string;
  type: "comment" | "like" | "follow" | "mention" | "system" | "announcement";
  title: string;
  content: string | null;
  data?: unknown;
  readAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface NotificationListFilters {
  page?: number;
  limit?: number;
  unreadOnly?: boolean;
  type?: string;
}

export interface NotificationSetting {
  type: string;
  enabled: boolean;
  channels: string[];
}
