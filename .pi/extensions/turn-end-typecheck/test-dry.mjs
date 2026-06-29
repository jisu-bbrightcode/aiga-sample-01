#!/usr/bin/env node
/**
 * turn-end-typecheck dry run.
 *
 * Loads the extension and exercises its event handlers against a stub PI API,
 * verifying that:
 *   - mutating tool_call events flip the mutated flag
 *   - turn_end without mutation does nothing
 *   - turn_end after mutation invokes pi.exec with the configured command
 *   - failure path notifies + sendUserMessage with deliverAs=followUp
 *
 * This does NOT validate the real PI runtime wiring (event names, manager
 * shape). It only verifies our handler logic against the documented contract.
 */

import { strict as assert } from "node:assert";

const mod = await import("./index.ts").catch(async () => {
  // fall back to compiled .js if present (it isn't, but keep the path forgiving)
  return await import("./index.js");
});

const handlers = new Map();
const calls = { exec: [], notify: [], status: [], userMessages: [] };

const piStub = {
  on(event, handler) {
    handlers.set(event, handler);
  },
  registerCommand() {},
  appendEntry() {},
  exec: async (_cmd, _args, _opts) => {
    calls.exec.push({ cmd: _cmd, args: _args, opts: _opts });
    return (
      calls.exec[calls.exec.length - 1].response ?? {
        code: 0,
        stdout: "",
        stderr: "",
        killed: false,
      }
    );
  },
  sendUserMessage(content, options) {
    calls.userMessages.push({ content, options });
  },
};

const ctxStub = {
  cwd: process.cwd(),
  ui: {
    notify: (msg, level) => calls.notify.push({ msg, level }),
    setStatus: (key, text) => calls.status.push({ key, text }),
  },
  signal: undefined,
};

mod.default(piStub);

assert.ok(handlers.has("tool_call"), "expected tool_call handler");
assert.ok(handlers.has("turn_end"), "expected turn_end handler");

// 1. turn_end without mutation: noop
calls.exec.length = 0;
await handlers.get("turn_end")({ type: "turn_end" }, ctxStub);
assert.equal(calls.exec.length, 0, "no exec without mutation");

// 2. mutating tool then turn_end: exec called with bash -lc <cmd>
handlers.get("tool_call")({ toolName: "edit", input: { path: "foo.ts" } });
piStub.exec = async (cmd, args) => {
  calls.exec.push({ cmd, args });
  return { code: 0, stdout: "", stderr: "", killed: false };
};
await handlers.get("turn_end")({ type: "turn_end" }, ctxStub);
assert.equal(calls.exec.length, 1, "exec runs after mutation");
assert.equal(calls.exec[0].cmd, "bash", "spawn via bash");
assert.equal(calls.exec[0].args[0], "-lc", "use -lc to evaluate cmd");
assert.ok(
  calls.exec[0].args[1].includes("check-types"),
  "default cmd targets a check-types runner",
);

// 3. failure path: exec returns non-zero -> notify + sendUserMessage
calls.exec.length = 0;
calls.notify.length = 0;
calls.userMessages.length = 0;
// reset debounce by waiting beyond DEFAULT_DEBOUNCE_MS — not easy in a unit test.
// override debounce via env.
process.env.TYPECHECK_DEBOUNCE_MS = "0";
handlers.get("tool_call")({ toolName: "write", input: { path: "foo.ts" } });
piStub.exec = async () => ({
  code: 2,
  stdout: "",
  stderr: "TS2304: cannot find name 'Foo'",
  killed: false,
});
await handlers.get("turn_end")({ type: "turn_end" }, ctxStub);
assert.ok(
  calls.notify.some((n) => n.level === "error"),
  "error notify on failure",
);
assert.equal(calls.userMessages.length, 1, "sendUserMessage on failure");
assert.equal(calls.userMessages[0].options?.deliverAs, "followUp", "deliverAs followUp");
assert.ok(calls.userMessages[0].content.includes("TS2304"), "user message includes error output");

console.log("turn-end-typecheck dry run: OK");
