import assert from "node:assert/strict";
import test from "node:test";
import { createClientLogger } from "./create-client-logger";

function makeSink() {
  const breadcrumbs: unknown[] = [];
  const logs: unknown[] = [];
  return {
    breadcrumbs,
    logs,
    sink: {
      pushBreadcrumb: (b: unknown) => breadcrumbs.push(b),
      captureLog: (e: unknown) => logs.push(e),
      logLevel: "info" as const,
    },
  };
}

test("createClientLogger pushes breadcrumb for every level at/above logLevel", () => {
  const { breadcrumbs, sink } = makeSink();
  const log = createClientLogger("test", sink);
  log.info("i");
  log.warn("w");
  log.error("e");
  assert.equal(breadcrumbs.length, 3);
});

test("createClientLogger gates levels below logLevel", () => {
  const { breadcrumbs, logs, sink } = makeSink();
  const log = createClientLogger("test", { ...sink, logLevel: "warn" });
  log.info("i"); // gated
  log.debug("d"); // gated
  log.warn("w");
  assert.equal(breadcrumbs.length, 1);
  assert.equal(logs.length, 1);
});

test("createClientLogger captures log only for warn/error", () => {
  const { logs, sink } = makeSink();
  const log = createClientLogger("test", sink);
  log.info("i");  // breadcrumb only
  log.debug("d"); // gated
  log.warn("w");  // capture
  log.error("e"); // capture
  assert.equal(logs.length, 2);
});

test("createClientLogger passes namespace + attributes to captureLog", () => {
  const { logs, sink } = makeSink();
  const log = createClientLogger("sync", sink);
  log.error("failed", { code: 500 });
  const e = logs[0]! as { level: string; namespace: string; message: string; attributes: Record<string, unknown> };
  assert.equal(e.level, "error");
  assert.equal(e.namespace, "sync");
  assert.equal(e.message, "failed");
  assert.equal(e.attributes.code, 500);
});
