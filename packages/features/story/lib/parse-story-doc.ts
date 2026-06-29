export type StoryDocument = Record<string, unknown> & {
  type: string;
  content?: unknown[];
};

/**
 * Server-side Product Builder document validator.
 *
 * New writes use TipTap JSON (`{ type: "doc", content: [...] }`). Legacy
 * Legacy editor JSON is accepted during transition so old rows can still round
 * trip, but Product Builder no longer imports the legacy editor runtime
 * for body validation.
 */
export function parseStoryDocOrNull(raw: unknown): StoryDocument | null {
  if (raw === null || raw === undefined) return null;
  if (typeof raw !== "string" || raw.trim() === "") return null;
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return null;
  }
  if (isTipTapDocument(parsed)) return parsed;
  if (isLegacyStoryDoc(parsed)) return { type: "doc", content: [] };
  return null;
}

export function requireStoryDoc(raw: unknown): StoryDocument {
  const doc = parseStoryDocOrNull(raw);
  if (doc === null) throw new Error("Document JSON 형식이 아닙니다");
  return doc;
}

function isTipTapDocument(value: unknown): value is StoryDocument {
  if (!isRecord(value)) return false;
  return value.type === "doc" && (value.content === undefined || Array.isArray(value.content));
}

function isLegacyStoryDoc(value: unknown): boolean {
  return isRecord(value) && isRecord(value.lexical) && isRecord(value.lexical.root);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}
