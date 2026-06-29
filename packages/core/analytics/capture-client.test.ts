import assert from "node:assert/strict";
import test from "node:test";
import { __resetBreadcrumbs, pushBreadcrumb } from "./client/breadcrumb-buffer";
import { buildClientErrorPayload, buildClientLogPayload } from "./capture-client";

test("buildClientErrorPayload extracts message/name/stack from Error", () => {
  __resetBreadcrumbs();
  const err = new Error("boom");
  const p = buildClientErrorPayload(err, { source: "test" }, "https://x.test");
  assert.equal(p.error_message, "boom");
  assert.equal(p.error_name, "Error");
  assert.equal(typeof p.error_stack, "string");
  assert.equal(p.url, "https://x.test");
  assert.equal(p.source, "test");
});

test("buildClientErrorPayload handles string error", () => {
  __resetBreadcrumbs();
  const p = buildClientErrorPayload("oops", undefined, "https://x.test");
  assert.equal(p.error_message, "oops");
  assert.equal(p.error_name, "Error");
  assert.equal(p.error_stack, undefined);
});

test("buildClientErrorPayload attaches breadcrumbs", () => {
  __resetBreadcrumbs();
  pushBreadcrumb({ ts: 1, level: "info", ns: "test", message: "crumb" });
  const p = buildClientErrorPayload("oops", undefined, "https://x.test");
  const crumbs = p.breadcrumbs as { message: string }[];
  assert.equal(crumbs.length, 1);
  assert.equal(crumbs[0]!.message, "crumb");
});

test("buildClientLogPayload maps fields", () => {
  __resetBreadcrumbs();
  const p = buildClientLogPayload({
    level: "warn", namespace: "sync", message: "slow", attributes: { ms: 200 },
  });
  assert.equal(p.level, "warn");
  assert.equal(p.namespace, "sync");
  assert.equal(p.message, "slow");
  assert.equal((p.attributes as Record<string, unknown>).ms, 200);
});
