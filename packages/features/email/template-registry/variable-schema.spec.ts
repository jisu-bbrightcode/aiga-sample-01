import {
  normalizeVariableSchema,
  type TemplateVariableSchema,
  validateTemplateVariables,
} from "./variable-schema";

describe("normalizeVariableSchema", () => {
  it("coerces well-formed jsonb into a typed schema", () => {
    const schema = normalizeVariableSchema({
      userName: { type: "string", required: true, description: "수신자 이름" },
      resetUrl: { type: "url", required: true },
    });

    expect(schema).toEqual({
      userName: { type: "string", required: true, description: "수신자 이름" },
      resetUrl: { type: "url", required: true, description: undefined },
    });
  });

  it("defaults unknown types to string and treats non-true required as optional", () => {
    const schema = normalizeVariableSchema({
      a: { type: "weird", required: "yes" },
      b: { type: "number", required: false },
    });

    expect(schema.a).toEqual({ type: "string", required: false, description: undefined });
    expect(schema.b).toEqual({ type: "number", required: false, description: undefined });
  });

  it("returns {} for null / array / primitive jsonb and skips malformed entries", () => {
    expect(normalizeVariableSchema(null)).toEqual({});
    expect(normalizeVariableSchema(["x"])).toEqual({});
    expect(normalizeVariableSchema("nope")).toEqual({});
    expect(normalizeVariableSchema({ ok: { type: "string", required: true }, bad: 42 })).toEqual({
      ok: { type: "string", required: true, description: undefined },
    });
  });
});

describe("validateTemplateVariables", () => {
  const schema: TemplateVariableSchema = {
    userName: { type: "string", required: true },
    resetUrl: { type: "url", required: true },
    expiresIn: { type: "string", required: true },
    actionLabel: { type: "string", required: false },
  };

  it("passes when all required variables are present and well-typed", () => {
    const result = validateTemplateVariables(schema, {
      userName: "홍길동",
      resetUrl: "https://aiga.app/reset?token=abc",
      expiresIn: "30분",
    });

    expect(result.valid).toBe(true);
    expect(result.issues).toEqual([]);
  });

  it("flags missing required variables (absent, null, empty string)", () => {
    const result = validateTemplateVariables(schema, {
      userName: "",
      resetUrl: null,
      // expiresIn absent
    });

    expect(result.valid).toBe(false);
    const missing = result.issues
      .filter((i) => i.code === "missing_required")
      .map((i) => i.variable);
    expect(missing.sort()).toEqual(["expiresIn", "resetUrl", "userName"]);
  });

  it("flags type mismatches (bad url, non-string)", () => {
    const result = validateTemplateVariables(schema, {
      userName: 123,
      resetUrl: "not-a-url",
      expiresIn: "30분",
    });

    expect(result.valid).toBe(false);
    const mismatches = result.issues
      .filter((i) => i.code === "type_mismatch")
      .map((i) => i.variable);
    expect(mismatches.sort()).toEqual(["resetUrl", "userName"]);
  });

  it("ignores absent optional variables and surfaces unknown ones", () => {
    const result = validateTemplateVariables(schema, {
      userName: "홍길동",
      resetUrl: "https://aiga.app/reset",
      expiresIn: "30분",
      surpriseVar: "extra",
    });

    expect(result.valid).toBe(true);
    expect(result.unknownVariables).toEqual(["surpriseVar"]);
  });
});
