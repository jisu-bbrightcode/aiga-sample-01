// @ts-nocheck
import path from "node:path";
/**
 * linear-task-gate
 *
 * Lazy Linear task binding gate for Pi sessions.
 *
 * The extension does not interrupt research/chat. It waits until the first
 * mutating tool call (edit/write or mutating bash command), then requires a
 * Linear issue key such as FLT-123 plus a concrete work goal. The key and goal
 * are persisted as a custom session entry, so /resume and /tree restore the
 * binding for the active branch.
 *
 * Usage:
 *   /task FLO-1 작업 목표        Bind current session branch to a Linear issue
 *   /task new 작업 목표          Create a Linear issue and bind it
 *   /task done 완료 요약         Comment completion and clear binding
 *   /task                       Show current binding
 *   /task clear                 Clear current binding
 */

import type { ExtensionAPI, ExtensionContext } from "@earendil-works/pi-coding-agent";
import { Type } from "typebox";
import {
  createLinearMcpRunner,
  fetchProjectById,
  parseLinearProjectId,
} from "../project-planner/linear-mcp";
import {
  buildLinearProgressComment,
  buildLinearTaskComment,
  createLinearComment,
  createLinearIssue,
  fetchLinearIssue,
  findLinearToken,
  type LinearIssueSummary,
  moveIssueToInReview,
} from "./linear-client";
import {
  BIND_ENTRY_TYPE,
  CLEAR_ENTRY_TYPE,
  classifyToolCall,
  extractLinearIssueKey,
  findLatestBindingDetails,
  findLatestSummary,
  normalizeLinearIssueKey,
  PROJECT_KEY,
  parseTaskCommandArgs,
  SUMMARY_ENTRY_TYPE,
  summarizeMutatingToolCall,
} from "./rules";

const STATUS_KEY = "linear-task";

interface TaskResolution {
  goal: string;
  issueKey: string;
  noLinear?: boolean;
  project?: { id: string; name: string; url?: string };
}

const NO_LINEAR_KEY = "NO-LINEAR";

function branchEntries(ctx: ExtensionContext): readonly unknown[] {
  const manager = ctx.sessionManager as {
    getBranch?: () => readonly unknown[];
    getEntries?: () => readonly unknown[];
  };
  return manager.getBranch?.() ?? manager.getEntries?.() ?? [];
}

function bindIssue(
  pi: ExtensionAPI,
  ctx: ExtensionContext,
  options: { goal: string; issue?: LinearIssueSummary | null; issueKey: string; source: string },
): TaskResolution | null {
  const normalized = normalizeLinearIssueKey(options.issueKey);
  if (!normalized) return null;

  pi.appendEntry(BIND_ENTRY_TYPE, {
    goal: options.goal,
    issue: options.issue,
    issueKey: normalized,
    source: options.source,
    timestamp: Date.now(),
  });
  ctx.ui.setStatus(STATUS_KEY, `Linear: ${normalized}`);
  return { goal: options.goal, issueKey: normalized };
}

function instructAgentToReadIssue(
  pi: ExtensionAPI,
  options: { issueKey: string; goal: string; url?: string },
): void {
  const body = [
    `# 연결된 Linear 이슈: ${options.issueKey}`,
    options.url ? options.url : undefined,
    "",
    "작업을 시작하기 전에 **반드시 먼저** linear MCP 도구로 이 이슈를 읽으세요:",
    `- linear MCP의 get_issue (또는 동등 도구)로 ${options.issueKey} 의 description·state·라벨·코멘트를 조회.`,
    "- 관련 하위/상위 이슈가 있으면 함께 조회.",
    "- 읽은 내용을 한국어 2~5줄로 요약하고 이해한 범위를 명시.",
    "",
    `작업 목표: ${options.goal}`,
    "",
    "이슈 내용 파악 이전에는 코드 수정·파일 생성·구현 플랜 제안을 시작하지 마세요.",
  ]
    .filter(Boolean)
    .join("\n");
  // deliverAs:"followUp" — MCP 서버가 세션 시작 시점에 아직 초기화 중일 수 있으므로
  // 현재 에이전트 루프가 아닌 다음 사용자 입력 때 처리되도록 지연 전달.
  pi.sendUserMessage(body, { deliverAs: "followUp" });
}

