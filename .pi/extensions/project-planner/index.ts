// @ts-nocheck
/**
 * project-planner
 *
 * Larger-mission entry point for Pi sessions.
 *
 * Flow:
 *   1. User runs `/project [TEAM_KEY]` and pastes the project description
 *      into the UI input.
 *   2. The extension injects a planning prompt into the agent via
 *      `pi.sendUserMessage`, instructing the LLM to design phases + issues
 *      and call `register_project_plan` once.
 *   3. When the LLM calls the tool, the extension creates a Linear Project,
 *      one Milestone per phase (in order), and issues attached to each
 *      milestone (also in order). Issue titles get a `[feature|fix|...]`
 *      git-flow style prefix.
 *
 * Usage:
 *   /project                                팀 키 FLT, 새 프로젝트 생성
 *   /project FLE                            팀 키 FLE 로 새 프로젝트 생성
 *   /project <linear-project-url|id>        기존 프로젝트에 phase/issue만 추가
 *   /project FLE <linear-project-url|id>    팀 키 명시 + 기존 프로젝트 이어붙이기
 */

import type { ExtensionAPI, ExtensionContext } from "@earendil-works/pi-coding-agent";
import { Type } from "typebox";
import { findLatestBindingDetails, PROJECT_KEY } from "../linear-task-gate/rules";
import { parseProjectCommandArgs } from "./command";
import {
  createLinearMcpRunner,
  fetchProjectById,
  type RegistrationResult,
  registerPlanWithLinearMcp,
} from "./linear-mcp";
import {
  buildPlanInstructions,
  ISSUE_PREFIXES,
  type NormalizedPlan,
  normalizePlan,
  type PlanInput,
} from "./plan";

const STATUS_KEY = "project-planner";
const DEFAULT_TEAM_KEY = "FLT";
const TEAM_KEYS = ["FLT", "FLE", "FLP"] as const;
const ALLOWED_TEAMS = new Set<string>(TEAM_KEYS);

export { parseProjectCommandArgs };

function StringEnum<T extends readonly string[]>(
  values: T,
  options?: { description?: string; default?: T[number] },
) {
  return Type.Unsafe<T[number]>({
    type: "string",
    enum: values as unknown as string[],
    ...(options?.description ? { description: options.description } : {}),
    ...(options?.default ? { default: options.default } : {}),
  });
}

async function promptProjectDescription(ctx: ExtensionContext): Promise<string | null> {
  if (!ctx.hasUI) {
    ctx.ui.notify("UI가 없는 모드에서는 /project를 사용할 수 없습니다.", "error");
    return null;
  }
  const input = await ctx.ui.input(
    "프로젝트 설명을 입력하세요 (Markdown 가능)",
    "예: 사용자 인증 모듈 전체 구현 (회원가입, 로그인, 비밀번호 재설정 ...)",
  );
  const trimmed = input?.trim();
  if (!trimmed) {
    ctx.ui.notify("프로젝트 설명이 비어있어 취소했습니다.", "info");
    return null;
  }
  return trimmed;
}

async function registerPlan(
  pi: ExtensionAPI,
  ctx: ExtensionContext,
  plan: NormalizedPlan,
  teamKey: string,
  existingProjectId: string | null,
): Promise<RegistrationResult> {
  return await registerPlanWithLinearMcp(
    createLinearMcpRunner(pi, ctx),
    plan,
    teamKey,
    existingProjectId,
  );
}

function formatRegistrationSummary(result: RegistrationResult, teamKey: string): string {
  const lines: string[] = [];
  const action = result.appended ? "기존 프로젝트에 추가됨" : "프로젝트 생성됨";
  lines.push(`Linear ${action} (${teamKey}): ${result.project.name}`);
  if (result.project.url) lines.push(result.project.url);
  for (const m of result.milestones) {
    lines.push("");
    lines.push(`▸ ${m.name}${m.reused ? " (기존 milestone 재사용)" : ""}`);
    for (const issue of m.issues) {
      lines.push(`  - ${issue.identifier} ${issue.title}`);
    }
  }
  if (result.dependencies.length > 0) {
    lines.push("", "Dependencies:");
    for (const dep of result.dependencies) {
      lines.push(`  - ${dep.blockedBy} blocks ${dep.blockedIssue}`);
    }
  }
  return lines.join("\n");
}

