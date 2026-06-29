// @ts-nocheck
/**
 * Plan schema and prefix validation for project-planner.
 *
 * The LLM is instructed to call the `register_project_plan` tool with a
 * structured plan. The shape is intentionally small and explicit so that
 * naming/order rules are enforced server-side (in the tool handler) rather
 * than implicit in the prompt.
 */

export const ISSUE_PREFIXES = ["feature", "fix", "refactor", "chore", "docs", "test"] as const;

export type IssuePrefix = (typeof ISSUE_PREFIXES)[number];

export interface PlanIssueInput {
  prefix: IssuePrefix | string;
  title: string;
  description?: string;
  /** Stable local reference used by dependency declarations. */
  key?: string;
  id?: string;
  ref?: string;
  /** This issue is blocked by these local issue references. */
  dependsOn?: string[];
  blockedBy?: string[];
  /** This issue blocks these local issue references. */
  blocks?: string[];
}

export interface PlanDependencyInput {
  issue?: string;
  from?: string;
  to?: string;
  type?: "blockedBy" | "blocks" | string;
  blockedBy?: string[];
  blocks?: string[];
}

export interface PlanPhaseInput {
  name: string;
  description?: string;
  issues: PlanIssueInput[];
}

export interface PlanInput {
  projectName: string;
  projectDescription?: string;
  phases: PlanPhaseInput[];
  dependencies?: PlanDependencyInput[];
}

export interface NormalizedIssue {
  prefix: IssuePrefix;
  title: string;
  description?: string;
  fullTitle: string;
  key: string;
  blockedBy: string[];
  blocks: string[];
}

export interface NormalizedDependency {
  blockedIssueKey: string;
  blockingIssueKey: string;
}

export interface NormalizedPhase {
  name: string;
  description?: string;
  issues: NormalizedIssue[];
}

export interface NormalizedPlan {
  projectName: string;
  projectDescription?: string;
  phases: NormalizedPhase[];
  dependencies: NormalizedDependency[];
}

const PREFIX_SET = new Set<string>(ISSUE_PREFIXES);

function normalizePrefix(raw: string): IssuePrefix {
  const cleaned = String(raw ?? "")
    .trim()
    .toLowerCase()
    .replace(/^\[|\]$/g, "");
  if (PREFIX_SET.has(cleaned)) return cleaned as IssuePrefix;
  // Map a few common aliases to the canonical set.
  if (cleaned === "feat") return "feature";
  if (cleaned === "bug" || cleaned === "bugfix" || cleaned === "hotfix") return "fix";
  if (cleaned === "doc") return "docs";
  if (cleaned === "tests") return "test";
  throw new Error(`Unknown issue prefix "${raw}". Allowed: ${ISSUE_PREFIXES.join(", ")}`);
}

function stripExistingPrefix(title: string): string {
  return title.replace(/^\s*\[[^\]]+\]\s*/, "").trim();
}

function normalizeRef(raw: unknown): string | null {
  const value = String(raw ?? "").trim();
  return value || null;
}

function refsFrom(raw: unknown): string[] {
  if (!Array.isArray(raw)) return [];
  return raw.map(normalizeRef).filter(Boolean) as string[];
}

function dependencyId(blockedIssueKey: string, blockingIssueKey: string): string {
  return `${blockedIssueKey}\u0000${blockingIssueKey}`;
}

