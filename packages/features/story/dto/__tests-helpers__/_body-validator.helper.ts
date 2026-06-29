import { expect } from "@jest/globals";
import type { z } from "zod";

export const VALID_STORY_DOC = JSON.stringify({
  type: "doc",
  content: [{ type: "paragraph", content: [{ type: "text", text: "본문" }] }],
});

export const MALFORMED_DOC = JSON.stringify({ type: "doc", content: "not-an-array" });

/**
 * Asserts that a schema's `body` field accepts only valid document JSON strings
 * or null, rejecting plain text and malformed document JSON.
 *
 * For UPDATE schemas (all fields optional), call without `requiredFields`.
 * For CREATE schemas (projectId / name required), pass a stub object:
 *
 *   expectStoryDocBodyValidator(createWorldSchema, {
 *     projectId: "00000000-0000-0000-0000-000000000001",
 *     name: "test world",
 *   });
 *
 * The second argument is merged into each parse call so required fields are
 * satisfied. Backward-compatible — existing callers keep working with `{}`.
 */
export function expectStoryDocBodyValidator<T extends z.ZodTypeAny>(
  schema: T,
  requiredFields: Record<string, unknown> = {},
): void {
  // The 4 standard contract cases for the body field:
  expect(() => schema.parse({ ...requiredFields, body: VALID_STORY_DOC })).not.toThrow();
  expect(() => schema.parse({ ...requiredFields, body: null })).not.toThrow();
  expect(() => schema.parse({ ...requiredFields, body: "plain text" })).toThrow();
  expect(() => schema.parse({ ...requiredFields, body: MALFORMED_DOC })).toThrow();
}
