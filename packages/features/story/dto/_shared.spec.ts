import { afterEach, beforeEach, describe, expect, it, jest } from "@jest/globals";

describe("storyDocString — STORY_DOC_VALIDATOR_ENABLED feature flag", () => {
  let original: string | undefined;

  beforeEach(() => {
    original = process.env.STORY_DOC_VALIDATOR_ENABLED;
  });

  afterEach(() => {
    if (original === undefined) {
      delete process.env.STORY_DOC_VALIDATOR_ENABLED;
    } else {
      process.env.STORY_DOC_VALIDATOR_ENABLED = original;
    }
    jest.resetModules();
  });

  it('flag="false" → legacy raw 통과 (fail-open)', async () => {
    process.env.STORY_DOC_VALIDATOR_ENABLED = "false";
    jest.resetModules();
    const mod = await import("./_shared.js");
    expect(() => mod.storyDocString.parse("Just legacy plain text")).not.toThrow();
    expect(() => mod.storyDocString.parse(JSON.stringify({ type: "doc", content: [] }))).not.toThrow();
  });

  it("flag undefined (default true) → legacy raw 거부", async () => {
    delete process.env.STORY_DOC_VALIDATOR_ENABLED;
    jest.resetModules();
    const mod = await import("./_shared.js");
    expect(() => mod.storyDocString.parse("Just legacy plain text")).toThrow();
  });

  it('flag="true" → legacy raw 거부 (explicit on)', async () => {
    process.env.STORY_DOC_VALIDATOR_ENABLED = "true";
    jest.resetModules();
    const mod = await import("./_shared.js");
    expect(() => mod.storyDocString.parse("Just legacy plain text")).toThrow();
  });

  it('flag="" 빈 문자열 → 거부 (only literal "false" disables)', async () => {
    process.env.STORY_DOC_VALIDATOR_ENABLED = "";
    jest.resetModules();
    const mod = await import("./_shared.js");
    expect(() => mod.storyDocString.parse("Just legacy plain text")).toThrow();
  });

  it("transition false → true → false 동작 (각 단계 reset)", async () => {
    process.env.STORY_DOC_VALIDATOR_ENABLED = "false";
    jest.resetModules();
    const off1 = (await import("./_shared.js")).storyDocString;
    expect(() => off1.parse("legacy")).not.toThrow();

    process.env.STORY_DOC_VALIDATOR_ENABLED = "true";
    jest.resetModules();
    const on = (await import("./_shared.js")).storyDocString;
    expect(() => on.parse("legacy")).toThrow();

    process.env.STORY_DOC_VALIDATOR_ENABLED = "false";
    jest.resetModules();
    const off2 = (await import("./_shared.js")).storyDocString;
    expect(() => off2.parse("legacy")).not.toThrow();
  });

  it("flag=false 일 때 valid document JSON 도 통과 (fail-open 의도)", async () => {
    process.env.STORY_DOC_VALIDATOR_ENABLED = "false";
    jest.resetModules();
    const { storyDocString } = await import("./_shared.js");
    const valid = JSON.stringify({
      type: "doc",
      content: [{ type: "paragraph", content: [{ type: "text", text: "본문" }] }],
    });
    expect(() => storyDocString.parse(valid)).not.toThrow();
  });

  it("null 은 항상 통과 (flag 무관, post-wipe 상태)", async () => {
    delete process.env.STORY_DOC_VALIDATOR_ENABLED;
    jest.resetModules();
    const { storyDocString } = await import("./_shared.js");
    expect(() => storyDocString.parse(null)).not.toThrow();
  });
});