export function normalizePlan(input: PlanInput): NormalizedPlan {
  if (!input || typeof input !== "object") {
    throw new Error("plan must be an object");
  }
  if (!input.projectName?.trim()) {
    throw new Error("plan.projectName is required");
  }
  if (!Array.isArray(input.phases) || input.phases.length === 0) {
    throw new Error("plan.phases must be a non-empty array");
  }

  const issueAliases = new Map<string, string | null>();
  const addAlias = (
    alias: string | null,
    key: string,
    label: string,
    opts: { requiredUnique?: boolean } = {},
  ) => {
    if (!alias) return;
    const normalized = alias.toLowerCase();
    const existing = issueAliases.get(normalized);
    if (existing && existing !== key) {
      if (opts.requiredUnique) {
        throw new Error(`Duplicate issue dependency reference "${alias}" (${label})`);
      }
      issueAliases.set(normalized, null);
      return;
    }
    if (existing === null && opts.requiredUnique) {
      throw new Error(`Duplicate issue dependency reference "${alias}" (${label})`);
    }
    issueAliases.set(normalized, key);
  };

  const phases: NormalizedPhase[] = input.phases.map((phase, phaseIdx) => {
    if (!phase?.name?.trim()) {
      throw new Error(`phases[${phaseIdx}].name is required`);
    }
    if (!Array.isArray(phase.issues) || phase.issues.length === 0) {
      throw new Error(`phases[${phaseIdx}].issues must be a non-empty array`);
    }

    const issues: NormalizedIssue[] = phase.issues.map((issue, issueIdx) => {
      if (!issue?.title?.trim()) {
        throw new Error(`phases[${phaseIdx}].issues[${issueIdx}].title is required`);
      }
      const prefix = normalizePrefix(issue.prefix);
      const bareTitle = stripExistingPrefix(issue.title);
      const explicitKey = normalizeRef(issue.key ?? issue.id ?? issue.ref);
      const key = explicitKey ?? `p${phaseIdx + 1}i${issueIdx + 1}`;
      const fullTitle = `[${prefix}] ${bareTitle}`;
      addAlias(key, key, `phases[${phaseIdx}].issues[${issueIdx}]`, { requiredUnique: true });
      addAlias(bareTitle, key, `phases[${phaseIdx}].issues[${issueIdx}].title`);
      addAlias(fullTitle, key, `phases[${phaseIdx}].issues[${issueIdx}].fullTitle`);
      return {
        prefix,
        title: bareTitle,
        description: issue.description?.trim() || undefined,
        fullTitle,
        key,
        blockedBy: [...refsFrom(issue.dependsOn), ...refsFrom(issue.blockedBy)],
        blocks: refsFrom(issue.blocks),
      };
    });

    return {
      name: phase.name.trim(),
      description: phase.description?.trim() || undefined,
      issues,
    };
  });

  const dependencies = new Map<string, NormalizedDependency>();
  const resolveRef = (raw: string, field: string): string => {
    const key = issueAliases.get(raw.trim().toLowerCase());
    if (key === undefined) {
      throw new Error(`Unknown issue dependency reference in ${field}: "${raw}"`);
    }
    if (key === null) {
      throw new Error(`Ambiguous issue dependency reference in ${field}: "${raw}"`);
    }
    return key;
  };
  const addDependency = (blockedRef: string, blockingRef: string, field: string) => {
    const blockedIssueKey = resolveRef(blockedRef, field);
    const blockingIssueKey = resolveRef(blockingRef, field);
    if (blockedIssueKey === blockingIssueKey) {
      throw new Error(`Issue cannot depend on itself: "${blockedRef}"`);
    }
    dependencies.set(dependencyId(blockedIssueKey, blockingIssueKey), {
      blockedIssueKey,
      blockingIssueKey,
    });
  };

  for (const phase of phases) {
    for (const issue of phase.issues) {
      for (const ref of issue.blockedBy) addDependency(issue.key, ref, `${issue.key}.blockedBy`);
      for (const ref of issue.blocks) addDependency(ref, issue.key, `${issue.key}.blocks`);
    }
  }

  for (const dep of input.dependencies ?? []) {
    const issueRef = normalizeRef(dep.issue ?? dep.from);
    for (const ref of refsFrom(dep.blockedBy)) {
      if (!issueRef) throw new Error("dependencies[].issue is required when blockedBy is used");
      addDependency(issueRef, ref, "dependencies[].blockedBy");
    }
    for (const ref of refsFrom(dep.blocks)) {
      if (!issueRef) throw new Error("dependencies[].issue is required when blocks is used");
      addDependency(ref, issueRef, "dependencies[].blocks");
    }
    if (dep.from && dep.to && dep.type) {
      if (String(dep.type) === "blockedBy")
        addDependency(dep.from, dep.to, "dependencies[].blockedBy");
      else if (String(dep.type) === "blocks")
        addDependency(dep.to, dep.from, "dependencies[].blocks");
      else throw new Error(`Unknown dependency type "${dep.type}". Allowed: blockedBy, blocks`);
    }
  }

  return {
    projectName: input.projectName.trim(),
    projectDescription: input.projectDescription?.trim() || undefined,
    phases,
    dependencies: [...dependencies.values()],
  };
}

