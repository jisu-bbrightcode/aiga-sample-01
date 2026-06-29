type TipTapJson = Record<string, unknown>;

interface TipTapNode {
  type?: string;
  text?: string;
  content?: TipTapNode[];
}

const EMPTY_DOC: TipTapJson = {
  type: "doc",
  content: [{ type: "paragraph" }],
};

function isTipTapNode(value: unknown): value is TipTapNode {
  return typeof value === "object" && value !== null;
}

function extractTextFromNodes(nodes: unknown): string {
  if (!Array.isArray(nodes)) return "";
  return nodes
    .map((node) => {
      if (!isTipTapNode(node)) return "";
      if (typeof node.text === "string") return node.text;
      return extractTextFromNodes(node.content);
    })
    .join(" ")
    .trim();
}

function plainTextToDoc(content: string): TipTapJson {
  const lines = content.split(/\n{2,}/).filter((line) => line.trim().length > 0);
  if (lines.length === 0) return EMPTY_DOC;

  return {
    type: "doc",
    content: lines.map((line) => ({
      type: "paragraph",
      content: [{ type: "text", text: line }],
    })),
  };
}

/**
 * Extracts plain text from TipTap JSON content
 * Falls back to treating input as plain text if JSON parsing fails
 * @param content - TipTap JSON string or plain text
 * @param maxLength - Maximum length of returned text (default: 200)
 * @returns Plain text string, truncated to maxLength
 */
export function extractPlainText(content: string, maxLength = 200): string {
  if (!content) return "";
  try {
    const json = JSON.parse(content);
    return extractTextFromNodes(json.content).slice(0, maxLength);
  } catch {
    return content.slice(0, maxLength);
  }
}

/**
 * Determines if content is TipTap rich text JSON
 * @param content - Content string to check
 * @returns True if content is valid TipTap JSON, false otherwise
 */
export function isRichContent(content: string): boolean {
  if (!content) return false;
  try {
    const json = JSON.parse(content);
    return json.type === "doc" && Array.isArray(json.content);
  } catch {
    return false;
  }
}

export function parseEditorContent(content: string | null | undefined): TipTapJson {
  if (!content) return EMPTY_DOC;
  try {
    const json = JSON.parse(content);
    if (json?.type === "doc" && Array.isArray(json.content)) {
      return json;
    }
  } catch {
    // Plain text is still a valid legacy community payload.
  }
  return plainTextToDoc(content);
}

export function stringifyEditorContent(content: TipTapJson | null | undefined): string {
  return JSON.stringify(content ?? EMPTY_DOC);
}
