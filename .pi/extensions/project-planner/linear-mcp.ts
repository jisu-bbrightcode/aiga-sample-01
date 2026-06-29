// @ts-nocheck
/**
 * Linear MCP helpers for project-planner extension.
 *
 * This file intentionally uses Pi's MCP gateway tool only. Do not add direct
 * Linear SDK/GraphQL/fetch token logic here.
 */

import os from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";
import type { ExtensionAPI, ExtensionContext } from "@earendil-works/pi-coding-agent";
import { buildProjectDescriptionWithDependencyGraph, type NormalizedPlan } from "./plan";
import { parseLinearProjectId } from "./project-id";

export interface LinearTeam {
  id: string;
  key: string;
  name: string;
}

export interface LinearProject {
  id: string;
  name: string;
  url?: string;
  teams?: LinearTeam[];
  milestones?: LinearMilestone[];
}

export interface LinearMilestone {
  id: string;
  name: string;
}

export interface LinearIssue {
  id?: string;
  identifier: string;
  title: string;
  url?: string;
}

export interface RegistrationResult {
  project: { id: string; name: string; url?: string };
  appended: boolean;
  milestones: Array<{
    id: string;
    name: string;
    reused: boolean;
    issues: Array<{ identifier: string; title: string; url?: string }>;
  }>;
  dependencies: Array<{
    blockedBy: string;
    blockedIssue: string;
  }>;
}

export { parseLinearProjectId };

type McpRunner = (tool: string, args: Record<string, unknown>) => Promise<unknown>;

function extractTextContent(result: unknown): string {
  if (typeof result === "string") return result;
  const content = (result as any)?.content;
  if (typeof content === "string") return content;
  if (Array.isArray(content)) {
    return content
      .map((entry) => {
        if (typeof entry === "string") return entry;
        if (typeof entry?.text === "string") return entry.text;
        return "";
      })
      .filter(Boolean)
      .join("\n");
  }
  if (result && typeof result === "object") return JSON.stringify(result);
  return "";
}

function parseJsonFromText(text: string): unknown {
  const trimmed = text.trim();
  if (!trimmed) return null;
  try {
    return JSON.parse(trimmed);
  } catch {
    const firstObject = trimmed.indexOf("{");
    const firstArray = trimmed.indexOf("[");
    const starts = [firstObject, firstArray].filter((idx) => idx >= 0);
    const start = starts.length ? Math.min(...starts) : -1;
    if (start < 0) return null;
    const lastObject = trimmed.lastIndexOf("}");
    const lastArray = trimmed.lastIndexOf("]");
    const end = Math.max(lastObject, lastArray);
    if (end <= start) return null;
    try {
      return JSON.parse(trimmed.slice(start, end + 1));
    } catch {
      return null;
    }
  }
}

function asArray(value: unknown): unknown[] {
  if (Array.isArray(value)) return value;
  if (Array.isArray((value as any)?.nodes)) return (value as any).nodes;
  if (Array.isArray((value as any)?.items)) return (value as any).items;
  if (Array.isArray((value as any)?.projects)) return (value as any).projects;
  if (Array.isArray((value as any)?.teams)) return (value as any).teams;
  if (Array.isArray((value as any)?.milestones)) return (value as any).milestones;
  if (Array.isArray((value as any)?.issues)) return (value as any).issues;
  return [];
}

function unwrapPayload(result: unknown): unknown {
  const text = extractTextContent(result);
  const parsed = parseJsonFromText(text);
  return parsed ?? result;
}

function normalizeTeam(raw: any): LinearTeam | null {
  if (!raw) return null;
  const key = raw.key ?? raw.identifier ?? raw.name;
  if (!raw.id || !key) return null;
  return { id: String(raw.id), key: String(key).toUpperCase(), name: String(raw.name ?? key) };
}

function normalizeProject(raw: any): LinearProject | null {
  if (!raw) return null;
  const id = raw.id ?? raw.slugId ?? raw.slug;
  const name = raw.name ?? raw.title;
  if (!id || !name) return null;
  return {
    id: String(id),
    name: String(name),
    url: raw.url ? String(raw.url) : undefined,
    teams: asArray(raw.teams).map(normalizeTeam).filter(Boolean),
    milestones: asArray(raw.milestones ?? raw.projectMilestones)
      .map(normalizeMilestone)
      .filter(Boolean),
  };
}