function textContent(text: string) {
  return [{ type: "text" as const, text }];
}

export default function projectPlanner(pi: ExtensionAPI) {
  let pendingTeamKey: string | null = null;
  let pendingExistingProjectId: string | null = null;

  pi.registerCommand("project", {
    description:
      "프로젝트 설명을 받아 Linear에 phase(milestone)+이슈로 등록 (사용법: /project [TEAM] [linear-project-url|id])",
    handler: async (args, ctx) => {
      const parsed = parseProjectCommandArgs(args);
      const { teamKey } = parsed;
      let existingProjectId = parsed.existingProjectId;

      // Fallback to the project bound at session start (linear-task-gate)
      if (!existingProjectId) {
        const branch = ctx.sessionManager as {
          getBranch?: () => readonly unknown[];
          getEntries?: () => readonly unknown[];
        };
        const entries = branch.getBranch?.() ?? branch.getEntries?.() ?? [];
        const bound = findLatestBindingDetails(entries);
        if (bound?.issueKey === PROJECT_KEY && bound.project?.id) {
          existingProjectId = bound.project.id;
          ctx.ui.notify(`세션에 연결된 프로젝트를 사용합니다: ${bound.project.name}`, "info");
        }
      }

      const description = await promptProjectDescription(ctx);
      if (!description) return;

      let existing: Awaited<ReturnType<typeof fetchProjectById>> | null = null;
      let effectiveTeamKey = teamKey;
      if (existingProjectId) {
        try {
          existing = await fetchProjectById(createLinearMcpRunner(pi, ctx), existingProjectId);
        } catch (err) {
          const message = err instanceof Error ? err.message : String(err);
          ctx.ui.notify(`Linear MCP로 기존 프로젝트 정보를 읽지 못했습니다: ${message}`, "error");
          return;
        }
        if (!existing) {
          ctx.ui.notify(`Linear 프로젝트를 찾을 수 없습니다: ${existingProjectId}`, "error");
          return;
        }
        // If team key was not explicitly given, pick the first team attached to the project.
        if (!ALLOWED_TEAMS.has(teamKey) || teamKey === DEFAULT_TEAM_KEY) {
          const first = existing.teams?.[0];
          if (first?.key) effectiveTeamKey = first.key.toUpperCase();
        }
      }

      pendingTeamKey = effectiveTeamKey;
      pendingExistingProjectId = existingProjectId;
      ctx.ui.setStatus(
        STATUS_KEY,
        existing ? `Planning(append): ${existing.name}` : `Planning: ${effectiveTeamKey}`,
      );
      ctx.ui.notify(
        existing
          ? `기존 프로젝트에 추가합니다: ${existing.name}. LLM이 phase·이슈를 설계하고 register_project_plan을 호출합니다.`
          : `프로젝트 플랜을 작성합니다. 팀: ${effectiveTeamKey}. LLM이 분석 후 register_project_plan 도구로 등록합니다.`,
        "info",
      );

      pi.sendUserMessage(
        buildPlanInstructions({
          teamKey: effectiveTeamKey,
          rawProject: description,
          existing,
        }),
      );
    },
  });

  pi.registerTool({
    name: "register_project_plan",
    label: "Linear 프로젝트 플랜 등록",
    description:
      "프로젝트 설명을 분석한 결과(phases + issues)를 Linear에 등록한다. phases는 구현 순서, 각 phase는 ProjectMilestone, 각 issue는 milestone에 연결된다. issue prefix는 [" +
      ISSUE_PREFIXES.join("|") +
      "] 중 하나여야 한다. 이 도구는 한 번만 호출하고, 호출 전 사용자에게 자연어 요약을 먼저 보여줄 것.",
    promptSnippet:
      "register_project_plan: /project 명령으로 시작된 플래닝 세션에서 phases+issues 구조를 Linear에 등록.",
    parameters: Type.Object({
      teamKey: Type.Optional(
        StringEnum(TEAM_KEYS, {
          description: "대상 Linear 팀 키. 생략 시 /project 명령에서 지정된 값을 사용.",
        }),
      ),
      projectName: Type.String({ description: "Linear 프로젝트 이름 (간결한 한 줄)" }),
      projectDescription: Type.Optional(
        Type.String({ description: "프로젝트 설명/배경 (Markdown 가능)" }),
      ),
      phases: Type.Array(
        Type.Object({
          name: Type.String({ description: "Phase(=Linear Milestone) 이름" }),
          description: Type.Optional(Type.String()),
          issues: Type.Array(
            Type.Object({
              prefix: StringEnum(ISSUE_PREFIXES, {
                description: "git-flow 스타일 prefix",
              }),
              title: Type.String({
                description: "이슈 본문 제목 (prefix 제외). 등록 시 자동으로 [prefix]가 붙음",
              }),
              description: Type.Optional(Type.String()),
              key: Type.Optional(
                Type.String({
                  description: "의존성에서 참조할 로컬 issue key (예: api-auth, db-schema)",
                }),
              ),
              dependsOn: Type.Optional(
                Type.Array(Type.String(), {
                  description: "이 이슈를 blockedBy로 연결할 선행 issue key/title 목록",
                }),
              ),
              blockedBy: Type.Optional(
                Type.Array(Type.String(), {
                  description: "dependsOn과 동일: 이 이슈를 막는 선행 issue key/title 목록",
                }),
              ),
              blocks: Type.Optional(
                Type.Array(Type.String(), {
                  description: "이 이슈가 blocks로 연결할 후속 issue key/title 목록",
                }),
              ),
            }),
            { minItems: 1, description: "구현 순서대로 정렬된 이슈 목록" },
          ),
        }),
        { minItems: 1, description: "구현 순서대로 정렬된 phase 목록" },
      ),
      dependencies: Type.Optional(
        Type.Array(
          Type.Object({
            issue: Type.Optional(Type.String({ description: "관계의 기준 issue key/title" })),
            from: Type.Optional(Type.String({ description: "관계 시작 issue key/title" })),
            to: Type.Optional(Type.String({ description: "관계 대상 issue key/title" })),
            type: Type.Optional(
              StringEnum(["blockedBy", "blocks"] as const, {
                description: "from/to 사용 시 관계 방향",
              }),
            ),
            blockedBy: Type.Optional(Type.Array(Type.String())),
            blocks: Type.Optional(Type.Array(Type.String())),
          }),
          { description: "선택: issue 단위 의존성 선언. issue-level dependsOn/blocks와 병합됨" },
        ),
      ),
    }),
    async execute(_toolCallId, params, _signal, _onUpdate, ctx) {
      try {
        const teamKey = (params.teamKey ?? pendingTeamKey ?? DEFAULT_TEAM_KEY) as string;
        const plan = normalizePlan(params as PlanInput);
        const result = await registerPlan(pi, ctx, plan, teamKey, pendingExistingProjectId);
        const summary = formatRegistrationSummary(result, teamKey);
        pendingTeamKey = null;
        pendingExistingProjectId = null;
        ctx.ui.setStatus(STATUS_KEY, `Linear: ${result.project.name}`);
        ctx.ui.notify(
          result.appended
            ? `기존 프로젝트에 추가 완료: ${result.project.name}`
            : `프로젝트 등록 완료: ${result.project.name}`,
          "info",
        );
        return {
          content: textContent(summary),
          isError: false,
        };
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        ctx.ui.notify(`프로젝트 등록 실패: ${message}`, "error");
        return {
          content: textContent(`프로젝트 등록 실패: ${message}`),
          isError: true,
        };
      }
    },
  });
}
