// @ts-nocheck
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { parseProjectCommandArgs } from "./command";

describe("project-planner command args", () => {
  it("defaults to FLT and no existing project", () => {
    assert.deepEqual(parseProjectCommandArgs(""), {
      teamKey: "FLT",
      existingProjectId: null,
    });
  });

  it("accepts a team key alone", () => {
    assert.deepEqual(parseProjectCommandArgs("FLE"), {
      teamKey: "FLE",
      existingProjectId: null,
    });
    assert.deepEqual(parseProjectCommandArgs("flp"), {
      teamKey: "FLP",
      existingProjectId: null,
    });
  });

  it("accepts a Linear project URL alone (team defaults to FLT)", () => {
    const args = parseProjectCommandArgs(
      "https://linear.app/bbrightcode/project/feature-ai-%EC%BA%90%EB%A6%AD%ED%84%B0-%EC%B1%97-38e52fc2c39c/overview",
    );
    assert.equal(args.teamKey, "FLT");
    assert.equal(args.existingProjectId, "feature-ai-캐릭터-챗-38e52fc2c39c");
  });

  it("accepts team key + URL in any order", () => {
    const a = parseProjectCommandArgs("FLE https://linear.app/x/project/foo-abcd1234/overview");
    assert.equal(a.teamKey, "FLE");
    assert.equal(a.existingProjectId, "foo-abcd1234");

    const b = parseProjectCommandArgs("https://linear.app/x/project/foo-abcd1234/overview FLE");
    assert.equal(b.teamKey, "FLE");
    assert.equal(b.existingProjectId, "foo-abcd1234");
  });

  it("ignores unknown team keys, falls back to FLT", () => {
    assert.deepEqual(parseProjectCommandArgs("ZZZ"), {
      teamKey: "FLT",
      // "ZZZ" doesn't look like a Linear URL → parseLinearProjectId returns "ZZZ" since it has no /.
      // That's accepted as a raw id by Linear; this is intentional (user passed an opaque id).
      existingProjectId: "ZZZ",
    });
  });
});
