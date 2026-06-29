export type DocumentContent = Record<string, unknown> & {
  type: string;
  content?: unknown[];
};

export interface DocumentStats {
  mentionCounts: Map<string, number>;
  bodyCharCount: number;
}

interface DocumentNode {
  type?: unknown;
  text?: unknown;
  entityId?: unknown;
  attrs?: unknown;
  content?: unknown;
  children?: unknown;
}

export function createEmptyDocument(): DocumentContent {
  return {
    type: "doc",
    content: [{ type: "paragraph" }],
  };
}

export function parseStoredDocument(raw: unknown): DocumentContent | null {
  if (raw === null || raw === undefined) return null;
  if (isTipTapDocument(raw)) return raw;
  if (typeof raw !== "string") return null;
  if (raw.trim() === "") return null;

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return textToDocument(raw);
  }

  if (isTipTapDocument(parsed)) return parsed;
  if (isLegacyStoryDoc(parsed)) return legacyStoryDocToDocument(parsed);
  return null;
}

export function stringifyDocumentContent(content: DocumentContent | null): string {
  return JSON.stringify(content ?? createEmptyDocument());
}

export function deriveDocumentStats(content: DocumentContent | null): DocumentStats {
  const stats: DocumentStats = { mentionCounts: new Map(), bodyCharCount: 0 };
  if (content === null) return stats;

  const stack: unknown[] = [content];
  while (stack.length > 0) {
    const current = stack.pop();
    if (!isRecord(current)) continue;
    const node = current as DocumentNode;

    if (typeof node.text === "string") stats.bodyCharCount += node.text.length;
    const mentionId = getMentionEntityId(node);
    if (mentionId) stats.mentionCounts.set(mentionId, (stats.mentionCounts.get(mentionId) ?? 0) + 1);

    pushNodeChildren(node, stack);
  }

  return stats;
}

export function documentToPlainText(content: DocumentContent | null): string {
  if (content === null) return "";
  const parts: string[] = [];
  const visit = (node: unknown): void => {
    if (!isRecord(node)) return;
    if (typeof node.text === "string") parts.push(node.text);
    const children = Array.isArray(node.content)
      ? node.content
      : Array.isArray(node.children)
        ? node.children
        : [];
    for (const child of children) visit(child);
    if (node.type === "paragraph" || node.type === "heading") parts.push("\n");
  };
  visit(content);
  return parts.join("").replace(/\n{3,}/g, "\n\n").trim();
}

function textToDocument(text: string): DocumentContent {
  const lines = text.split(/\r?\n/);
  return {
    type: "doc",
    content: lines.map((line) => ({
      type: "paragraph",
      content: line ? [{ type: "text", text: line }] : undefined,
    })),
  };
}

function legacyStoryDocToDocument(value: Record<string, unknown>): DocumentContent {
  const root = isRecord(value.lexical) ? value.lexical.root : null;
  const text = collectLegacyText(root);
  return textToDocument(text);
}

function collectLegacyText(node: unknown): string {
  if (!isRecord(node)) return "";
  if (typeof node.text === "string") return node.text;
  const children = Array.isArray(node.children) ? node.children : [];
  const childText = children.map(collectLegacyText).filter(Boolean).join("");
  return node.type === "paragraph" || node.type === "heading" ? `${childText}\n` : childText;
}

function isTipTapDocument(value: unknown): value is DocumentContent {
  if (!isRecord(value)) return false;
  return value.type === "doc" && (value.content === undefined || Array.isArray(value.content));
}

function isLegacyStoryDoc(value: unknown): value is Record<string, unknown> {
  return isRecord(value) && isRecord(value.lexical) && isRecord(value.lexical.root);
}

function getMentionEntityId(node: DocumentNode): string | null {
  if (node.type !== "mention") return null;
  if (typeof node.entityId === "string") return node.entityId;
  if (isRecord(node.attrs) && typeof node.attrs.entityId === "string") return node.attrs.entityId;
  if (isRecord(node.attrs) && typeof node.attrs.id === "string") return node.attrs.id;
  return null;
}

function pushNodeChildren(node: DocumentNode, stack: unknown[]): void {
  const children = Array.isArray(node.content)
    ? node.content
    : Array.isArray(node.children)
      ? node.children
      : [];
  for (let i = children.length - 1; i >= 0; i--) stack.push(children[i]);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}