export function buildProjectDescriptionWithDependencyGraph(plan: NormalizedPlan): string {
  const issueByKey = new Map<string, NormalizedIssue>();
  for (const phase of plan.phases) {
    for (const issue of phase.issues) issueByKey.set(issue.key, issue);
  }

  const lines = [plan.projectDescription?.trim()].filter(Boolean) as string[];
  lines.push("", "## Dependency graph");
  if (plan.dependencies.length === 0) {
    lines.push("- No issue dependencies declared.");
  } else {
    for (const dep of plan.dependencies) {
      const blocker = issueByKey.get(dep.blockingIssueKey);
      const blocked = issueByKey.get(dep.blockedIssueKey);
      lines.push(
        `- ${blocker?.fullTitle ?? dep.blockingIssueKey} → ${blocked?.fullTitle ?? dep.blockedIssueKey}`,
      );
    }
  }
  return lines.join("\n").trim();
}

export interface ExistingProjectContext {
  id: string;
  name: string;
  url?: string;
  milestones: Array<{ id: string; name: string; sortOrder?: number }>;
}

export function buildPlanInstructions(opts: {
  teamKey: string;
  rawProject: string;
  existing?: ExistingProjectContext | null;
}): string {
  const lines: string[] = ["# 프로젝트 플래닝 요청", "", `Linear 팀: ${opts.teamKey}`];

  if (opts.existing) {
    lines.push(
      "",
      "모드: 기존 프로젝트에 이어붙이기 (새 프로젝트를 만들지 않음)",
      `기존 프로젝트: ${opts.existing.name}${opts.existing.url ? ` (${opts.existing.url})` : ""}`,
    );
    if (opts.existing.milestones.length > 0) {
      lines.push("기존 milestones (이름이 같으면 재사용, 아니면 새로 생성됨):");
      for (const m of opts.existing.milestones) {
        lines.push(`  - ${m.name}`);
      }
    }
    lines.push(
      "",
      "도구 호출 시 projectName은 기존 이름을 그대로 쓰고, phases에는 **추가할 phase·issue만** 포함하세요.",
    );
  } else {
    lines.push("", "모드: 새 프로젝트 생성");
  }

  lines.push(
    "",
    "다음 프로젝트 설명을 읽고 상세한 구현 플랜을 작성한 뒤,",
    "`register_project_plan` 도구를 한 번 호출해서 Linear에 등록하세요.",
    "",
    "## 규칙",
    "- phases는 구현 순서대로 배치 (먼저 만들 것이 phases[0])",
    "- 각 phase는 Linear ProjectMilestone이 됨",
    "- phase 내 issues도 구현 순서대로 배치",
    "- issue prefix는 다음 중 하나: feature, fix, refactor, chore, docs, test",
    "- dependencyKey가 필요한 issue에는 key를 지정하고, 선행 작업은 dependsOn/blockedBy, 후속 작업은 blocks로 표현",
    "- 여러 phase를 가로지르는 의존성도 register_project_plan 입력에 포함 (Linear blockedBy/blocks 관계로 자동 등록됨)",
    "- 프로젝트 설명에는 도구가 dependency graph 섹션을 자동 추가함",
    "- 도구 호출 전 사용자에게 플랜 요약을 자연어로 제시할 것",
    "- 도구가 성공하면 추가 작업하지 말고 결과만 보고",
    "",
    "## 프로젝트 설명",
    "",
    opts.rawProject.trim(),
  );

  return lines.join("\n");
}
