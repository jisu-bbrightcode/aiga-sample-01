/**
 * Email template-registry types (PB-NOTI-EMAIL-ADMIN-001 / BBR-662).
 *
 * Wire shapes for the admin template management endpoints under
 * `/api/admin/email/templates`. Timestamps are ISO strings on the wire
 * (Fastify serializes Drizzle `Date` columns), matching the server DTOs in
 * `packages/features/email/dto/template-registry.dto.ts`.
 */
import type { EmailStatus } from "./types";

/** Subset of `@repo/ui` badge variants used by this feature. */
type BadgeVariant = "default" | "secondary" | "destructive" | "success" | "warning" | "outline";

export type TemplateCategory = "auth" | "password" | "transactional" | "marketing";
export type TemplateVersionStatus = "draft" | "published" | "archived";
export type TemplateVariableType = "string" | "number" | "boolean" | "url";
export type TemplateRenderer =
  | "welcome"
  | "email-verification"
  | "password-reset"
  | "password-changed"
  | "notification";

/** Single variable definition inside a version's `variableSchema`. */
export interface TemplateVariableDef {
  type: TemplateVariableType;
  required: boolean;
  description?: string;
}

export type TemplateVariableSchema = Record<string, TemplateVariableDef>;

/** Last-send status summary derived from `email_logs`. */
export interface TemplateSendSummary {
  totalCount: number;
  statusCounts: Partial<Record<EmailStatus, number>>;
  lastStatus: EmailStatus | null;
  lastSentAt: string | null;
}

export interface EmailTemplateSummary {
  key: string;
  name: string;
  description: string | null;
  category: TemplateCategory;
  isActive: boolean;
  renderer: TemplateRenderer | null;
  currentVersion: number | null;
  currentStatus: TemplateVersionStatus | null;
  updatedAt: string;
  lastSend: TemplateSendSummary;
}

export interface EmailTemplateVersion {
  id: string;
  version: number;
  status: TemplateVersionStatus;
  subject: string;
  variableSchema: TemplateVariableSchema;
  changelog: string | null;
  publishedAt: string | null;
  isCurrent: boolean;
}

export interface EmailTemplateDetail extends EmailTemplateSummary {
  versions: EmailTemplateVersion[];
}

export interface TemplateValidationIssue {
  variable: string;
  code: "missing_required" | "type_mismatch";
  message: string;
  expectedType: TemplateVariableType;
}

export interface TemplateValidationResult {
  valid: boolean;
  issues: TemplateValidationIssue[];
  unknownVariables: string[];
}

export interface EmailTemplatePreview {
  key: string;
  templateVersionId: string;
  version: number;
  status: TemplateVersionStatus;
  renderer: TemplateRenderer | null;
  subject: string;
  html: string;
  validation: TemplateValidationResult;
  subjectMissing: string[];
}

/** Request payloads (mirrors Create/Update/Publish/TestSend DTOs). */
export interface CreateTemplateInput {
  key: string;
  name: string;
  description?: string;
  category?: TemplateCategory;
  subject: string;
  bodySource?: string;
  changelog?: string;
  variableSchema?: TemplateVariableSchema;
}

export interface UpdateTemplateInput {
  name?: string;
  description?: string | null;
  category?: TemplateCategory;
  isActive?: boolean;
  subject?: string;
  bodySource?: string | null;
  changelog?: string | null;
  variableSchema?: TemplateVariableSchema;
}

export interface TestSendInput {
  recipientEmail: string;
  recipientName?: string;
  variables?: Record<string, unknown>;
  idempotencyKey?: string;
}

/** Display labels + badge variants (operator-facing Korean copy). */
export const TEMPLATE_CATEGORY_LABELS: Record<TemplateCategory, string> = {
  auth: "인증",
  password: "비밀번호",
  transactional: "트랜잭션",
  marketing: "마케팅",
};

export const TEMPLATE_STATUS_LABELS: Record<TemplateVersionStatus, string> = {
  draft: "초안",
  published: "발행됨",
  archived: "보관됨",
};

export const TEMPLATE_STATUS_BADGE_VARIANT: Record<TemplateVersionStatus, BadgeVariant> = {
  draft: "secondary",
  published: "success",
  archived: "outline",
};

export const TEMPLATE_VARIABLE_TYPE_LABELS: Record<TemplateVariableType, string> = {
  string: "문자열",
  number: "숫자",
  boolean: "참/거짓",
  url: "URL",
};
