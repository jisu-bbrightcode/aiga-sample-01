// @ts-nocheck
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  buildPlanInstructions,
  buildProjectDescriptionWithDependencyGraph,
  normalizePlan,
} from "./plan";

describe("project-planner plan helpers", () => {
  it("normalizes prefixes and strips existing [..] from titles, preserving order", () => {
    const plan = normalizePlan({
      projectName: "  Auth Module  ",
      projectDescription: "  설명  ",
      phases: [
        {
          name: "  DB schema  ",
          issues: [
            { prefix: "feat", title: "users 테이블 생성" },
            { prefix: "[chore]", title: "[chore] drizzle 마이그레이션 셋업" },
          ],
        },
        {
          name: "Login",
          issues: [{ prefix: "FEATURE", title: "JWT 발급", description: "  " }],
        },
      ],
    });

    assert.equal(plan.projectName, "Auth Module");
    assert.equal(plan.projectDescription, "설명");
    assert.equal(plan.phases.length, 2);
    assert.equal(plan.phases[0].name, "DB schema");
    assert.deepEqual(
      plan.phases[0].issues.map((i) => i.fullTitle),
      ["[feature] users 테이블 생성", "[chore] drizzle 마이그레이션 셋업"],
    );
    assert.equal(plan.phases[1].issues[0].fullTitle, "[feature] JWT 발급");
    assert.equal(plan.phases[1].issues[0].description, undefined);
  });

  it("maps known aliases to the canonical prefix set", () => {
    const plan = normalizePlan({
      projectName: "p",
      phases: [
        {
          name: "phase",
          issues: [
            { prefix: "bug", title: "x" },
            { prefix: "bugfix", title: "y" },
            { prefix: "hotfix", title: "z" },
            { prefix: "doc", title: "d" },
            { prefix: "tests", title: "t" },
          ],
        },
      ],
    });
    assert.deepEqual(
      plan.phases[0].issues.map((i) => i.prefix),
      ["fix", "fix", "fix", "docs", "test"],
    );
  });

  it("normalizes issue dependencies from issue fields and top-level declarations", () => {
    const plan = normalizePlan({
      projectName: "p",
      phases: [
        {
          name: "phase",
          issues: [
            { key: "db", prefix: "feature", title: "DB" },
            { key: "api", prefix: "feature", title: "API", dependsOn: ["db"] },
            { key: "ui", prefix: "feature", title: "UI", blockedBy: ["api"] },
          ],
        },
      ],
      dependencies: [{ issue: "db", blocks: ["UI"] }],
    });

    assert.deepEqual(plan.dependencies, [
      { blockedIssueKey: "api", blockingIssueKey: "db" },
      { blockedIssueKey: "ui", blockingIssueKey: "api" },
      { blockedIssueKey: "ui", blockingIssueKey: "db" },
    ]);
  });

  it("builds a dependency graph in the project description", () => {
    const plan = normalizePlan({
      projectName: "p",
      projectDescription: "base description",
      phases: [
        {
          name: "phase",
          issues: [
            { key: "db", prefix: "feature", title: "DB" },
            { key: "api", prefix: "feature", title: "API", dependsOn: ["db"] },
          ],
        },
      ],
    });

    const description = buildProjectDescriptionWithDependencyGraph(plan);

    assert.match(description, /base description/);
    assert.match(description, /## Dependency graph/);
    assert.match(description, /\[feature\] DB → \[feature\] API/);
  });

  it("rejects unknown dependency references", () => {
    assert.throws(() =>
      normalizePlan({
        projectName: "x",
        phases: [
          { name: "p", issues: [{ key: "a", prefix: "fix", title: "A", dependsOn: ["missing"] }] },
        ],
      }),
    );
  });

  it("rejects unknown prefixes and missing required fields", () => {
    assert.throws(() => normalizePlan({ projectName: "", phases: [] }));
    assert.throws(() => normalizePlan({ projectName: "x", phases: [] }));
    assert.throws(() =>
      normalizePlan({
        projectName: "x",
        phases: [{ name: "p", issues: [{ prefix: "wat", title: "y" }] }],
      }),
    );
    assert.throws(() =>
      normalizePlan({
        projectName: "x",
        phases: [{ name: "", issues: [{ prefix: "fix", title: "y" }] }],
      }),
    );
    assert.throws(() =>
      normalizePlan({
        projectName: "x",
        phases: [{ name: "p", issues: [{ prefix: "fix", title: "" }] }],
      }),
    );
  });

  it("buildPlanInstructions: new-project mode contains rules and team key", () => {
    const out = buildPlanInstructions({ teamKey: "FLT", rawProject: "do stuff" });
    assert.match(out, /Linear 팀: FLT/);
    assert.match(out, /새 프로젝트 생성/);
    assert.match(out, /do stuff/);
    assert.match(out, /register_project_plan/);
    assert.match(out, /dependsOn\/blockedBy/);
  });

  it("buildPlanInstructions: append mode lists existing milestones and switches mode label", () => {
    const out = buildPlanInstructions({
      teamKey: "FLE",
      rawProject: "더 추가",
      existing: {
        id: "p1",
        name: "기존 프로젝트",
        url: "https://linear.app/x/project/p1",
        milestones: [
          { id: "m1", name: "Phase 1" },
          { id: "m2", name: "Phase 2" },
        ],
      },
    });
    assert.match(out, /이어붙이기/);
    assert.match(out, /기존 프로젝트/);
    assert.match(out, /Phase 1/);
    assert.match(out, /Phase 2/);
    assert.match(out, /추가할 phase·issue만/);
  });
});