function instructAgentToReadProject(
  pi: ExtensionAPI,
  options: { project: { id: string; name: string; url?: string }; goal: string },
): void {
  const body = [
    `# 연결된 Linear 프로젝트: ${options.project.name}`,
    options.project.url ? options.project.url : undefined,
    `Project ID: ${options.project.id}`,
    "",
    "작업을 시작하기 전에 **반드시 먼저** linear MCP 도구로 이 프로젝트를 읽으세요:",
    "- linear MCP의 get_project / list_project_milestones / list_issues (또는 동등 도구)로:",
    "  - 프로젝트 description·state·팀·milestones·속한 이슈 목록을 조회.",
    "  - 각 milestone의 이슈 구성과 진행 상태 파악.",
    "- 읽은 내용을 한국어로 요약: 프로젝트 목적, milestone 구조, 현재 진철 단계.",
    "",
    `작업 목표: ${options.goal}`,
    "",
    "프로젝트 구조 파악 이전에는 코드 수정·구현 플랜 제안을 시작하지 마세요.",
  ]
    .filter(Boolean)
    .join("\n");
  // deliverAs:"followUp" — MCP 서버가 세션 시작 시점에 아직 초기화 중일 수 있으므로
  // 현재 에이전트 루프가 아닌 다음 사용자 입력 때 처리되도록 지연 전달.
  pi.sendUserMessage(body, { deliverAs: "followUp" });
}

function bindOtherWork(
  pi: ExtensionAPI,
  ctx: ExtensionContext,
  goal: string,
  source: string,
): TaskResolution | null {
  const cleanGoal = goal.trim() || "별도 작업";

  pi.appendEntry(BIND_ENTRY_TYPE, {
    goal: cleanGoal,
    issueKey: NO_LINEAR_KEY,
    noLinear: true,
    source,
    timestamp: Date.now(),
  });
  ctx.ui.setStatus(STATUS_KEY, "Linear: 별도 작업");
  ctx.ui.notify("Linear 없이 별도 작업으로 진행합니다.", "info");
  return { goal: cleanGoal, issueKey: NO_LINEAR_KEY, noLinear: true };
}

function clearIssue(pi: ExtensionAPI, ctx: ExtensionContext) {
  pi.appendEntry(CLEAR_ENTRY_TYPE, { timestamp: Date.now() });
  ctx.ui.setStatus(STATUS_KEY, "Linear: unbound");
}

async function inferIssueFromBranch(
  pi: ExtensionAPI,
  ctx: ExtensionContext,
): Promise<string | null> {
  try {
    const result = await pi.exec("git", ["branch", "--show-current"], {
      cwd: ctx.cwd,
      signal: ctx.signal,
      timeout: 3000,
    });
    if (result.code !== 0) return null;
    return extractLinearIssueKey(result.stdout);
  } catch {
    return null;
  }
}