function normalizeMilestone(raw: any): LinearMilestone | null {
  if (!raw) return null;
  const id = raw.id ?? raw.name;
  if (!id || !raw.name) return null;
  return { id: String(id), name: String(raw.name) };
}

function normalizeIssue(raw: any): LinearIssue | null {
  if (!raw) return null;
  const identifier = raw.identifier ?? raw.id;
  if (!identifier || !raw.title) return null;
  return {
    id: raw.id ? String(raw.id) : undefined,
    identifier: String(identifier).toUpperCase(),
    title: String(raw.title),
    url: raw.url ? String(raw.url) : undefined,
  };
}

async function importPiMcpAdapter(
  moduleName: "direct-tools" | "init" | "proxy-modes",
): Promise<any> {
  const file = path.join(
    os.homedir(),
    ".pi/agent/npm/node_modules/pi-mcp-adapter",
    `${moduleName}.ts`,
  );
  return await import(pathToFileURL(file).href);
}

let localMcpState: any | null = null;
let localMcpInitPromise: Promise<any> | null = null;

async function getLocalMcpState(pi: ExtensionAPI, ctx: ExtensionContext): Promise<any> {
  if (localMcpState) return localMcpState;
  if (!localMcpInitPromise) {
    localMcpInitPromise = importPiMcpAdapter("init")
      .then(({ initializeMcp }) => initializeMcp(pi, ctx))
      .then((state) => {
        localMcpState = state;
        return state;
      })
      .finally(() => {
        localMcpInitPromise = null;
      });
  }
  return await localMcpInitPromise;
}

async function callMcp(
  pi: ExtensionAPI,
  ctx: ExtensionContext,
  tool: string,
  args: Record<string, unknown>,
): Promise<unknown> {
  const [{ executeCall }, state] = await Promise.all([
    importPiMcpAdapter("proxy-modes"),
    getLocalMcpState(pi, ctx),
  ]);
  const result = await executeCall(state, tool, args, "linear", () => pi.getAllTools());
  const details = (result as any)?.details;
  if (details?.error) {
    throw new Error(extractTextContent(result) || `Linear MCP ${tool} 호출 실패`);
  }
  return unwrapPayload(result);
}

export function createLinearMcpRunner(pi: ExtensionAPI, ctx: ExtensionContext): McpRunner {
  return (tool, args) => callMcp(pi, ctx, tool, args);
}

export async function fetchProjectById(
  runMcp: McpRunner,
  projectId: string,
): Promise<LinearProject | null> {
  const payload = await runMcp("linear_get_project", {
    query: projectId,
    includeMilestones: true,
  });
  return normalizeProject(payload);
}

export async function fetchTeamByKey(
  runMcp: McpRunner,
  teamKey: string,
): Promise<LinearTeam | null> {
  const payload = await runMcp("linear_list_teams", { query: teamKey, limit: 10 });
  const team = asArray(payload)
    .map(normalizeTeam)
    .filter(Boolean)
    .find((candidate) => candidate.key.toUpperCase() === teamKey.toUpperCase());
  return team ?? null;
}

export async function createProject(
  runMcp: McpRunner,
  args: { name: string; description?: string; teamKey: string },
): Promise<LinearProject | null> {
  const payload = await runMcp("linear_save_project", {
    name: args.name,
    description: args.description,
    addTeams: [args.teamKey],
  });
  return normalizeProject(payload);
}

export async function createMilestone(
  runMcp: McpRunner,
  args: { name: string; projectId: string; description?: string },
): Promise<LinearMilestone | null> {
  const payload = await runMcp("linear_save_milestone", {
    project: args.projectId,
    name: args.name,
    description: args.description,
  });
  return normalizeMilestone(payload);
}

