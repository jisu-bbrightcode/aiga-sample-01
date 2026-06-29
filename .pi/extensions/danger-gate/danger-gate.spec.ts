// @ts-nocheck
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import registerDangerGate, { gate, scanCommand } from "../danger-gate.ts";

function toolCall(command: string) {
  return { toolName: "bash", input: { command } };
}

function uiContext(confirmResult = true) {
  return {
    hasUI: true,
    ui: {
      confirm: async () => confirmResult,
      notify: () => undefined,
    },
  };
}

describe("danger-gate force-push hard block", () => {
  const forcePushCommands = [
    "git push --force",
    "git push -f",
    "git push --force-with-lease",
    "git push origin +branch",
    "git push origin +refs/heads/feature:refs/heads/feature",
  ];

  for (const command of forcePushCommands) {
    it(`classifies ${command} as a non-approvable force push`, () => {
      const hit = scanCommand(command);
      assert.equal(hit?.rule, "git-push-force-hard-block");
      assert.equal(hit?.hardBlock, true);
    });

    it(`hard-blocks ${command} even when UI approval would pass`, async () => {
      const result = await gate(toolCall(command), uiContext(true));
      assert.equal(result?.block, true);
      assert.match(result?.reason ?? "", /hard-block/i);
    });
  }

  it("does not let DANGER_GATE_AUTOAPPROVE bypass force-push", async () => {
    const previous = process.env.DANGER_GATE_AUTOAPPROVE;
    process.env.DANGER_GATE_AUTOAPPROVE = "1";
    try {
      const result = await gate(toolCall("git push --force"), uiContext(true));
      assert.equal(result?.block, true);
      assert.match(result?.reason ?? "", /git-push-force-hard-block/);
    } finally {
      if (previous === undefined) delete process.env.DANGER_GATE_AUTOAPPROVE;
      else process.env.DANGER_GATE_AUTOAPPROVE = previous;
    }
  });

  it("keeps other dangerous git commands on the approval gate", async () => {
    const approved = await gate(toolCall("git reset --hard HEAD"), uiContext(true));
    assert.equal(approved, undefined);

    const rejected = await gate(toolCall("git reset --hard HEAD"), uiContext(false));
    assert.equal(rejected?.block, true);
    assert.match(rejected?.reason ?? "", /사용자가 거부/);
  });

  it("registers the same hard block for direct user_bash events", async () => {
    type Handler = (
      event: unknown,
      ctx: unknown,
    ) => Promise<{ block: true; reason: string } | undefined>;
    const handlers = new Map<string, Handler>();
    registerDangerGate({ on: (name: string, handler: Handler) => handlers.set(name, handler) });

    const userBashHandler = handlers.get("user_bash");
    assert.equal(typeof userBashHandler, "function");

    const result = await userBashHandler?.(
      { command: "git push --force-with-lease" },
      uiContext(true),
    );
    assert.equal(result?.block, true);
    assert.match(result?.reason ?? "", /git-push-force-hard-block/);
  });
});
