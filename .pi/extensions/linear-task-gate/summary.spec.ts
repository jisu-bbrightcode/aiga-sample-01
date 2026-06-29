// @ts-nocheck
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { SUMMARY_ENTRY_TYPE, findLatestSummary } from "./rules";

describe("linear-task-gate findLatestSummary", () => {
  it("returns the latest summary matching kind+key", () => {
    const entries = [
      {
        type: "custom",
        customType: SUMMARY_ENTRY_TYPE,
        data: { kind: "issue", key: "FLT-1", summary: "old", recordedAt: 1 },
      },
      {
        type: "custom",
        customType: SUMMARY_ENTRY_TYPE,
        data: { kind: "issue", key: "FLT-1", summary: "new", recordedAt: 2 },
      },
    ];
    assert.equal(findLatestSummary(entries, { kind: "issue", key: "FLT-1" })?.summary, "new");
  });

  it("does not match on different kind or key", () => {
    const entries = [
      {
        type: "custom",
        customType: SUMMARY_ENTRY_TYPE,
        data: { kind: "issue", key: "FLT-1", summary: "s" },
      },
    ];
    assert.equal(findLatestSummary(entries, { kind: "issue", key: "FLT-2" }), null);
    assert.equal(findLatestSummary(entries, { kind: "project", key: "FLT-1" }), null);
  });

  it("ignores malformed entries without summary/key", () => {
    const entries = [
      {
        type: "custom",
        customType: SUMMARY_ENTRY_TYPE,
        data: { kind: "issue", key: "FLT-1" },
      },
      {
        type: "custom",
        customType: SUMMARY_ENTRY_TYPE,
        data: { summary: "x" },
      },
    ];
    assert.equal(findLatestSummary(entries, { kind: "issue", key: "FLT-1" }), null);
  });
});
