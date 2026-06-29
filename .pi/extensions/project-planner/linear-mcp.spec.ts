// @ts-nocheck
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { registerPlanWithLinearMcp } from "./linear-mcp";
import { normalizePlan } from "./plan";
import { parseLinearProjectId } from "./project-id";

describe("project-planner linear MCP helpers", () => {
  it("returns plain ids unchanged", () => {
    assert.equal(parseLinearProjectId("38e52fc2c39c"), "38e52fc2c39c");
    assert.equal(parseLinearProjectId("  abc-def  "), "abc-def");
  });

  it("extracts and url-decodes slug-id from a Linear project URL", () => {
    const url =
      "https://linear.app/bbrightcode/project/feature-ai-%EC%BA%90%EB%A6%AD%ED%84%B0-%EC%B1%97-38e52fc2c39c/overview";
    assert.equal(parseLinearProjectId(url), "feature-ai-캐릭터-챗-38e52fc2c39c");
  });

  it("returns null for URLs without /project/ segment", () => {
    assert.equal(parseLinearProjectId("https://linear.app/bbrightcode/team/FLT"), null);
    assert.equal(parseLinearProjectId(""), null);
  });

  it("handles URL with query string after slug", () => {
    assert.equal(
      parseLinearProjectId("https://linear.app/org/project/some-slug-abcd1234?tab=overview"),
      "some-slug-abcd1234",
    );
  });

  it("creates issue relations after all issues are created and adds dependency graph to project description", async () => {
    const calls: Array<{ tool: string; args: Record<string, unknown> }> = [];
    const runMcp = (tool: string, args: Record<string, unknown>) => {
      calls.push({ tool, args });
      if (tool === "linear_list_teams") {
        return Promise.resolve([{ id: "team-1", key: "PB", name: "Product Builder" }]);
      }
      if (tool === "linear_save_project") {
        return Promise.resolve({ id: "project-1", name: args.name });
      }
      if (tool === "linear_save_milestone") {
        return Promise.resolve({ id: `ms-${args.name}`, name: args.name });
      }
      if (tool === "linear_save_issue") {
        if (args.id) return Promise.resolve({ ok: true });
        const title = String(args.title);
        const id = title.includes("DB") ? "issue-db" : "issue-api";
        const identifier = title.includes("DB") ? "FLT-1" : "FLT-2";
        return Promise.resolve({ id, identifier, title });
      }
      return Promise.reject(new Error(`unexpected tool ${tool}`));
    };
    const plan = normalizePlan({
      projectName: "Project",
      projectDescription: "Base",
      phases: [
        {
          name: "Phase",
          issues: [
            { key: "db", prefix: "feature", title: "DB" },
            { key: "api", prefix: "feature", title: "API", dependsOn: ["db"] },
          ],
        },
      ],
    });

    const result = await registerPlanWithLinearMcp(runMcp, plan, "FLT", null);

    const projectCall = calls.find((call) => call.tool === "linear_save_project");
    assert.match(String(projectCall?.args.description), /## Dependency graph/);
    assert.match(String(projectCall?.args.description), /\[feature\] DB → \[feature\] API/);

    const relationCall = calls.find(
      (call) => call.tool === "linear_save_issue" && call.args.id === "issue-api",
    );
    assert.deepEqual(relationCall?.args, {
      id: "issue-api",
      blockedBy: ["issue-db"],
    });
    assert.deepEqual(result.dependencies, [{ blockedBy: "FLT-1", blockedIssue: "FLT-2" }]);
  });
});
