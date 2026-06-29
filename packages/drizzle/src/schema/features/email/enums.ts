import { pgEnum } from "drizzle-orm/pg-core";

/**
 * Email feature — shared enums.
 *
 * Capability: `notification.email.data-model` (PB-NOTI-EMAIL-DATA-001 / BBR-655).
 * EXTEND of the base email-log capability: status/template-type enums are the
 * verified base; category/version-status enums are the customer delta added to
 * support a versioned template registry (rollback/validation).
 */

/**
 * Email Status Enum (base capability)
 */
export const emailStatusEnum = pgEnum("email_status", [
  "pending", // 대기 중
  "sending", // 발송 중
  "sent", // 발송 완료
  "delivered", // 배달 완료
  "failed", // 발송 실패
  "bounced", // 반송됨
  "opened", // 열람됨
]);

/**
 * Email Template Type Enum (base capability)
 *
 * Maps 1:1 to the React Email components in `packages/features/email/templates`.
 * Stable template *keys* (e.g. `auth.welcome`) live in `email_templates.key`;
 * this enum stays the renderer selector for backwards compatibility.
 */
export const emailTemplateEnum = pgEnum("email_template_type", [
  "welcome", // 환영 이메일
  "email-verification", // 이메일 인증
  "password-reset", // 비밀번호 재설정
  "password-changed", // 비밀번호 변경 완료
  "notification", // 일반 알림
]);

/**
 * Email Template Category Enum (customer delta)
 *
 * Groups template keys for admin curation. `password` is split from `auth`
 * because the acceptance criteria call out 인증 / 비밀번호 재설정 / 트랜잭션
 * as distinct seed key groups.
 */
export const emailTemplateCategoryEnum = pgEnum("email_template_category", [
  "auth", // 인증 (가입 환영, 이메일 인증)
  "password", // 비밀번호 재설정/변경
  "transactional", // 트랜잭션 알림
  "marketing", // 마케팅 (향후 확장)
]);

/**
 * Email Template Version Status Enum (customer delta)
 *
 * Lifecycle of a single template version. Only `published` versions are
 * eligible to be referenced by `email_templates.current_version_id`; `archived`
 * versions are the rollback targets the acceptance criteria require.
 */
export const emailTemplateVersionStatusEnum = pgEnum("email_template_version_status", [
  "draft", // 작성 중
  "published", // 게시됨 (발송에 사용 가능)
  "archived", // 보관됨 (롤백 대상)
]);

// Type Exports
export type EmailStatus = (typeof emailStatusEnum.enumValues)[number];
export type EmailTemplateType = (typeof emailTemplateEnum.enumValues)[number];
export type EmailTemplateCategory = (typeof emailTemplateCategoryEnum.enumValues)[number];
export type EmailTemplateVersionStatus =
  (typeof emailTemplateVersionStatusEnum.enumValues)[number];
