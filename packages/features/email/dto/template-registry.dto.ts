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
const emailStatusEnum = z.enum([
  "pending",
  "sending",
  "sent",
  "delivered",
  "failed",
  "bounced",
  "opened",
]);

/** Last-send status summary derived from email_logs (AC: 마지막 발송 상태 요약). */
const sendSummarySchema = z.object({
  totalCount: z.number(),
  statusCounts: z.record(emailStatusEnum, z.number()),
  lastStatus: emailStatusEnum.nullable(),
  lastSentAt: z.string().nullable(),
});

/** Request body for preview/validate: a flat map of template variables. */
export const templateVariablesBodySchema = z.record(z.string(), z.unknown());
export class TemplateVariablesBodyDto extends createZodDto(templateVariablesBodySchema) {}

/**
 * Request body for creating a template (PB-NOTI-EMAIL-API-CREATE-001 / BBR-658).
 *
 * `variableSchema` is intentionally loose here (a flat object map). Its shape is
 * validated semantically in the service so a malformed schema is rejected with
 * 422 ("잘못된 변수 스키마를 422로 거부"), not the 400 a strict Zod schema would
 * produce. Truly malformed requests (missing key/subject, bad enum) still 400.
 */
const templateKeyPattern = /^[a-z0-9]+(?:[._-][a-z0-9]+)*$/;
export const createEmailTemplateSchema = z.object({
  key: z
    .string()
    .trim()
    .min(1)
    .max(120)
    .regex(templateKeyPattern, "키는 소문자/숫자와 . _ - 구분자만 사용할 수 있습니다.")
    .describe("안정적인 템플릿 식별자 (예: transactional.order-confirmed)"),
  name: z.string().trim().min(1).max(200).describe("템플릿 이름"),
  description: z.string().max(2000).optional().describe("템플릿 설명"),
  category: categoryEnum.optional().describe("카테고리 (기본값: transactional)"),
  subject: z.string().trim().min(1).max(200).describe("이메일 제목 (변수 보간 지원)"),
  bodySource: z.string().optional().describe("DB 저장형 본문 소스 (React 렌더러가 없을 때)"),
  changelog: z.string().max(2000).optional().describe("초기 버전 변경 이력"),
  variableSchema: z
    .record(z.string(), z.unknown())
    .optional()
    .describe("템플릿이 기대하는 변수 스키마 { name: { type, required, description } }"),
});
export class CreateEmailTemplateDto extends createZodDto(createEmailTemplateSchema) {}

/**
 * Request body for updating a template (PB-NOTI-EMAIL-API-UPDATE-001 / BBR-659).
 *
 * Every field is optional — only the keys present are changed. Metadata fields
 * patch the template row; content fields (subject/body/variableSchema/changelog)
 * are applied to the working draft so a published version is never mutated. Like
 * create, `variableSchema` is loose here and validated semantically in the
 * service (422 on malformed). At least one field must be supplied.
 */
export const updateEmailTemplateSchema = z
  .object({
    name: z.string().trim().min(1).max(200).optional().describe("템플릿 이름"),
    description: z.string().max(2000).nullable().optional().describe("템플릿 설명 (null로 비움)"),
    category: categoryEnum.optional().describe("카테고리"),
    isActive: z.boolean().optional().describe("활성 여부"),
    subject: z.string().trim().min(1).max(200).optional().describe("이메일 제목 (변수 보간 지원)"),
    bodySource: z.string().nullable().optional().describe("DB 저장형 본문 소스 (null로 비움)"),
    changelog: z.string().max(2000).nullable().optional().describe("버전 변경 이력"),
    variableSchema: z
      .record(z.string(), z.unknown())
      .optional()
      .describe("템플릿이 기대하는 변수 스키마 { name: { type, required, description } }"),
  })
  .refine((value) => Object.keys(value).length > 0, {
    message: "수정할 필드를 최소 1개 이상 제공해야 합니다.",
  });
export class UpdateEmailTemplateDto extends createZodDto(updateEmailTemplateSchema) {}

/**
 * Request body for publishing a template's working draft
 * (PB-NOTI-EMAIL-API-UPDATE-001 / BBR-659). The body is optional; when
 * `previewVariables` is omitted the service synthesizes a sample from the draft's
 * schema so the pre-publish render is still exercised.
 */
export const publishEmailTemplateSchema = z.object({
  previewVariables: z
    .record(z.string(), z.unknown())
    .optional()
    .describe("발행 전 검증에 사용할 미리보기 변수 (생략 시 스키마에서 샘플 자동 생성)"),
});
export class PublishEmailTemplateDto extends createZodDto(publishEmailTemplateSchema) {}

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
  updatedAt: z.string(),
  lastSend: sendSummarySchema,
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
