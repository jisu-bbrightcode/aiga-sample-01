// @ts-nocheck
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { PROJECT_KEY, findLatestBinding, findLatestBindingDetails } from "./rules";

describe("linear-task-gate project binding", () => {
  it("restores Linear project bindings", () => {
    const entries = [
      {
        type: "custom",
        customType: "linear-task-gate:bind",
        data: {
          goal: "온보딩 UI",
          issueKey: PROJECT_KEY,
          project: {
            id: "feature-ai-캐릭터-챗-38e52fc2c39c",
            name: "AI 캐릭터 챗",
            url: "https://linear.app/x/project/feature-ai-...",
          },
        },
      },
    ];

    assert.equal(findLatestBinding(entries), PROJECT_KEY);
    assert.deepEqual(findLatestBindingDetails(entries), {
      goal: "온보딩 UI",
      issueKey: PROJECT_KEY,
      project: {
        id: "feature-ai-캐릭터-챗-38e52fc2c39c",
        name: "AI 캐릭터 챗",
        url: "https://linear.app/x/project/feature-ai-...",
      },
    });
  });

  it("clear entry resets a project binding", () => {
    const entries = [
      {
        type: "custom",
        customType: "linear-task-gate:bind",
        data: {
          goal: "x",
          issueKey: PROJECT_KEY,
          project: { id: "p1", name: "P1" },
        },
      },
      { type: "custom", customType: "linear-task-gate:clear", data: {} },
    ];
    assert.equal(findLatestBindingDetails(entries), null);
  });

  it("project binding takes precedence when newer than an issue binding", () => {
    const entries = [
      {
        type: "custom",
        customType: "linear-task-gate:bind",
        data: { goal: "old issue", issueKey: "FLT-1" },
      },
      {
        type: "custom",
        customType: "linear-task-gate:bind",
        data: {
          goal: "new project work",
          issueKey: PROJECT_KEY,
          project: { id: "p2", name: "P2" },
        },
      },
    ];
    const details = findLatestBindingDetails(entries);
    assert.equal(details?.issueKey, PROJECT_KEY);
    assert.equal(details?.project?.id, "p2");
  });

  it("malformed project binding without project payload falls back to null", () => {
    const entries = [
      {
        type: "custom",
        customType: "linear-task-gate:bind",
        data: { goal: "x", issueKey: PROJECT_KEY },
      },
    ];
    // issueKey is LINEAR-PROJECT but no project payload → not a valid Linear issue key either
    assert.equal(findLatestBindingDetails(entries), null);
  });
});
