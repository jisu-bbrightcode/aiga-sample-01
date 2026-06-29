// @ts-nocheck
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

export interface LinearIssueSummary {
  id: string;
  identifier: string;
  title: string;
  url?: string;
  description?: string;
}

type EnvMap = Record<string, string | undefined>;

interface McpServerConfig {
  env?: EnvMap;
  bearerToken?: string;
  bearerTokenEnv?: string;
}

interface McpConfig {
  mcpServers?: Record<string, McpServerConfig | undefined>;
}

const LINEAR_GRAPHQL_URL = "https://api.linear.app/graphql";

function expandHome(filePath: string): string {
  return filePath.startsWith("~/") ? path.join(os.homedir(), filePath.slice(2)) : filePath;
}

function readJsonFile(filePath: string): unknown | null {
  try {
    return JSON.parse(fs.readFileSync(expandHome(filePath), "utf8"));
  } catch {
    return null;
  }
}

function resolveEnvValue(value: string | undefined, env: EnvMap): string | null {
  if (!value) return null;
  const envMatch = value.match(/^\$\{?([A-Z0-9_]+)\}?$/i) ?? value.match(/^\$env:([A-Z0-9_]+)$/i);
  if (envMatch) return env[envMatch[1]] ?? null;
  return value;
}

export function extractLinearTokenFromConfig(
  config: unknown,
  env: EnvMap = process.env,
): string | null {
  const servers = (config as McpConfig | null)?.mcpServers;
  const linear = servers?.linear;
  if (!linear) return null;

  return (
    resolveEnvValue(linear.env?.LINEAR_API_KEY, env) ??
    resolveEnvValue(linear.bearerToken, env) ??
    (linear.bearerTokenEnv ? (env[linear.bearerTokenEnv] ?? null) : null)
  );
}

export function findLinearToken(cwd: string, env: EnvMap = process.env): string | null {
  if (env.LINEAR_API_KEY) return env.LINEAR_API_KEY;

  const candidates = [
    path.join(cwd, ".pi", "mcp.json"),
    path.join(cwd, ".mcp.json"),
    path.join(os.homedir(), ".pi", "agent", "mcp.json"),
    path.join(os.homedir(), ".config", "mcp", "mcp.json"),
  ];

  for (const filePath of candidates) {
    const token = extractLinearTokenFromConfig(readJsonFile(filePath), env);
    if (token) return token;
  }

  return null;
}

export function buildLinearTaskComment(
  goal: string,
  status: "done" | "start",
  summary?: string,
): string {
  const heading = status === "start" ? "Pi 작업 시작" : "Pi 작업 완료";
  return [heading, `목표: ${goal}`, summary ? `요약: ${summary}` : undefined]
    .filter(Boolean)
    .join("\n\n");
}

export function buildLinearProgressComment(options: {
  goal?: string;
  issueTitle?: string;
  evidence?: readonly string[];
}): string {
  const evidence = [...new Set(options.evidence ?? [])].slice(0, 3);
  return [
    "Pi 작업 진행",
    options.goal ? `목표: ${options.goal}` : undefined,
    options.issueTitle ? `이슈: ${options.issueTitle}` : undefined,
    `상태: Pi가 로컬 코드 변경/mutating tool 실행을 수행했습니다.${
      evidence.length ? ` (${evidence.join(", ")})` : ""
    }`,
    "참고: 최종 완료 처리는 /task done 또는 push/review 흐름이 필요합니다.",
  ]
    .filter(Boolean)
    .join("\n\n");
}

export function normalizeLinearIssue(issue: unknown): LinearIssueSummary | null {
  if (!issue || typeof issue !== "object") return null;
  const value = issue as Partial<LinearIssueSummary>;
  if (!value.id || !value.identifier || !value.title) return null;
  const normalized: LinearIssueSummary = {
    id: value.id,
    identifier: value.identifier.toUpperCase(),
    title: value.title,
    url: value.url,
  };
  if (value.description !== undefined) normalized.description = value.description;
  return normalized;
}

async function linearGraphql<T>(
  token: string,
  query: string,
  variables: Record<string, unknown>,
  signal?: AbortSignal,
): Promise<T | null> {
  const response = await fetch(LINEAR_GRAPHQL_URL, {
    body: JSON.stringify({ query, variables }),
    headers: {
      Authorization: token,
      "Content-Type": "application/json",
    },
    method: "POST",
    signal,
  });

  if (!response.ok) return null;
  return (await response.json()) as T;
}