export async function createIssue(
  runMcp: McpRunner,
  args: {
    teamKey: string;
    title: string;
    description?: string;
    projectId: string;
    milestoneId: string;
  },
): Promise<LinearIssue | null> {
  const payload = await runMcp("linear_save_issue", {
    team: args.teamKey,
    title: args.title,
    description: args.description,
    project: args.projectId,
    milestone: args.milestoneId,
  });
  return normalizeIssue(payload);
}

export async function createIssueRelation(
  runMcp: McpRunner,
  args: { issueId: string; relatedIssueId: string; type: "blockedBy" | "blocks" },
): Promise<void> {
  await runMcp("linear_save_issue", {
    id: args.issueId,
    ...(args.type === "blockedBy"
      ? { blockedBy: [args.relatedIssueId] }
      : { blocks: [args.relatedIssueId] }),
  });
}

export async function registerPlanWithLinearMcp(
  runMcp: McpRunner,
  plan: NormalizedPlan,
  teamKey: string,
  existingProjectId: string | null,
): Promise<RegistrationResult> {
  let project: { id: string; name: string; url?: string };
  const existingMilestones = new Map<string, { id: string; name: string }>();

  if (existingProjectId) {
    const fetched = await fetchProjectById(runMcp, existingProjectId);
    if (!fetched) throw new Error(`Linear 프로젝트를 찾을 수 없습니다: ${existingProjectId}`);
    project = { id: fetched.id, name: fetched.name, url: fetched.url };
    for (const m of fetched.milestones ?? []) {
      existingMilestones.set(m.name.trim().toLowerCase(), { id: m.id, name: m.name });
    }
  } else {
    const team = await fetchTeamByKey(runMcp, teamKey);
    if (!team) throw new Error(`Linear 팀을 찾을 수 없습니다: ${teamKey}`);
    const created = await createProject(runMcp, {
      name: plan.projectName,
      description: buildProjectDescriptionWithDependencyGraph(plan),
      teamKey: team.key,
    });
    if (!created) throw new Error("Linear 프로젝트 생성 실패");
    project = { id: created.id, name: created.name, url: created.url };
  }

  const milestoneResults: RegistrationResult["milestones"] = [];
  const issueIdsByKey = new Map<string, { id: string; identifier: string }>();

  for (const phase of plan.phases) {
    const reuse = existingMilestones.get(phase.name.trim().toLowerCase());
    let milestone: { id: string; name: string };
    let reused = false;

    if (reuse) {
      milestone = reuse;
      reused = true;
    } else {
      const created = await createMilestone(runMcp, {
        name: phase.name,
        projectId: project.id,
        description: phase.description,
      });
      if (!created) throw new Error(`Milestone 생성 실패: ${phase.name}`);
      milestone = { id: created.id, name: created.name };
    }

    const issues: Array<{ identifier: string; title: string; url?: string }> = [];
    for (const issue of phase.issues) {
      const created = await createIssue(runMcp, {
        teamKey,
        title: issue.fullTitle,
        description: issue.description,
        projectId: project.id,
        milestoneId: milestone.id,
      });
      if (!created?.id) throw new Error(`이슈 생성 실패: ${issue.fullTitle}`);
      issueIdsByKey.set(issue.key, { id: created.id, identifier: created.identifier });
      issues.push({ identifier: created.identifier, title: created.title, url: created.url });
    }

    milestoneResults.push({ id: milestone.id, name: milestone.name, reused, issues });
  }

  const dependencyResults: RegistrationResult["dependencies"] = [];
  for (const dep of plan.dependencies) {
    const blocked = issueIdsByKey.get(dep.blockedIssueKey);
    const blocker = issueIdsByKey.get(dep.blockingIssueKey);
    if (!blocked || !blocker) {
      throw new Error(
        `의존성 이슈를 찾을 수 없습니다: ${dep.blockingIssueKey} -> ${dep.blockedIssueKey}`,
      );
    }
    await createIssueRelation(runMcp, {
      issueId: blocked.id,
      relatedIssueId: blocker.id,
      type: "blockedBy",
    });
    dependencyResults.push({ blockedBy: blocker.identifier, blockedIssue: blocked.identifier });
  }

  return {
    project,
    appended: Boolean(existingProjectId),
    milestones: milestoneResults,
    dependencies: dependencyResults,
  };
}
