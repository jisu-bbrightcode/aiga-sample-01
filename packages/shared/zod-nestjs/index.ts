import { zodToJsonSchema } from "zod-to-json-schema";

type AnyZodSchema = {
  parse: (input: unknown) => unknown;
  _zod?: unknown; // present in zod v4, absent in v3
};

type JsonSchemaObject = {
  properties?: Record<string, Record<string, unknown>>;
  required?: string[];
  [key: string]: unknown;
};

function toJsonSchema(schema: AnyZodSchema): JsonSchemaObject {
  // zod v4 schemas carry a `_zod` marker. Convert them via the `zod/v4/core`
  // subpath that is bundled inside zod 3.25+ — this subpath exports
  // `toJSONSchema` and can process foreign v4 schema instances structurally,
  // without requiring a shared zod v4 singleton.
  if ("_zod" in schema && schema._zod !== undefined) {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const zodV4Core = require("zod/v4/core") as {
      toJSONSchema?: (s: unknown) => JsonSchemaObject;
    };
    if (typeof zodV4Core.toJSONSchema === "function") {
      return zodV4Core.toJSONSchema(schema);
    }
    // Guard: if subpath somehow missing, fail loudly rather than silently
    // returning empty metadata.
    throw new Error(
      "createZodDto: zod v4 schema detected but zod/v4/core.toJSONSchema is unavailable. " +
        "Ensure zod >=3.25 is installed in packages/shared.",
    );
  }
  // zod v3: use zod-to-json-schema.
  //
  // `$refStrategy: "none"` forces every sub-schema to be inlined. Without it,
  // a schema *instance* reused across two properties (e.g. one `credentialYear`
  // const bound to both `startYear` and `endYear`) is deduplicated into an
  // internal JSON-pointer `$ref` (`#/properties/startYear`) on the second use.
  // `_OPENAPI_METADATA_FACTORY` only surfaces the top-level `properties`, so
  // @nestjs/swagger sees that dangling `$ref` and aborts the OpenAPI dump with
  // "A circular dependency has been detected". Inlining keeps each property's
  // metadata self-contained, which is exactly what the per-property factory
  // requires. (Truly recursive DTOs are not used in this codebase.)
  return zodToJsonSchema(schema as never, { $refStrategy: "none" }) as JsonSchemaObject;
}

/**
 * Swagger/OpenAPI 3.0 doesn't understand JSON-Schema `type: ["string","null"]`.
 * Convert to `{type: "string", nullable: true}` so @nestjs/swagger renders it
 * correctly. Also handles `anyOf: [..., {type:"null"}]` from zod-to-json-schema.
 */
function normalizeNullable(prop: Record<string, unknown>): Record<string, unknown> {
  // Case 1: type is an array e.g. ["string","null"]
  if (Array.isArray(prop.type)) {
    const types = prop.type as string[];
    const nonNull = types.filter((t) => t !== "null");
    if (nonNull.length === 1) {
      const { type: _ignored, ...rest } = prop;
      return { ...rest, type: nonNull[0], nullable: true };
    }
    // Multiple non-null types: leave as-is (edge case)
    return prop;
  }
  // Case 2: anyOf with a null variant
  if (Array.isArray(prop.anyOf)) {
    const anyOf = prop.anyOf as Record<string, unknown>[];
    const nullIdx = anyOf.findIndex((s) => s.type === "null");
    if (nullIdx !== -1) {
      const nonNullSchemas = anyOf.filter((_, i) => i !== nullIdx);
      if (nonNullSchemas.length === 1) {
        const { anyOf: _ignored, ...rest } = prop;
        return { ...rest, ...nonNullSchemas[0], nullable: true };
      }
    }
  }
  return prop;
}

/**
 * Creates a NestJS-compatible DTO class from a Zod schema.
 * The class can be used with NestJS validation pipes and Swagger.
 * `_OPENAPI_METADATA_FACTORY` is called by @nestjs/swagger to collect per-property schemas.
 */
export function createZodDto<T extends AnyZodSchema>(schema: T) {
  type Output = ReturnType<T["parse"]>;

  // biome-ignore lint/complexity/noStaticOnlyClass: factory shape for NestJS pipes + Swagger
  class ZodDto {
    static readonly schema = schema;

    static create(input: unknown): Output {
      return schema.parse(input) as Output;
    }

    static _OPENAPI_METADATA_FACTORY(): Record<string, unknown> {
      const json = toJsonSchema(schema);
      const props = (json.properties ?? {}) as Record<string, Record<string, unknown>>;
      const required = new Set<string>((json.required as string[] | undefined) ?? []);
      const meta: Record<string, unknown> = {};
      for (const [key, prop] of Object.entries(props)) {
        meta[key] = { ...normalizeNullable(prop), required: required.has(key) };
      }
      return meta;
    }
  }

  return ZodDto as unknown as {
    new (): Output;
    schema: T;
    create(input: unknown): Output;
    _OPENAPI_METADATA_FACTORY(): Record<string, unknown>;
  };
}

/**
 * Patches NestJS Swagger module to support Zod DTOs.
 * @deprecated Metadata is now emitted per-DTO via `_OPENAPI_METADATA_FACTORY`.
 * Kept for import compatibility.
 */
export function patchNestJsSwagger(): void {
  // No-op — metadata is now emitted directly from each DTO class.
}

export { ZodValidationPipe } from "./validation-pipe";
