import { describe, expect, it } from "@jest/globals";
import { parseStoryDocOrNull, requireStoryDoc } from "./parse-story-doc";

const valid = JSON.stringify({
  type: "doc",
  content: [{ type: "paragraph", content: [{ type: "text", text: "본문" }] }],
});

describe("parseStoryDocOrNull", () => {
  it("valid document JSON 파싱", () => {
    const doc = parseStoryDocOrNull(valid);
    expect(doc).not.toBeNull();
    expect(doc?.type).toBe("doc");
  });
  it("legacy editor JSON transition 호환", () => {
    const legacy = JSON.stringify({
      version: 2,
      lexical: {
        root: {
          type: "root",
          version: 1,
          indent: 0,
          direction: "ltr",
          format: "",
          children: [],
        },
      },
      meta: { lastEditedAt: "2026-04-30T00:00:00.000Z", schemaPlugins: [] },
    });
    expect(parseStoryDocOrNull(legacy)?.type).toBe("doc");
  });
  it("plain text null", () => {
    expect(parseStoryDocOrNull("hello")).toBeNull();
  });
  it("malformed document — content 미배열 시 null", () => {
    const raw = JSON.stringify({
      type: "doc",
      content: "not-an-array",
    });
    expect(parseStoryDocOrNull(raw)).toBeNull();
  });
  it("null/undefined null", () => {
    expect(parseStoryDocOrNull(null)).toBeNull();
    expect(parseStoryDocOrNull(undefined)).toBeNull();
  });
});

describe("requireStoryDoc", () => {
  it("valid 통과", () => {
    expect(() => requireStoryDoc(valid)).not.toThrow();
  });
  it("invalid throw", () => {
    expect(() => requireStoryDoc("legacy")).toThrow(/Document JSON/);
  });
});
