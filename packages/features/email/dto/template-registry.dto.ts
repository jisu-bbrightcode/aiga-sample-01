/**
 * Email template-registry DTOs (PB-NOTI-EMAIL-TEMPLATE-001 / BBR-656).
 *
 * Swagger/response shapes for the admin template management + preview/validate
 * endpoints. Timestamp columns are `Date` in Drizzle but Fastify serializes them
 * to ISO strings on the wire, so they are typed as `z.string()` (same convention
 * as `email-response.dto.ts`).
 */
import { createZodDto } from "@repo/shared/zod-nestjs";
import { z } from "zod";

const variableTypeEnum = z.enum(["string", "number", "boolean", "url"]);
const versionStatusEnum = z.enum(["draft", "published", "archived"]);
const categoryEnum = z.enum(["auth", "password", "transactional", "marketing"]);
const rendererEnum = z.enum([
  "welcome",
  "email-verification",
  "password-reset",
  "password-changed",
  "notification",
]);

/** Request body for preview/validate: a flat map of template variables. */
export const templateVariablesBodySchema = z.record(z.string(), z.unknown());
export class TemplateVariablesBodyDto extends createZodDto(templateVariablesBodySchema) {}

const validationIssueSchema = z.object({
  variable: z.string(),
  code: z.enum(["missing_required", "type_mismatch"]),
  message: z.string(),
  expectedType: variableTypeEnum,
});

const validationResultSchema = z.object({
  valid: z.boolean(),
  issues: z.array(validationIssueSchema),
  unknownVariables: z.array(z.string()),
});

const templateSummarySchema = z.object({
  key: z.string(),
  name: z.string(),
  description: z.string().nullable(),
  category: categoryEnum,
  isActive: z.boolean(),
  renderer: rendererEnum.nullable(),
  currentVersion: z.number().nullable(),
  currentStatus: versionStatusEnum.nullable(),
});
export class EmailTemplateSummaryDto extends createZodDto(templateSummarySchema) {}

const templateVersionSchema = z.object({
  id: z.string(),
  version: z.number(),
  status: versionStatusEnum,
  subject: z.string(),
  variableSchema: z.record(
    z.string(),
    z.object({
      type: variableTypeEnum,
      required: z.boolean(),
      description: z.string().optional(),
    }),
  ),
  changelog: z.string().nullable(),
  publishedAt: z.string().nullable(),
  isCurrent: z.boolean(),
});

const templateDetailSchema = templateSummarySchema.extend({
  versions: z.array(templateVersionSchema),
});
export class EmailTemplateDetailDto extends createZodDto(templateDetailSchema) {}

const templateValidationSchema = z.object({
  key: z.string(),
  version: z.number(),
  validation: validationResultSchema,
});
export class EmailTemplateValidationDto extends createZodDto(templateValidationSchema) {}

const templatePreviewSchema = z.object({
  key: z.string(),
  templateVersionId: z.string(),
  version: z.number(),
  status: versionStatusEnum,
  renderer: rendererEnum.nullable(),
  subject: z.string(),
  html: z.string(),
  validation: validationResultSchema,
  subjectMissing: z.array(z.string()),
});
export class EmailTemplatePreviewDto extends createZodDto(templatePreviewSchema) {}
