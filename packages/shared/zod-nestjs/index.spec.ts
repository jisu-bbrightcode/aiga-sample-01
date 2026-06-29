import { describe, expect, it } from "vitest";
import { z } from "zod";
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { z: zv4 } = require("zod-v4") as { z: typeof import("zod-v4") };
import { createZodDto, patchNestJsSwagger } from "./index";

describe("createZodDto OpenAPI metadata", () => {
  it("emits _OPENAPI_METADATA_FACTORY with property schemas (zod v3)", () => {
    const schema = z.object({
      name: z.string().min(1).max(200),
      aiMode: z.enum(["ai_powered", "ai_safety"]).default("ai_safety"),
      description: z.string().max(2000).optional(),
    });
    const Dto = createZodDto(schema) as unknown as {
      _OPENAPI_METADATA_FACTORY?: () => Record<string, unknown>;
    };
    const meta = Dto._OPENAPI_METADATA_FACTORY?.();
    expect(meta).toBeDefined();
    expect(meta!.name).toMatchObject({ type: "string", required: true });
    expect(meta!.description).toMatchObject({ type: "string", required: false });
    expect(meta!.aiMode).toMatchObject({ enum: ["ai_powered", "ai_safety"] });
  });

  it("keeps backward-compatible static create()", () => {
    const schema = z.object({ id: z.string() });
    const Dto = createZodDto(schema);
    expect(Dto.create({ id: "x" })).toEqual({ id: "x" });
    expect(() => Dto.create({})).toThrow();
  });

  it("keeps backward-compatible static schema property", () => {
    const schema = z.object({ id: z.string() });
    const Dto = createZodDto(schema);
    expect(Dto.schema).toBe(schema);
  });

  it("patchNestJsSwagger is a no-op (backward compat)", () => {
    expect(() => patchNestJsSwagger()).not.toThrow();
  });
});

describe("createZodDto OpenAPI metadata — zod v4 schemas", () => {
  it("emits non-empty metadata for a v4 object schema", () => {
    // @ts-ignore — zod-v4 alias may not have perfect typings in this context
    const schema = zv4.object({
      // @ts-ignore
      title: zv4.string(),
      // @ts-ignore
      count: zv4.number(),
      // @ts-ignore
      status: zv4.enum(["draft", "published"]),
      // @ts-ignore
      notes: zv4.string().optional(),
    });
    const Dto = createZodDto(schema) as unknown as {
      _OPENAPI_METADATA_FACTORY?: () => Record<string, unknown>;
    };
    const meta = Dto._OPENAPI_METADATA_FACTORY?.();
    expect(meta).toBeDefined();
    // Must be non-empty — the silent {} regression guard
    expect(Object.keys(meta!).length).toBeGreaterThan(0);
    expect(meta!.title).toMatchObject({ type: "string", required: true });
    expect(meta!.count).toMatchObject({ type: "number", required: true });
    expect(meta!.status).toMatchObject({ required: true });
    expect(meta!.notes).toMatchObject({ required: false });
  });

  it("v4 schema instance carries _zod marker", () => {
    // @ts-ignore
    const schema = zv4.object({ id: zv4.string() });
    expect("_zod" in schema).toBe(true);
  });
});