function slugifyBranchName(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

async function setupWorktreeForIssue(
  pi: ExtensionAPI,
  ctx: ExtensionContext,
  issueKey: string,
): Promise<void> {
  const branchName = slugifyBranchName(issueKey);
  const repoName = path.basename(ctx.cwd);
  const worktreePath = path.join(ctx.cwd, "..", `${repoName}-${branchName}`);

  const listResult = await pi.exec("git", ["worktree", "list", "--porcelain"], {
    cwd: ctx.cwd,
    signal: ctx.signal,
    timeout: 5000,
  });
  if (listResult.code !== 0) return;

  if (listResult.stdout.includes(worktreePath)) {
    ctx.ui.notify(`워크트리 이미 존재: ${worktreePath}`, "info");
    return;
  }

  const branchCheck = await pi.exec("git", ["branch", "--list", branchName], {
    cwd: ctx.cwd,
    signal: ctx.signal,
    timeout: 3000,
  });
  const branchExists = branchCheck.stdout.trim().length > 0;

  const addArgs = branchExists
    ? ["worktree", "add", worktreePath, branchName]
    : ["worktree", "add", "-b", branchName, worktreePath];

  const result = await pi.exec("git", addArgs, {
    cwd: ctx.cwd,
    signal: ctx.signal,
    timeout: 10000,
  });

  if (result.code !== 0) {
    ctx.ui.notify(`워크트리 생성 실패: ${result.stderr}`, "warning");
    return;
  }

  ctx.ui.notify(`워크트리 및 브랜치 생성됨\n브랜치: ${branchName}\n경로: ${worktreePath}`, "info");
}

function deriveGoalFromIssue(issue: { title: string; description?: string }): string | null {
  if (issue.description) {
    // 첫 섹션: 첫 번째 heading(## ...) 또는 빈 줄 2개 연속 전까지
    const firstSection = issue.description.split(/\n(?=#{1,6}\s)|\n{2,}/)[0].trim();
    if (firstSection.length >= 10) return firstSection;
  }
  if (issue.title.length >= 5) return issue.title;
  return null;
}

async function bindVerifiedIssue(
  pi: ExtensionAPI,
  ctx: ExtensionContext,
  options: { goal: string; issueKey: string; source: string; useIssueTitleAsGoal?: boolean },
): Promise<TaskResolution | null> {
  const { source } = options;
  const normalized = normalizeLinearIssueKey(options.issueKey);
  if (!normalized) return null;

  const token = findLinearToken(ctx.cwd);
  if (!token) {
    ctx.ui.notify(
      "Linear 토큰을 MCP 설정에서 찾지 못했습니다. 이슈 키와 작업 목표만 로컈로 연결합니다.",
      "warning",
    );
    const fallbackGoal = options.goal || normalized;
    const bound = bindIssue(pi, ctx, {
      goal: fallbackGoal,
      issue: null,
      issueKey: normalized,
      source,
    });
    if (bound) instructAgentToReadIssue(pi, { issueKey: bound.issueKey, goal: fallbackGoal });
    return bound;
  }

  const issue = await fetchLinearIssue(normalized, token, ctx.signal);
  if (!issue) {
    ctx.ui.notify(`Linear 이슈를 찾을 수 없거나 접근 권한이 없습니다: ${normalized}`, "error");
    return null;
  }

  let goal = options.goal.trim();
  if (!goal || options.useIssueTitleAsGoal) {
    const derived = deriveGoalFromIssue(issue);
    if (derived) {
      goal = derived;
    } else if (ctx.hasUI) {
      const input = await ctx.ui.input(
        `"${issue.title}" 이슈의 작업 목표를 입력하세요`,
        "작업 목표",
      );
      if (!input?.trim()) return null;
      goal = input.trim();
    } else {
      goal = issue.title;
    }
  }

  const bound = bindIssue(pi, ctx, { goal, issue, issueKey: issue.identifier, source });
  await createLinearComment(issue.id, buildLinearTaskComment(goal, "start"), token, ctx.signal);
  ctx.ui.notify(`Linear 이슈 연결됨: ${issue.identifier} — ${issue.title}\n목표: ${goal}`, "info");
  await setupWorktreeForIssue(pi, ctx, issue.identifier);
  if (bound) instructAgentToReadIssue(pi, { issueKey: issue.identifier, goal, url: issue.url });
  return bound;
}

async function createAndBindIssue(
  pi: ExtensionAPI,
  ctx: ExtensionContext,
  options: { goal: string; source: string; teamKey: string },
): Promise<TaskResolution | null> {
  const { source, teamKey } = options;
  const cleanGoal = options.goal.trim();
  if (!cleanGoal) return null;

  const token = findLinearToken(ctx.cwd);
  if (!token) {
    ctx.ui.notify("Linear 토큰을 MCP 설정에서 찾지 못해 새 이슈를 만들 수 없습니다.", "error");
    return null;
  }

  const issue = await createLinearIssue(cleanGoal, token, {
    description: `Created from Pi linear-task-gate.\n\nGoal: ${cleanGoal}`,
    signal: ctx.signal,
    teamKey,
  });
  if (!issue) {
    ctx.ui.notify(`Linear 이슈 생성에 실패했습니다. 팀 키: ${teamKey}`, "error");
    return null;
  }

  const bound = bindIssue(pi, ctx, {
    goal: cleanGoal,
    issue,
    issueKey: issue.identifier,
    source,
  });
  await createLinearComment(
    issue.id,
    buildLinearTaskComment(cleanGoal, "start"),
    token,
    ctx.signal,
  );
  ctx.ui.notify(`Linear 이슈 생성 및 연결됨: ${issue.identifier} — ${issue.title}`, "info");
  await setupWorktreeForIssue(pi, ctx, issue.identifier);
  return bound;
}

async function completeTask(
  ctx: ExtensionContext,
  issueKey: string,
  goal: string | undefined,
  summary: string,
): Promise<boolean> {
  const token = findLinearToken(ctx.cwd);
  if (!token) {
    ctx.ui.notify("Linear 토큰을 MCP 설정에서 찾지 못해 완료 코멘트를 남길 수 없습니다.", "error");
    return false;
  }
  const issue = await fetchLinearIssue(issueKey, token, ctx.signal);
  if (!issue) {
    ctx.ui.notify(`Linear 이슈를 찾을 수 없습니다: ${issueKey}`, "error");
    return false;
  }
  await createLinearComment(
    issue.id,
    buildLinearTaskComment(goal ?? issue.title, "done", summary),
    token,
    ctx.signal,
  );
  ctx.ui.notify(`Linear 완료 코멘트 작성됨: ${issue.identifier}`, "info");
  return true;
}

function blockReason(reason: string | undefined): string {
  return [
    "이 작업은 파일을 변경합니다.",
    reason ? `감지된 변경 시도: ${reason}` : undefined,
    "먼저 Linear 이슈와 작업 목표를 연결하거나, 기타 작업으로 진행해주세요.",
    "기존 이슈 예: /task FLO-1 작업 목표",
    "새 이슈 예: /task new FLE 엔진 작업 목표 / FLT 플랫폼 / FLP 랜딩",
    "기타 작업 예: /task other 환경 설정 작업",
    "Linear 토큰이 없으면 새 이슈 생성은 불가하지만, 기존 이슈/기타 작업은 진행됩니다.",
    "연결 후 같은 요청을 다시 보내면 작업을 계속합니다.",
  ]
    .filter(Boolean)
    .join("\n");
}

function handleTaskCommand(
  pi: ExtensionAPI,
  ctx: ExtensionContext,
  raw: string,
): Promise<TaskResolution | null> | undefined {
  const otherMatch = raw.match(/^(?:other|etc|기타)\s+(.+)$/i);
  if (otherMatch) return Promise.resolve(bindOtherWork(pi, ctx, otherMatch[1], "command-other"));

  const parsed = parseTaskCommandArgs(raw);
  if (parsed.mode === "create" && parsed.goal) {
    return createAndBindIssue(pi, ctx, {
      goal: parsed.goal,
      source: "command-create",
      teamKey: parsed.teamKey,
    });
  }
  if (parsed.mode === "bind" && parsed.issueKey) {
    const goal = "goal" in parsed && parsed.goal ? parsed.goal : "";
    return bindVerifiedIssue(pi, ctx, {
      goal,
      issueKey: parsed.issueKey,
      source: "command",
      useIssueTitleAsGoal: !goal,
    });
  }
  ctx.ui.notify(
    "Linear 이슈 키 형식이 아닙니다. 예: FLO-1 작업 목표 또는 /task new 작업 목표",
    "error",
  );
  return undefined;
}

function showCurrentBinding(ctx: ExtensionContext, binding: TaskResolution | null) {
  if (!binding) {
    ctx.ui.notify("연결된 Linear 이슈/프로젝트가 없습니다.", "info");
    return;
  }
  let head: string;
  if (binding.noLinear) head = "현재 작업: 기타 작업(Linear 없음)";
  else if (binding.project)
    head = `현재 연결된 Linear 프로젝트: ${binding.project.name}${binding.project.url ? `\n${binding.project.url}` : ""}`;
  else head = `현재 연결된 Linear 이슈: ${binding.issueKey}`;
  ctx.ui.notify(`${head}\n목표: ${binding.goal}`, "info");
}

async function handleDoneCommand(
  pi: ExtensionAPI,
  ctx: ExtensionContext,
  binding: TaskResolution | null,
  summary: string,
): Promise<boolean> {
  if (!binding) {
    ctx.ui.notify("완료 처리할 Linear 이슈가 연결되어 있지 않습니다.", "error");
    return false;
  }
  const ok = await completeTask(ctx, binding.issueKey, binding.goal, summary);
  if (ok) clearIssue(pi, ctx);
  return ok;
}

function registerTaskCommand(
  pi: ExtensionAPI,
  getBinding: () => TaskResolution | null,
  setBinding: (binding: TaskResolution | null) => void,
) {
  pi.registerCommand("task", {
    description:
      "Bind/show/clear/create Linear task (usage: /task FLO-1 goal | /task new goal | /task done summary)",
    handler: async (args, ctx) => {
      const raw = args.trim();
      if (!raw) return showCurrentBinding(ctx, getBinding());

      if (raw.startsWith("done ")) {
        if (await handleDoneCommand(pi, ctx, getBinding(), raw.slice(5).trim())) setBinding(null);
        return;
      }

      if (raw === "clear" || raw === "none" || raw === "reset") {
        setBinding(null);
        clearIssue(pi, ctx);
        ctx.ui.notify("Linear 이슈 연결을 해제했습니다.", "info");
        return;
      }

      const nextBinding = await handleTaskCommand(pi, ctx, raw);
      if (nextBinding) setBinding(nextBinding);
    },
  });
}

function promptForIssueOrGoal(
  pi: ExtensionAPI,
  ctx: ExtensionContext,
  input: string | undefined,
): Promise<TaskResolution | null> {
  const parsed = parseTaskCommandArgs(input ?? "");
  if (parsed.mode === "bind" && parsed.issueKey) {
    const goal = "goal" in parsed && parsed.goal ? parsed.goal : undefined;
    return bindVerifiedIssue(pi, ctx, {
      goal: goal ?? "",
      issueKey: parsed.issueKey,
      source: "first-mutation-gate",
      useIssueTitleAsGoal: !goal,
    });
  }
  if (parsed.mode === "create" && parsed.goal) {
    return createAndBindIssue(pi, ctx, {
      goal: parsed.goal,
      source: "first-mutation-create",
      teamKey: parsed.teamKey,
    });
  }
  if (input?.trim()) {
    ctx.ui.notify(
      "입력 형식을 확인해주세요. 기존 이슈: FLO-1 작업 목표 / 새 이슈: new FLT 작업 목표",
      "error",
    );
  }
  return null;
}

async function promptExistingIssueFromUi(
  pi: ExtensionAPI,
  ctx: ExtensionContext,
): Promise<TaskResolution | null> {
  const input = await ctx.ui.input("기존 Linear 이슈와 작업 목표 입력", "FLO-1 작업 목표");
  return promptForIssueOrGoal(pi, ctx, input);
}

function bindProject(
  pi: ExtensionAPI,
  ctx: ExtensionContext,
  project: { id: string; name: string; url?: string },
  goal: string,
  source: string,
): TaskResolution {
  const cleanGoal = goal.trim() || `프로젝트: ${project.name}`;
  pi.appendEntry(BIND_ENTRY_TYPE, {
    goal: cleanGoal,
    issueKey: PROJECT_KEY,
    project,
    source,
    timestamp: Date.now(),
  });
  ctx.ui.setStatus(STATUS_KEY, `Linear 프로젝트: ${project.name}`);
  ctx.ui.notify(
    `Linear 프로젝트 연결됨: ${project.name}${project.url ? `\n${project.url}` : ""}\n목표: ${cleanGoal}`,
    "info",
  );
  instructAgentToReadProject(pi, { project, goal: cleanGoal });
  return { goal: cleanGoal, issueKey: PROJECT_KEY, project };
}

async function promptProjectFromUi(
  pi: ExtensionAPI,
  ctx: ExtensionContext,
): Promise<TaskResolution | null | undefined> {
  const raw = await ctx.ui.input(
    "Linear 프로젝트 URL 또는 ID",
    "https://linear.app/<org>/project/<slug>-<id>/overview",
  );
  if (raw === undefined) return undefined;
  const projectId = parseLinearProjectId(raw ?? "");
  if (!projectId) {
    ctx.ui.notify("올바른 Linear 프로젝트 URL/ID가 아닙니다.", "error");
    return null;
  }

  let fetched: Awaited<ReturnType<typeof fetchProjectById>> | null = null;
  try {
    fetched = await fetchProjectById(createLinearMcpRunner(pi, ctx), projectId);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    ctx.ui.notify(`Linear MCP로 프로젝트 정보를 읽지 못했습니다: ${message}`, "error");
    return null;
  }
  if (!fetched) {
    ctx.ui.notify(`Linear 프로젝트를 찾을 수 없습니다: ${projectId}`, "error");
    return null;
  }

  const goal = await ctx.ui.input(
    `프로젝트 "${fetched.name}"에서 진행할 작업 목표 (비워두면 구현 전체)`,
    "예: 온보딩 UI 구현",
  );
  if (goal === undefined) return undefined;

  const binding = bindProject(
    pi,
    ctx,
    { id: fetched.id, name: fetched.name, url: fetched.url },
    goal ?? "",
    "session-start-project",
  );
  await setupWorktreeForIssue(pi, ctx, `project-${slugifyBranchName(fetched.name)}`);
  return binding;
}

async function resolveIssueFromUi(
  pi: ExtensionAPI,
  ctx: ExtensionContext,
): Promise<TaskResolution | null | undefined> {
  for (let attempt = 0; attempt < 3; attempt++) {
    const mode = await ctx.ui.select("작업 연결 방식", [
      "Linear 이슈 입력",
      "Linear 프로젝트 연결",
      "별도 작업",
    ]);
    if (!mode) return undefined;

    if (mode === "별도 작업") {
      return bindOtherWork(pi, ctx, "", "session-start-other");
    }

    if (mode === "Linear 프로젝트 연결") {
      const binding = await promptProjectFromUi(pi, ctx);
      if (binding === undefined) return undefined;
      if (binding) return binding;
      continue;
    }

    const binding = await promptExistingIssueFromUi(pi, ctx);
    if (binding === undefined) return undefined;
    if (binding) return binding;
  }
  return null;
}

function shouldBypassGateForExtensionBootstrap(event: {
  input?: Record<string, unknown>;
}): boolean {
  const candidate = String(event.input?.path ?? event.input?.filePath ?? "");
  return candidate.startsWith(".pi/extensions/") || candidate.includes("/.pi/extensions/");
}

async function bindBranchIssue(
  pi: ExtensionAPI,
  ctx: ExtensionContext,
  branchKey: string,
): Promise<TaskResolution | null | undefined> {
  if (!ctx.hasUI) return undefined;
  const goal = await ctx.ui.input(
    "branch에서 Linear 이슈를 찾았습니다. 작업 목표를 입력하세요",
    "작업 목표",
  );
  if (!goal?.trim()) return null;
  return bindVerifiedIssue(pi, ctx, { goal, issueKey: branchKey, source: "branch" });
}

export default function linearTaskGate(pi: ExtensionAPI) {
  let currentBinding: TaskResolution | null = null;

  const setBinding = (binding: TaskResolution | null) => {
    currentBinding = binding;
  };

  const restore = (ctx: ExtensionContext) => {
    const binding = findLatestBindingDetails(branchEntries(ctx));
    setBinding(
      binding
        ? {
            goal: binding.goal ?? "",
            issueKey: binding.issueKey,
            noLinear: binding.issueKey === NO_LINEAR_KEY,
            project: binding.project ?? undefined,
          }
        : null,
    );
    let status = "Linear: unbound";
    if (currentBinding?.noLinear) {
      status = "Linear: 기타 작업";
    } else if (currentBinding?.project) {
      status = `Linear 프로젝트: ${currentBinding.project.name}`;
    } else if (currentBinding) {
      status = `Linear: ${currentBinding.issueKey}`;
    }
    ctx.ui.setStatus(STATUS_KEY, status);
  };

  const promptOnBoot = async (ctx: ExtensionContext) => {
    if (currentBinding) return;
    if (!ctx.hasUI) return;

    const branchKey = await inferIssueFromBranch(pi, ctx);
    if (branchKey) {
      setBinding(await bindBranchIssue(pi, ctx, branchKey));
      if (currentBinding) return;
    }

    setBinding(await resolveIssueFromUi(pi, ctx));
  };

  const bindingSummaryMatch = (
    binding: TaskResolution,
  ): { kind: "issue" | "project"; key: string } | null => {
    if (binding.noLinear) return null;
    if (binding.project) return { kind: "project", key: binding.project.id };
    return { kind: "issue", key: binding.issueKey };
  };

  const getSummary = (ctx: ExtensionContext) => {
    if (!currentBinding) return null;
    const match = bindingSummaryMatch(currentBinding);
    if (!match) return null;
    return findLatestSummary(branchEntries(ctx), match);
  };

  const buildUnreadBlockReason = (binding: TaskResolution): string => {
    if (binding.project) {
      return [
        `Linear 프로젝트 "${binding.project.name}"가 연결되었지만 아직 읽은 내용이 기록되지 않았습니다.`,
        "다음 순서로 진행하세요:",
        `1. linear MCP 도구로 프로젝트(${binding.project.id})·milestones·속한 이슈를 조회`,
        '2. 읽은 내용을 record_linear_context_summary({kind:"project", key, summary}) 로 한번 기록',
        "3. 그 다음에 수정/구현 작업 시작",
      ].join("\n");
    }
    return [
      `Linear 이슈 "${binding.issueKey}"가 연결되었지만 아직 읽은 내용이 기록되지 않았습니다.`,
      "다음 순서로 진행하세요:",
      `1. linear MCP 도구로 이슈(${binding.issueKey}) description·state·코멘트를 조회`,
      '2. 읽은 내용을 record_linear_context_summary({kind:"issue", key, summary}) 로 한번 기록',
      "3. 그 다음에 수정/구현 작업 시작",
    ].join("\n");
  };

  const buildContextPreamble = (summary: {
    kind: string;
    key: string;
    summary: string;
  }): string => {
    const heading =
      summary.kind === "project"
        ? `## Linear 프로젝트 요약 (${summary.key})`
        : `## Linear 이슈 요약 (${summary.key})`;
    return `${heading}\n\n${summary.summary}\n\n(이 요약은 세션 시작 시 적재된 Linear 자료입니다. 작업 중 항상 참고하세요.)`;
  };

  pi.registerTool({
    name: "record_linear_context_summary",
    label: "Linear 이슈/프로젝트 요약 기록",
    description:
      "linear MCP로 읽은 이슈 또는 프로젝트의 요약을 세션에 영속 저장한다. 이슈/프로젝트 읽기 직후 반드시 1회 호출해야 하며, 이 호출 전에는 이름변경·파일 수정 등의 mutating 도구가 차단된다. summary는 한국어 5~15줄, 목적·범위·주요 세부사항·제약·관련 이슈를 포함한다.",
    promptSnippet:
      "record_linear_context_summary: linear MCP로 읽은 이슈/프로젝트 요약을 세션에 기록 (읽기 직후 필수 1회).",
    parameters: Type.Object({
      kind: Type.Union([Type.Literal("issue"), Type.Literal("project")], {
        description: "이슈는 'issue', Linear 프로젝트는 'project'",
      }),
      key: Type.String({
        description: "이슈면 FLT-123 형식, 프로젝트면 Linear project id(세션에 연결된 값)",
      }),
      summary: Type.String({
        description: "한국어 요약. 목적, 범위, 주요 세부사항, 제약, 관련 이슈·milestone.",
      }),
    }),
    execute: (_id, params, _signal, _update, ctx) => {
      pi.appendEntry(SUMMARY_ENTRY_TYPE, {
        kind: params.kind,
        key: params.key,
        summary: params.summary,
        recordedAt: Date.now(),
      });
      ctx.ui.notify(`Linear ${params.kind} 요약 기록됨: ${params.key}`, "info");
      return Promise.resolve({
        content: [
          {
            type: "text",
            text: `요약 기록 완료. 이후 턴마다 이 요약이 컨텍스트에 자동 주입되며, 수정/구현 작업이 허용됩니다.`,
          },
        ],
        isError: false,
      });
    },
  });

  pi.on("session_start", async (_event, ctx) => {
    restore(ctx);
    await promptOnBoot(ctx);
  });
  pi.on("session_tree", (_event, ctx) => restore(ctx));
  registerTaskCommand(pi, () => currentBinding, setBinding);

  pi.on("before_agent_start", (_event, ctx) => {
    if (!currentBinding) return undefined;
    const summary = getSummary(ctx);
    if (!summary) return undefined;
    return {
      systemPrompt: `${ctx.getSystemPrompt()}\n\n${buildContextPreamble(summary)}`,
    };
  });

  pi.on("session_before_compact", (_event, _ctx) => {
    // Pi compaction preserves custom entries by default; this hook is a safety pin
    // for future compaction behaviors that may drop them. We do not cancel.
    return undefined;
  });

  let pendingPushToDevelop = false;
  let pendingProgressEvidence: string[] = [];

  function isPushToDevelop(event: { toolName: string; input?: Record<string, unknown> }): boolean {
    if (event.toolName !== "bash") return false;
    const command = String(event.input?.command ?? "");
    return /\bgit\s+push\b/.test(command) && /\bdevelop\b/.test(command);
  }

  function isGitPush(event: { toolName: string; input?: Record<string, unknown> }): boolean {
    if (event.toolName !== "bash") return false;
    return /\bgit\s+push\b/.test(String(event.input?.command ?? ""));
  }

  async function checkProtectedBranchPush(
    event: { toolName: string; input?: Record<string, unknown> },
    ctx: ExtensionContext,
  ): Promise<{ block: true; reason: string } | undefined> {
    const command = String(event.input?.command ?? "");
    // 명시적으로 main/master가 포함된 경우 (danger-gate와 중복이지만 여기서도 block)
    if (/\b(main|master)\b/.test(command)) {
      return {
        block: true,
        reason: "main/master 브랜치에 직접 push할 수 없습니다.\nPR/MR 워크플로우를 사용하세요.",
      };
    }
    // 브랜치명 없는 `git push` — 현재 브랜치 확인
    try {
      const result = await pi.exec("git", ["branch", "--show-current"], {
        cwd: ctx.cwd,
        signal: ctx.signal,
        timeout: 3000,
      });
      const branch = result.stdout.trim();
      if (/^(main|master)$/.test(branch)) {
        return {
          block: true,
          reason: `현재 브랜치(${branch})는 보호 브랜치입니다. 직접 push가 차단됩니다.\nPR/MR 워크플로우를 사용하세요.`,
        };
      }
    } catch {
      // 브랜치 확인 실패 시 통과
    }
    return undefined;
  }

  pi.on("turn_end", async (_event, ctx) => {
    const progressEvidence = pendingProgressEvidence;
    pendingProgressEvidence = [];

    if (!pendingPushToDevelop && progressEvidence.length > 0) {
      if (currentBinding && !currentBinding.noLinear && currentBinding.issueKey !== PROJECT_KEY) {
        const token = findLinearToken(ctx.cwd);
        if (token) {
          const issue = await fetchLinearIssue(currentBinding.issueKey, token, ctx.signal);
          if (issue) {
            await createLinearComment(
              issue.id,
              buildLinearProgressComment({
                evidence: progressEvidence,
                goal: currentBinding.goal || issue.title,
                issueTitle: issue.title,
              }),
              token,
              ctx.signal,
            );
          }
        }
      }
    }

    if (!pendingPushToDevelop) return;
    pendingPushToDevelop = false;

    if (!currentBinding || currentBinding.noLinear || currentBinding.issueKey === PROJECT_KEY)
      return;

    const token = findLinearToken(ctx.cwd);
    if (!token) return;

    const issue = await fetchLinearIssue(currentBinding.issueKey, token, ctx.signal);
    if (!issue) return;

    const teamKey = currentBinding.issueKey.split("-")[0];
    const ok = await moveIssueToInReview(issue.id, teamKey, token, ctx.signal);
    if (ok) {
      ctx.ui.notify(`Linear 이슈 상태 변경: ${issue.identifier} → In Review`, "info");
    }

    clearIssue(pi, ctx);
    setBinding(null);
  });

  pi.on("tool_call", async (event, ctx) => {
    // Always allow our own summary-recording tool through, regardless of state.
    if (event.toolName === "record_linear_context_summary") return undefined;

    if (isGitPush(event)) {
      const blocked = await checkProtectedBranchPush(event, ctx);
      if (blocked) return blocked;
    }

    if (isPushToDevelop(event) && currentBinding) {
      pendingPushToDevelop = true;
      return undefined;
    }

    const classification = classifyToolCall(event);
    if (!classification.mutating) return undefined;
    if (shouldBypassGateForExtensionBootstrap(event)) return undefined;

    if (!currentBinding) {
      if (!ctx.hasUI) {
        return { block: true, reason: blockReason(classification.reason) };
      }
      setBinding(await resolveIssueFromUi(pi, ctx));
      if (!currentBinding) {
        return { block: true, reason: blockReason(classification.reason) };
      }
    }

    // Now we have a binding. Enforce "read before mutate" for issue/project bindings.
    const match = bindingSummaryMatch(currentBinding);
    if (match) {
      const summary = findLatestSummary(branchEntries(ctx), match);
      if (!summary) {
        return { block: true, reason: buildUnreadBlockReason(currentBinding) };
      }
    }

    if (!currentBinding.noLinear && currentBinding.issueKey !== PROJECT_KEY) {
      const evidence = summarizeMutatingToolCall(event);
      if (evidence && !pendingProgressEvidence.includes(evidence)) {
        pendingProgressEvidence.push(evidence);
      }
    }

    return undefined;
  });
}
