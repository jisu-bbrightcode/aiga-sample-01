// @ts-nocheck
/**
 * Shared helpers for write-time rule evaluation. Pure functions, no pi or
 * fs imports — safe to load from any extension or smoke test.
 */

/** Generic violation shape produced by any rule. */
export interface Violation {
  /** Stable id used for grouping (mirrors oxlint rule name). */
  rule: string;
  /** Short kind tag inside the rule (e.g. "useMemo" vs "useCallback"). */
  kind: string;
  /** ≤120 char excerpt to anchor the message. */
  snippet: string;
}

/** Pi tool event shape we care about (subset). */
export interface ToolEvent {
  toolName: string;
  input?: Record<string, unknown>;
}

/** Extract `path` / `file_path` from a write/edit/multi_edit tool event. */
export function readToolPath(event: ToolEvent): string {
  const input = event.input ?? {};
  return (input.path as string) ?? (input.file_path as string) ?? "";
}

/** Extract the text(s) being inserted. Returns one string per edit. */
export function readToolText(event: ToolEvent): string[] {
  const input = event.input ?? {};
  if (event.toolName === "write") {
    const c = input.content as string | undefined;
    return c ? [c] : [];
  }
  if (event.toolName === "edit" || event.toolName === "multi_edit") {
    const edits = (input.edits as Array<{ newText?: string }>) ?? [];
    return edits.map((e) => e.newText ?? "").filter(Boolean);
  }
  return [];
}

/** Truncate to N chars, append … if cut. */
export function clip(s: string, n = 120): string {
  const t = s.replace(/\s+/g, " ").trim();
  return t.length <= n ? t : `${t.slice(0, n)}…`;
}

/** Build a block message from a rule name, advice, and the first few violations. */
export function buildBlockMessage(
  ruleName: string,
  advice: readonly string[],
  violations: readonly Violation[],
): string {
  const head = `${ruleName} 차단 — write-time gate.`;
  const examples = violations
    .slice(0, 3)
    .map((v) => `  • [${v.kind}] ${v.snippet}`)
    .join("\n");
  return [head, "", "감지된 위반:", examples, "", "사용해야 하는 방법:", ...advice].join("\n");
}
