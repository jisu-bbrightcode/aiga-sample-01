// @ts-nocheck
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  classifyToolCall,
  extractLinearIssueKey,
  findLatestBinding,
  findLatestBindingDetails,
  normalizeLinearIssueKey,
  parseTaskCommandArgs,
  summarizeMutatingToolCall,
} from "./rules";

describe("linear-task-gate rules", () => {
  it("normalizes Linear issue keys from command args, branches, and prose", () => {
    assert.equal(normalizeLinearIssueKey("flt-123"), "FLT-123");
    assert.equal(extractLinearIssueKey("claude-sonnet/feat/flt-123-editor"), "FLT-123");
    assert.equal(extractLinearIssueKey("Work on QA-9 and then report"), "QA-9");
  });

  it("rejects missing or malformed Linear issue keys", () => {
    assert.equal(normalizeLinearIssueKey(""), null);
    assert.equal(normalizeLinearIssueKey("feature-branch"), null);
    assert.equal(extractLinearIssueKey("no issue here"), null);
  });

  it("treats edit/write as definite mutation attempts", () => {
    assert.deepEqual(classifyToolCall({ toolName: "edit", input: { path: "src/a.ts" } }), {
      mutating: true,
      reason: "edit tool modifies files",
      strength: "definite",
    });
    assert.deepEqual(classifyToolCall({ toolName: "write", input: { path: "src/a.ts" } }), {
      mutating: true,
      reason: "write tool modifies files",
      strength: "definite",
    });
  });

  it("summarizes mutating tool calls for progress comments", () => {
    assert.equal(
      summarizeMutatingToolCall({ toolName: "edit", input: { path: "src/a.ts" } }),
      "edit src/a.ts",
    );
    assert.equal(
      summarizeMutatingToolCall({
        toolName: "bash",
        input: { command: "pnpm --filter app test -- --runInBand" },
      }),
      "bash pnpm --filter app test --...",
    );
  });

  it("classifies bash commands by mutation risk", () => {
    assert.equal(
      classifyToolCall({ toolName: "bash", input: { command: "rg TODO src" } }).mutating,
      false,
    );
    assert.equal(
      classifyToolCall({ toolName: "bash", input: { command: "git diff --stat" } }).mutating,
      false,
    );
    assert.deepEqual(
      classifyToolCall({
        toolName: "bash",
        input: { command: "git checkout -b claude-sonnet/feat/FLT-123" },
      }),
      {
        mutating: true,
        reason: "bash command can change repository state: git checkout -b",
        strength: "definite",
      },
    );
    assert.deepEqual(classifyToolCall({ toolName: "bash", input: { command: "pnpm test" } }), {
      mutating: true,
      reason: "bash command may run scripts that change files: pnpm test",
      strength: "possible",
    });
  });

  it("requires a work goal when binding or creating a task", () => {
    assert.deepEqual(parseTaskCommandArgs("FLO-1 정리 작업 목표"), {
      issueKey: "FLO-1",
      goal: "정리 작업 목표",
      mode: "bind",
    });
    assert.deepEqual(parseTaskCommandArgs("new 릴리즈 노트 정리"), {
      goal: "릴리즈 노트 정리",
      mode: "create",
      teamKey: "FLT",
    });
    assert.deepEqual(parseTaskCommandArgs("new FLE 엔진 렌더링 개선"), {
      goal: "엔진 렌더링 개선",
      mode: "create",
      teamKey: "FLE",
    });
    assert.deepEqual(parseTaskCommandArgs("new FLP 랜딩 CTA 개선"), {
      goal: "랜딩 CTA 개선",
      mode: "create",
      teamKey: "FLP",
    });
    assert.deepEqual(parseTaskCommandArgs("FLO-1"), {
      error: "missing-goal",
      issueKey: "FLO-1",
      mode: "bind",
    });
    assert.deepEqual(parseTaskCommandArgs("new"), {
      error: "missing-goal",
      mode: "create",
    });
  });

  it("restores the latest binding details from custom session entries", () => {
    const entries = [
      {
        type: "custom",
        customType: "linear-task-gate:bind",
        data: { goal: "old", issueKey: "FLT-101" },
      },
      { type: "custom", customType: "linear-task-gate:clear", data: {} },
      {
        type: "custom",
        customType: "linear-task-gate:bind",
        data: { goal: "목표", issueKey: "qa-9" },
      },
    ];

    assert.equal(findLatestBinding(entries), "QA-9");
    assert.deepEqual(findLatestBindingDetails(entries), { goal: "목표", issueKey: "QA-9" });
  });

  it("restores no-Linear other work bindings", () => {
    const entries = [
      {
        type: "custom",
        customType: "linear-task-gate:bind",
        data: { goal: "환경 설정", issueKey: "NO-LINEAR", noLinear: true },
      },
    ];

    assert.equal(findLatestBinding(entries), "NO-LINEAR");
    assert.deepEqual(findLatestBindingDetails(entries), {
      goal: "환경 설정",
      issueKey: "NO-LINEAR",
    });
  });
});