async function fetchLinearTeamId(
  teamKey: string,
  token: string,
  signal?: AbortSignal,
): Promise<string | null> {
  const payload = await linearGraphql<{ data?: { teams?: { nodes?: Array<{ id?: string }> } } }>(
    token,
    `
      query PiLinearTaskGateTeam($key: String!) {
        teams(filter: { key: { eq: $key } }, first: 1) {
          nodes { id }
        }
      }
    `,
    { key: teamKey },
    signal,
  );
  return payload?.data?.teams?.nodes?.[0]?.id ?? null;
}

export async function createLinearIssue(
  title: string,
  token: string,
  options: { description?: string; signal?: AbortSignal; teamKey?: string } = {},
): Promise<LinearIssueSummary | null> {
  const teamKey = options.teamKey ?? "FLT";
  const teamId = await fetchLinearTeamId(teamKey, token, options.signal);
  if (!teamId) return null;

  const payload = await linearGraphql<{ data?: { issueCreate?: { issue?: unknown } } }>(
    token,
    `
      mutation PiLinearTaskGateCreateIssue($teamId: String!, $title: String!, $description: String) {
        issueCreate(input: { teamId: $teamId, title: $title, description: $description }) {
          success
          issue {
            id
            identifier
            title
            url
          }
        }
      }
    `,
    { description: options.description, teamId, title },
    options.signal,
  );
  return normalizeLinearIssue(payload?.data?.issueCreate?.issue);
}

export async function createLinearComment(
  issueId: string,
  body: string,
  token: string,
  signal?: AbortSignal,
): Promise<boolean> {
  const payload = await linearGraphql<{ data?: { commentCreate?: { success?: boolean } } }>(
    token,
    `
      mutation PiLinearTaskGateComment($issueId: String!, $body: String!) {
        commentCreate(input: { issueId: $issueId, body: $body }) {
          success
        }
      }
    `,
    { body, issueId },
    signal,
  );
  return Boolean(payload?.data?.commentCreate?.success);
}

async function fetchInReviewStateId(
  teamId: string,
  token: string,
  signal?: AbortSignal,
): Promise<string | null> {
  const payload = await linearGraphql<{
    data?: { workflowStates?: { nodes?: Array<{ id: string; name: string }> } };
  }>(
    token,
    `query PiLinearInReviewState($teamId: String!) {
      workflowStates(filter: { team: { id: { eq: $teamId } } }) {
        nodes { id name }
      }
    }`,
    { teamId },
    signal,
  );
  const states = payload?.data?.workflowStates?.nodes ?? [];
  const found = states.find((s) => /in[\s_-]?review|\uac80\ud1a0/i.test(s.name));
  return found?.id ?? null;
}

export async function moveIssueToInReview(
  issueId: string,
  teamKey: string,
  token: string,
  signal?: AbortSignal,
): Promise<boolean> {
  const teamId = await fetchLinearTeamId(teamKey, token, signal);
  if (!teamId) return false;

  const stateId = await fetchInReviewStateId(teamId, token, signal);
  if (!stateId) return false;

  const payload = await linearGraphql<{ data?: { issueUpdate?: { success?: boolean } } }>(
    token,
    `mutation PiLinearMoveInReview($id: String!, $stateId: String!) {
      issueUpdate(id: $id, input: { stateId: $stateId }) {
        success
      }
    }`,
    { id: issueId, stateId },
    signal,
  );
  return Boolean(payload?.data?.issueUpdate?.success);
}

export async function fetchLinearIssue(
  issueKey: string,
  token: string,
  signal?: AbortSignal,
): Promise<LinearIssueSummary | null> {
  const response = await fetch(LINEAR_GRAPHQL_URL, {
    body: JSON.stringify({
      query: `
        query PiLinearTaskGateIssue($id: String!) {
          issue(id: $id) {
            id
            identifier
            title
            url
            description
          }
        }
      `,
      variables: { id: issueKey },
    }),
    headers: {
      Authorization: token,
      "Content-Type": "application/json",
    },
    method: "POST",
    signal,
  });

  if (!response.ok) return null;

  const payload = (await response.json()) as { data?: { issue?: unknown } };
  return normalizeLinearIssue(payload.data?.issue);
}
