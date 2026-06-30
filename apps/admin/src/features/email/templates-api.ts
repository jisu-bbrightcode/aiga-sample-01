/**
 * Email template-registry admin API — schema-validated fetch layer.
 *
 * The generated OpenAPI client (`@repo/api-client`) only exposes the email
 * *logs* endpoints; the template CRUD/preview/test-send routes landed with the
 * backend tasks (PB-NOTI-EMAIL-API-*). This thin layer reuses the same base URL
 * + auth headers as the typed `apiClient` and validates responses with zod, so
 * the UI is type-safe today without regenerating the client. Errors surface as
 * operator-facing Korean messages (validation detail preserved where the server
 * returns it).
 */
import { z } from "zod";
import { API_URL, getAuthHeaders } from "../../lib/api";
import type {
  CreateTemplateInput,
  EmailTemplateDetail,
  EmailTemplatePreview,
  EmailTemplateSummary,
  TemplateValidationResult,
  TestSendInput,
  UpdateTemplateInput,
} from "./templates-types";

export const TEMPLATES_ENDPOINT = "/api/admin/email/templates";

// ---------------------------------------------------------------------------
// Response schemas (mirror packages/features/email/dto/template-registry.dto.ts)
// ---------------------------------------------------------------------------

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

const sendSummarySchema = z.object({
  totalCount: z.number(),
  statusCounts: z.record(emailStatusEnum, z.number()),
  lastStatus: emailStatusEnum.nullable(),
  lastSentAt: z.string().nullable(),
});

const summarySchema = z.object({
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

const versionSchema = z.object({
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

const detailSchema = summarySchema.extend({ versions: z.array(versionSchema) });

const validationResultSchema = z.object({
  valid: z.boolean(),
  issues: z.array(
    z.object({
      variable: z.string(),
      code: z.enum(["missing_required", "type_mismatch"]),
      message: z.string(),
      expectedType: variableTypeEnum,
    }),
  ),
  unknownVariables: z.array(z.string()),
});

const validationSchema = z.object({
  key: z.string(),
  version: z.number(),
  validation: validationResultSchema,
});

const previewSchema = z.object({
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

const emailLogSchema = z.object({
  id: z.string(),
  recipientEmail: z.string(),
  recipientName: z.string().nullable(),
  subject: z.string(),
  status: emailStatusEnum,
  providerMessageId: z.string().nullable(),
  failureReason: z.string().nullable(),
  createdAt: z.string(),
});

export type TestSendResult = z.infer<typeof emailLogSchema>;

// ---------------------------------------------------------------------------
// Request helpers
// ---------------------------------------------------------------------------

/**
 * Pull a human message out of an error response body, preferring the server's
 * own validation message (which is already operator-friendly Korean) and
 * falling back to a generic per-status line. Never leaks status codes or stack
 * traces into the returned copy.
 */
async function toErrorMessage(response: Response, fallback: string): Promise<string> {
  try {
    const body = await response.clone().json();
    const message = (body as { message?: unknown })?.message;
    if (typeof message === "string" && message.trim() !== "") {
      return message;
    }
    if (Array.isArray(message) && message.length > 0 && typeof message[0] === "string") {
      return message.join("\n");
    }
  } catch {
    // non-JSON body — fall through to the generic copy
  }
  return fallback;
}

interface RequestOptions<T> {
  path: string;
  init: RequestInit;
  schema: z.ZodType<T>;
  fallback: string;
  signal?: AbortSignal;
}

async function request<T>({ path, init, schema, fallback, signal }: RequestOptions<T>): Promise<T> {
  const response = await fetch(`${API_URL}${path}`, {
    ...init,
    headers: {
      Accept: "application/json",
      ...(init.body ? { "Content-Type": "application/json" } : {}),
      ...getAuthHeaders(),
      ...(init.headers ?? {}),
    },
    credentials: "include",
    signal,
  });

  if (!response.ok) {
    throw new Error(await toErrorMessage(response, fallback));
  }

  return schema.parse(await response.json());
}

// ---------------------------------------------------------------------------
// Endpoints
// ---------------------------------------------------------------------------

export function fetchTemplates(signal?: AbortSignal): Promise<EmailTemplateSummary[]> {
  return request({
    path: TEMPLATES_ENDPOINT,
    init: { method: "GET" },
    schema: z.array(summarySchema),
    fallback: "이메일 템플릿 목록을 불러오지 못했습니다.",
    signal,
  });
}

export function fetchTemplate(key: string, signal?: AbortSignal): Promise<EmailTemplateDetail> {
  return request({
    path: `${TEMPLATES_ENDPOINT}/${encodeURIComponent(key)}`,
    init: { method: "GET" },
    schema: detailSchema,
    fallback: "이메일 템플릿을 불러오지 못했습니다.",
    signal,
  });
}

export function createTemplate(input: CreateTemplateInput): Promise<EmailTemplateDetail> {
  return request({
    path: TEMPLATES_ENDPOINT,
    init: { method: "POST", body: JSON.stringify(input) },
    schema: detailSchema,
    fallback: "템플릿을 생성하지 못했습니다. 입력값을 확인해 주세요.",
  });
}

export function updateTemplate(
  key: string,
  input: UpdateTemplateInput,
): Promise<EmailTemplateDetail> {
  return request({
    path: `${TEMPLATES_ENDPOINT}/${encodeURIComponent(key)}`,
    init: { method: "PATCH", body: JSON.stringify(input) },
    schema: detailSchema,
    fallback: "템플릿을 수정하지 못했습니다. 입력값을 확인해 주세요.",
  });
}

export function publishTemplate(
  key: string,
  previewVariables?: Record<string, unknown>,
): Promise<EmailTemplateDetail> {
  return request({
    path: `${TEMPLATES_ENDPOINT}/${encodeURIComponent(key)}/publish`,
    init: { method: "POST", body: JSON.stringify({ previewVariables }) },
    schema: detailSchema,
    fallback: "템플릿을 발행하지 못했습니다. 미리보기 검증 결과를 확인해 주세요.",
  });
}

export function previewTemplate(
  key: string,
  variables: Record<string, unknown>,
): Promise<EmailTemplatePreview> {
  return request({
    path: `${TEMPLATES_ENDPOINT}/${encodeURIComponent(key)}/preview`,
    init: { method: "POST", body: JSON.stringify(variables) },
    schema: previewSchema,
    fallback: "미리보기를 생성하지 못했습니다.",
  });
}

export function validateTemplateVariables(
  key: string,
  variables: Record<string, unknown>,
): Promise<TemplateValidationResult> {
  return request({
    path: `${TEMPLATES_ENDPOINT}/${encodeURIComponent(key)}/validate`,
    init: { method: "POST", body: JSON.stringify(variables) },
    schema: validationSchema,
    fallback: "변수 검증에 실패했습니다.",
  }).then((result) => result.validation);
}

export function testSendTemplate(key: string, input: TestSendInput): Promise<TestSendResult> {
  return request({
    path: `${TEMPLATES_ENDPOINT}/${encodeURIComponent(key)}/test-send`,
    init: { method: "POST", body: JSON.stringify(input) },
    schema: emailLogSchema,
    fallback: "테스트 발송에 실패했습니다. 잠시 후 다시 시도해 주세요.",
  });
}

// ---------------------------------------------------------------------------
// Query keys
// ---------------------------------------------------------------------------

export const adminEmailTemplateQueryKeys = {
  all: () => ["admin", "email", "templates"] as const,
  list: () => [...adminEmailTemplateQueryKeys.all(), "list"] as const,
  detail: (key: string) => [...adminEmailTemplateQueryKeys.all(), "detail", key] as const,
};
