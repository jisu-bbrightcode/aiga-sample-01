// @ts-nocheck
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";

function read(path: string): string {
  return readFileSync(new URL(path, import.meta.url), "utf8");
}

describe("Linear project planning uses MCP, not direct API tokens", () => {
  it("project-planner entrypoint does not import direct Linear API helpers", () => {
    const source = read("./index.ts");

    assert.doesNotMatch(source, /from "\.\/linear-api"/);
    assert.doesNotMatch(source, /\bfindLinearToken\b/);
    assert.doesNotMatch(source, /Linear 토큰/);
  });

  it("linear-task-gate project binding does not require a Linear API token", () => {
    const source = read("../linear-task-gate/index.ts");
    const projectPromptStart = source.indexOf("async function promptProjectFromUi");
    const projectPromptEnd = source.indexOf("async function resolveIssueFromUi");
    assert.ok(projectPromptStart > 0, "expected promptProjectFromUi");
    assert.ok(
      projectPromptEnd > projectPromptStart,
      "expected resolveIssueFromUi after project prompt",
    );

    const projectPrompt = source.slice(projectPromptStart, projectPromptEnd);
    assert.doesNotMatch(projectPrompt, /\bfindLinearToken\b/);
    assert.doesNotMatch(projectPrompt, /Linear 토큰/);
    assert.doesNotMatch(source, /from "\.\.\/project-planner\/linear-api"/);
  });
});
