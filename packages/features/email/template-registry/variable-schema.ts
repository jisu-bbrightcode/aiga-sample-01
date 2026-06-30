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

/**
 * Synthesize a sample variable map that satisfies every declared variable in a
 * schema (type-correct, non-empty). Used by the publish gate
 * (PB-NOTI-EMAIL-API-UPDATE-001 / BBR-659) to verify that a draft renders BEFORE
 * publishing when the caller does not supply an explicit preview payload — so
 * publish still validates subject/body interpolation against real-shaped values.
 */
export function buildSampleVariables(schema: TemplateVariableSchema): Record<string, unknown> {
  const sample: Record<string, unknown> = {};
  for (const [name, spec] of Object.entries(schema)) {
    switch (spec.type) {
      case "number":
        sample[name] = 1;
        break;
      case "boolean":
        sample[name] = true;
        break;
      case "url":
        sample[name] = "https://example.com";
        break;
      default:
        sample[name] = `샘플 ${name}`;
        break;
    }
  }
  return sample;
}

/** Outcome of strictly parsing an admin-supplied `variableSchema` for a new template. */
export interface VariableSchemaParseResult {
  valid: boolean;
  /** The cleaned schema (empty object when input is absent or invalid). */
  schema: TemplateVariableSchema;
  /** Human-readable reasons the input was rejected (empty when valid). */
  errors: string[];
}

/**
 * Validate a single variable definition. Returns the cleaned spec, or an error
 * string describing why it was rejected. Extracted so the per-entry branching
 * does not inflate {@link parseVariableSchemaInput}'s cognitive complexity.
 */
function parseVariableSpec(
  name: string,
  value: unknown,
): { spec: TemplateVariableSpec } | { error: string } {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return { error: `변수 "${name}" 정의는 객체여야 합니다.` };
  }

  const spec = value as Record<string, unknown>;

  if (!VALID_TYPES.includes(spec.type as TemplateVariableType)) {
    return {
      error: `변수 "${name}"의 type이 올바르지 않습니다. (허용: ${VALID_TYPES.join(", ")})`,
    };
  }
  if (spec.required !== undefined && typeof spec.required !== "boolean") {
    return { error: `변수 "${name}"의 required는 boolean이어야 합니다.` };
  }
  if (spec.description !== undefined && typeof spec.description !== "string") {
    return { error: `변수 "${name}"의 description은 문자열이어야 합니다.` };
  }

  return {
    spec: {
      type: spec.type as TemplateVariableType,
      required: spec.required === true,
      description: typeof spec.description === "string" ? spec.description : undefined,
    },
  };
}

/**
 * Strictly validate a `variableSchema` supplied when CREATING a template
 * (PB-NOTI-EMAIL-API-CREATE-001 / BBR-658).
 *
 * Unlike {@link normalizeVariableSchema} — which silently coerces untrusted DB
 * jsonb so reads never throw — this REJECTS malformed input so the create
 * endpoint can answer 422 ("잘못된 변수 스키마를 422로 거부한다"). Absent input
 * (`undefined`/`null`) is valid and yields an empty schema.
 */
export function parseVariableSchemaInput(raw: unknown): VariableSchemaParseResult {
  if (raw === undefined || raw === null) {
    return { valid: true, schema: {}, errors: [] };
  }

  if (typeof raw !== "object" || Array.isArray(raw)) {
    return { valid: false, schema: {}, errors: ["변수 스키마는 객체여야 합니다."] };
  }

  const schema: TemplateVariableSchema = {};
  const errors: string[] = [];

  for (const [name, value] of Object.entries(raw as Record<string, unknown>)) {
    const result = parseVariableSpec(name, value);
    if ("error" in result) {
      errors.push(result.error);
    } else {
      schema[name] = result.spec;
    }
  }

  return { valid: errors.length === 0, schema, errors };
}
