/**
 * Pure helpers for the email template admin UI (PB-NOTI-EMAIL-ADMIN-001).
 *
 * Operators edit the variable schema and preview/test-send variables as JSON.
 * These helpers parse that text into the shapes the API expects and turn the
 * server's structured validation report into operator-facing Korean copy. No
 * React / network here so the logic stays trivially reviewable.
 */
import type {
  TemplateValidationResult,
  TemplateVariableSchema,
} from "../templates-types";

export interface JsonObjectParseOk<T> {
  ok: true;
  value: T;
}
export interface JsonObjectParseError {
  ok: false;
  error: string;
}
export type JsonObjectParseResult<T> = JsonObjectParseOk<T> | JsonObjectParseError;

/**
 * Parse operator JSON text into a flat object map.
 *
 * Empty / whitespace-only input is treated as "no value" and resolves to an
 * empty object so an unfilled optional field never blocks an action.
 */
export function parseJsonObject(
  text: string | undefined,
): JsonObjectParseResult<Record<string, unknown>> {
  const trimmed = (text ?? "").trim();
  if (trimmed === "") {
    return { ok: true, value: {} };
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(trimmed);
  } catch {
    return { ok: false, error: "올바른 JSON 형식이 아닙니다." };
  }

  if (parsed === null || typeof parsed !== "object" || Array.isArray(parsed)) {
    return { ok: false, error: "JSON 객체 형식이어야 합니다. 예: { \"name\": \"홍길동\" }" };
  }

  return { ok: true, value: parsed as Record<string, unknown> };
}

const VARIABLE_TYPES = ["string", "number", "boolean", "url"] as const;

/**
 * Parse + structurally validate a variable-schema JSON object.
 *
 * The server validates the schema semantically (422 on malformed), but we
 * reject the obvious shape errors client-side so the operator gets immediate,
 * specific feedback instead of a round-trip.
 */
export function parseVariableSchema(
  text: string | undefined,
): JsonObjectParseResult<TemplateVariableSchema> {
  const parsed = parseJsonObject(text);
  if (!parsed.ok) {
    return parsed;
  }

  const schema: TemplateVariableSchema = {};
  for (const [name, raw] of Object.entries(parsed.value)) {
    if (raw === null || typeof raw !== "object" || Array.isArray(raw)) {
      return { ok: false, error: `"${name}" 변수 정의는 객체여야 합니다.` };
    }
    const def = raw as Record<string, unknown>;
    if (!VARIABLE_TYPES.includes(def.type as (typeof VARIABLE_TYPES)[number])) {
      return {
        ok: false,
        error: `"${name}" 변수의 type은 ${VARIABLE_TYPES.join(", ")} 중 하나여야 합니다.`,
      };
    }
    if (def.required !== undefined && typeof def.required !== "boolean") {
      return { ok: false, error: `"${name}" 변수의 required는 true/false여야 합니다.` };
    }
    if (def.description !== undefined && typeof def.description !== "string") {
      return { ok: false, error: `"${name}" 변수의 description은 문자열이어야 합니다.` };
    }
    schema[name] = {
      type: def.type as TemplateVariableSchema[string]["type"],
      required: def.required === undefined ? false : (def.required as boolean),
      ...(typeof def.description === "string" ? { description: def.description } : {}),
    };
  }
  return { ok: true, value: schema };
}

/** Pretty-print a variable schema for editing (stable key order). */
export function stringifyVariableSchema(schema: TemplateVariableSchema | undefined): string {
  if (!schema || Object.keys(schema).length === 0) {
    return "";
  }
  return JSON.stringify(schema, null, 2);
}

/**
 * Build a type-correct sample variable map from a schema so the operator has a
 * filled-in starting point for preview / test-send.
 */
export function buildSampleVariables(
  schema: TemplateVariableSchema | undefined,
): Record<string, unknown> {
  const sample: Record<string, unknown> = {};
  for (const [name, def] of Object.entries(schema ?? {})) {
    switch (def.type) {
      case "number":
        sample[name] = 0;
        break;
      case "boolean":
        sample[name] = true;
        break;
      case "url":
        sample[name] = "https://example.com";
        break;
      default:
        sample[name] = name;
    }
  }
  return sample;
}

/**
 * Flatten a validation result into operator-facing Korean lines.
 * Returns an empty array when everything is valid and nothing is unknown.
 */
export function summarizeValidation(result: TemplateValidationResult | undefined): string[] {
  if (!result) return [];
  const lines: string[] = [];
  for (const issue of result.issues) {
    lines.push(`${issue.variable}: ${issue.message}`);
  }
  if (result.unknownVariables.length > 0) {
    lines.push(`스키마에 없는 변수: ${result.unknownVariables.join(", ")}`);
  }
  return lines;
}
