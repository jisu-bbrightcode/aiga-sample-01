export const BIND_ENTRY_TYPE = "linear-task-gate:bind";
export const CLEAR_ENTRY_TYPE = "linear-task-gate:clear";
export const SUMMARY_ENTRY_TYPE = "linear-task-gate:summary";

export interface LinearContextSummary {
  kind: "issue" | "project";
  key: string;
  summary: string;
  recordedAt: number;
}

export function findLatestSummary(
  entries: readonly unknown[],
  match: { kind: "issue" | "project"; key: string },
): LinearContextSummary | null {
  for (let i = entries.length - 1; i >= 0; i--) {
    const entry = entries[i] as
      | { type?: string; customType?: string; data?: Partial<LinearContextSummary> }
      | undefined;
    if (!entry || entry.type !== "custom") continue;
    if (entry.customType !== SUMMARY_ENTRY_TYPE) continue;
    const d = entry.data;
    if (!d?.kind || !d.key || !d.summary) continue;
    if (d.kind === match.kind && d.key === match.key) {
      return {
        kind: d.kind,
        key: d.key,
        summary: d.summary,
        recordedAt: d.recordedAt ?? 0,
      };
    }
  }
  return null;
}

export type MutationStrength = "definite" | "possible";

export const PROJECT_KEY = "LINEAR-PROJECT";

export interface LinearTaskBindingDetails {
  goal?: string;
  issueKey: string;
  project?: { id: string; name: string; url?: string } | null;
}

export interface ToolCallLike {
  toolName: string;
  input?: Record<string, unknown>;
}

export interface MutationClassification {
  mutating: boolean;
  strength?: MutationStrength;
  reason?: string;
}

export type TaskCommandParseResult =
  | { mode: "bind"; issueKey: string; goal: string }
  | { mode: "bind"; issueKey: string; error: "missing-goal" }
  | { mode: "create"; goal: string; teamKey: LinearTaskTeamKey }
  | { mode: "create"; error: "missing-goal" }
  | { mode: "invalid"; error: "invalid-format" };

export type LinearTaskTeamKey = "FLE" | "FLT" | "FLP";

const DEFAULT_CREATE_TEAM: LinearTaskTeamKey = "FLT";
const CREATE_TEAM_KEYS = new Set<LinearTaskTeamKey>(["FLE", "FLT", "FLP"]);
const LINEAR_KEY_RE = /\b([A-Z][A-Z0-9]{1,9}-\d+)\b/i;

const DEFINITE_BASH_PATTERNS: [RegExp, string][] = [
  [/\bgit\s+(?:checkout\s+-b|switch\s+-c)\b/i, "git checkout -b"],
  [
    /\bgit\s+(?:commit|apply|am|merge|rebase|reset|clean|stash\s+(?:push|pop|apply)|mv|rm)\b/i,
    "git state-changing command",
  ],
  [/\b(?:rm|mv|cp|touch|mkdir|rmdir|ln)\b/i, "filesystem write command"],
  [
    /\b(?:npm|pnpm|yarn|bun)\s+(?:install|add|remove|update|dlx)\b/i,
    "package manager write command",
  ],
  [/\bnpx\s+shadcn\b/i, "code generation command"],
  [/\bpnpm\s+dlx\s+shadcn\b/i, "code generation command"],
  [/\bgraphify\s+update\b/i, "graphify update"],
  [/(?:^|\s)(?:>|>>|2>|&>)\s*[^\s]/, "shell redirection writes files"],
  [/\btee\b/i, "tee writes files"],
  [/\bsed\s+-i\b/i, "in-place edit command"],
  [/\bperl\s+-pi\b/i, "in-place edit command"],
];

const POSSIBLE_BASH_PATTERNS: [RegExp, string][] = [
  [
    /\b(?:npm|pnpm|yarn|bun)\s+(?:run\s+)?(?:test|build|dev|start|lint|check|format|exec)\b/i,
    "package script may change files",
  ],
  [
    /\b(?:node|tsx|ts-node|python|python3|ruby|bash|sh)\s+(?:\.\/)?(?:scripts|tools|bin)\//i,
    "project script may change files",
  ],
];

export function normalizeLinearIssueKey(value: string | null | undefined): string | null {
  if (!value) return null;
  const match = value.match(LINEAR_KEY_RE);
  return match ? match[1].toUpperCase() : null;
}

export function extractLinearIssueKey(text: string | null | undefined): string | null {
  return normalizeLinearIssueKey(text);
}

