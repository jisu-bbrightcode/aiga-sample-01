import { describe, expect, it } from "@jest/globals";
import { updateWorldSchema } from "./update-world.dto";

const validBody = JSON.stringify({
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

describe("updateWorldSchema — body field", () => {
  it("valid StoryDoc body 통과", () => {
    expect(() => updateWorldSchema.parse({ body: validBody })).not.toThrow();
  });

  it("legacy plain text body 거부", () => {
    expect(() => updateWorldSchema.parse({ body: "Just text" })).toThrow();
  });

  it("legacy v1 DocNode body 거부", () => {
    expect(() =>
      updateWorldSchema.parse({
        body: JSON.stringify({ type: "doc", content: [] }),
      }),
    ).toThrow();
  });

  it("body=null 통과 (post-wipe state)", () => {
    expect(() => updateWorldSchema.parse({ body: null })).not.toThrow();
  });

  it("description plain text + valid body 통과", () => {
    expect(() =>
      updateWorldSchema.parse({
        description: "Short preview text",
        body: validBody,
      }),
    ).not.toThrow();
  });
});
