/**
 * Email feature — schema barrel.
 *
 * Capability: `notification.email.data-model` (PB-NOTI-EMAIL-DATA-001 / BBR-655).
 *
 * EXTEND of the base email-log capability:
 *   - enums.ts     status / template-type (base) + category / version-status (delta)
 *   - logs.ts      email_logs (base) + template version linkage (delta)
 *   - templates.ts email_templates + email_template_versions (delta — versioned
 *                  registry for rollback/validation)
 *
 * Public exports are unchanged for existing consumers (emailLogs, EmailLog,
 * EmailStatus, EmailTemplateType, emailStatusEnum, emailTemplateEnum); the new
 * template tables/enums are additive.
 */
export * from "./enums";
export * from "./logs";
export * from "./templates";
