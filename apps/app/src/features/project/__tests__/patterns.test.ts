/**
 * Pattern resolver — deterministic per-id mapping. Cards must keep the same
 * placeholder cover across reloads when no user selection exists.
 */

import { describe, expect, it } from "vitest";
import { defaultPatternFor, PROJECT_PATTERNS } from "../patterns";

describe("defaultPatternFor", () => {
  it("returns a known pattern path", () => {
    const out = defaultPatternFor("any-project-id");
    expect(PROJECT_PATTERNS).toContain(out);
  });

  it("is deterministic for the same id", () => {
    const id = "b10cc310-155d-448e-95a3-052c1c49e424";
    expect(defaultPatternFor(id)).toBe(defaultPatternFor(id));
  });

  it("distributes across the pattern set for varied ids", () => {
    const ids = Array.from({ length: 200 }, (_, i) => `proj-${i.toString(16)}`);
    const seen = new Set(ids.map(defaultPatternFor));
    // With 16 patterns and 200 randomish ids, we should hit a fair spread.
    expect(seen.size).toBeGreaterThanOrEqual(8);
  });

  it("falls back to the first pattern for an empty id", () => {
    expect(defaultPatternFor("")).toBe(PROJECT_PATTERNS[0]);
  });
});