function parseCreateGoal(value: string): { goal: string; teamKey: LinearTaskTeamKey } | null {
  const [maybeTeam, ...rest] = value.trim().split(/\s+/);
  const normalizedTeam = maybeTeam?.toUpperCase() as LinearTaskTeamKey | undefined;
  if (normalizedTeam && CREATE_TEAM_KEYS.has(normalizedTeam)) {
    const goal = rest.join(" ").trim();
    return goal ? { goal, teamKey: normalizedTeam } : null;
  }
  return value.trim() ? { goal: value.trim(), teamKey: DEFAULT_CREATE_TEAM } : null;
}

export function parseTaskCommandArgs(raw: string): TaskCommandParseResult {
  const value = raw.trim();
  const createMatch = value.match(/^(?:new|create)(?:\s+(.+))?$/i);
  if (createMatch) {
    const parsedCreate = parseCreateGoal(createMatch[1] ?? "");
    return parsedCreate
      ? { mode: "create", ...parsedCreate }
      : { mode: "create", error: "missing-goal" };
  }

  // Linear issue URL: https://linear.app/<org>/issue/FLT-123/slug-title
  const urlMatch = value.match(/linear\.app\/[^/]+\/issue\/([A-Z][A-Z0-9]{1,9}-\d+)/i);
  if (urlMatch) {
    return { mode: "bind", issueKey: urlMatch[1].toUpperCase(), error: "missing-goal" };
  }

  const issueKey = normalizeLinearIssueKey(value);
  if (!issueKey) return { mode: "invalid", error: "invalid-format" };

  const goal = value.replace(LINEAR_KEY_RE, "").trim();
  return goal
    ? { mode: "bind", issueKey, goal }
    : { mode: "bind", issueKey, error: "missing-goal" };
}

export function summarizeMutatingToolCall(event: ToolCallLike): string | null {
  if (event.toolName === "edit" || event.toolName === "write") {
    const target = String(event.input?.path ?? event.input?.filePath ?? "").trim();
    return target ? `${event.toolName} ${target}` : event.toolName;
  }

  if (event.toolName === "bash") {
    const command = String(event.input?.command ?? "")
      .trim()
      .replace(/\s+/g, " ");
    if (!command) return "bash";
    const words = command.split(/\s+/);
    const shortCommand = words.length > 5 ? `${words.slice(0, 5).join(" ")}...` : command;
    return `bash ${shortCommand}`;
  }

  return null;
}

export function classifyToolCall(event: ToolCallLike): MutationClassification {
  if (event.toolName === "edit") {
    return { mutating: true, strength: "definite", reason: "edit tool modifies files" };
  }

  if (event.toolName === "write") {
    return { mutating: true, strength: "definite", reason: "write tool modifies files" };
  }

  if (event.toolName !== "bash") return { mutating: false };

  const command = String(event.input?.command ?? "").trim();
  if (!command) return { mutating: false };

  for (const [pattern, label] of DEFINITE_BASH_PATTERNS) {
    if (pattern.test(command)) {
      return {
        mutating: true,
        strength: "definite",
        reason: `bash command can change repository state: ${label}`,
      };
    }
  }

  for (const [pattern, label] of POSSIBLE_BASH_PATTERNS) {
    if (pattern.test(command)) {
      const commandLabel = command.split(/\s+/).slice(0, 2).join(" ") || label;
      return {
        mutating: true,
        strength: "possible",
        reason: `bash command may run scripts that change files: ${commandLabel}`,
      };
    }
  }

  return { mutating: false };
}

export function findLatestBindingDetails(
  entries: readonly unknown[],
): LinearTaskBindingDetails | null {
  for (let i = entries.length - 1; i >= 0; i--) {
    const entry = entries[i] as
      | {
          type?: string;
          customType?: string;
          data?: {
            goal?: string;
            issueKey?: string;
            project?: { id?: string; name?: string; url?: string } | null;
          };
        }
      | undefined;
    if (!entry || entry.type !== "custom") continue;
    if (entry.customType === CLEAR_ENTRY_TYPE) return null;
    if (entry.customType === BIND_ENTRY_TYPE) {
      const data = entry.data;
      if (data?.issueKey === PROJECT_KEY && data.project?.id && data.project?.name) {
        return {
          goal: data.goal,
          issueKey: PROJECT_KEY,
          project: { id: data.project.id, name: data.project.name, url: data.project.url },
        };
      }
      if (data?.issueKey === "NO-LINEAR") {
        return { goal: data.goal, issueKey: "NO-LINEAR" };
      }
      const issueKey = normalizeLinearIssueKey(data?.issueKey);
      return issueKey ? { goal: data?.goal, issueKey } : null;
    }
  }
  return null;
}

export function findLatestBinding(entries: readonly unknown[]): string | null {
  return findLatestBindingDetails(entries)?.issueKey ?? null;
}
