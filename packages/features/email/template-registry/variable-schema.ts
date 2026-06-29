/**
 * Email template variable schema — pure validation.
 *
 * Capability: `notification.email.template-manager`
 * (PB-NOTI-EMAIL-TEMPLATE-001 / BBR-656).
 *
 * A template version stores a `variableSchema` jsonb describing the variables it
 * expects. Before a template is rendered/sent we validate the supplied variables
 * against that schema so missing or mistyped variables are caught BEFORE the
 * provider send (AC: "변수 누락 또는 타입 불일치를 발송 전에 검증한다").
 *
 * Pure — no DB / NestJS dependencies, so it is unit-tested in isolation and
 * reused by both the preview/validate endpoints and the send path.
 */

export type TemplateVariableType = "string" | "number" | "boolean" | "url";

export interface TemplateVariableSpec {
  type: TemplateVariableType;
  required: boolean;
  description?: string;
}

export type TemplateVariableSchema = Record<string, TemplateVariableSpec>;

export type TemplateValidationCode = "missing_required" | "type_mismatch";

export interface TemplateValidationIssue {
  variable: string;
  code: TemplateValidationCode;
  message: string;
  expectedType: TemplateVariableType;
}

export interface TemplateValidationResult {
  valid: boolean;
  issues: TemplateValidationIssue[];
  /** Variables supplied that are not declared in the schema (non-fatal). */
  unknownVariables: string[];
}

const VALID_TYPES: readonly TemplateVariableType[] = ["string", "number", "boolean", "url"];

/**
 * Coerce the raw jsonb (`unknown`) stored in `variableSchema` into a typed
 * schema. The DB column is untyped jsonb, so never trust its shape: invalid
 * entries are dropped and an unrecognized `type` defaults to `string`.
 */
export function normalizeVariableSchema(raw: unknown): TemplateVariableSchema {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    return {};
  }

  const schema: TemplateVariableSchema = {};
  for (const [name, value] of Object.entries(raw as Record<string, unknown>)) {
    if (!value || typeof value !== "object" || Array.isArray(value)) {
      continue;
    }
    const spec = value as Record<string, unknown>;
    const type = VALID_TYPES.includes(spec.type as TemplateVariableType)
      ? (spec.type as TemplateVariableType)
      : "string";
    schema[name] = {
      type,
      required: spec.required === true,
      description: typeof spec.description === "string" ? spec.description : undefined,
    };
  }
  return schema;
}

function matchesType(value: unknown, type: TemplateVariableType): boolean {
  switch (type) {
    case "string":
      return typeof value === "string";
    case "number":
      return typeof value === "number" && Number.isFinite(value);
    case "boolean":
      return typeof value === "boolean";
    case "url": {
      if (typeof value !== "string") {
        return false;
      }
      try {
        const url = new URL(value);
        return url.protocol === "http:" || url.protocol === "https:";
      } catch {
        return false;
      }
    }
  }
}

function isEmpty(value: unknown): boolean {
  return value === undefined || value === null || value === "";
}

/**
 * Validate supplied variables against a template's declared schema.
 *
 * - Missing required variable (absent / null / empty string) → `missing_required`.
 * - Present but wrong runtime type → `type_mismatch`.
 * - Absent optional variable → fine.
 * - Supplied but undeclared variable → surfaced in `unknownVariables` (non-fatal).
 */
export function validateTemplateVariables(
  schema: TemplateVariableSchema,
  variables: Record<string, unknown>,
): TemplateValidationResult {
  const issues: TemplateValidationIssue[] = [];

  for (const [name, spec] of Object.entries(schema)) {
    const value = variables[name];

    if (isEmpty(value)) {
      if (spec.required) {
        issues.push({
          variable: name,
          code: "missing_required",
          message: `필수 변수 "${name}"이(가) 누락되었습니다.`,
          expectedType: spec.type,
        });
      }
      continue;
    }

    if (!matchesType(value, spec.type)) {
      issues.push({
        variable: name,
        code: "type_mismatch",
        message: `변수 "${name}"의 타입이 올바르지 않습니다. (기대: ${spec.type})`,
        expectedType: spec.type,
      });
    }
  }

  const declared = new Set(Object.keys(schema));
  const unknownVariables = Object.keys(variables).filter((key) => !declared.has(key));

  return { valid: issues.length === 0, issues, unknownVariables };
}

/** Build a one-line human summary of validation issues (for error messages). */
export function summarizeValidationIssues(issues: TemplateValidationIssue[]): string {
  return issues.map((issue) => issue.message).join(" ");
}
