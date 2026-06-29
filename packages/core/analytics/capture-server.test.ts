import assert from "node:assert/strict";
import test from "node:test";
import { buildServerErrorPayload, resolveServerDistinctId } from "./capture-server";

test("resolveServerDistinctId uses userId when present", () => {
  assert.equal(resolveServerDistinctId({ userId: "u1", service: "electron" } as never), "u1");
});

test("resolveServerDistinctId falls back to anonymous-${service}", () => {
  assert.equal(resolveServerDistinctId({ service: "electron" } as never), "anonymous-electron");
});

test("resolveServerDistinctId defaults service to server", () => {
  assert.equal(resolveServerDistinctId({} as never), "anonymous-server");
});

test("buildServerErrorPayload maps to snake_case properties including service", () => {
  const p = buildServerErrorPayload({
    service: "electron", path: "/api/x", method: "GET", statusCode: 500,
    errorMessage: "boom", errorCode: "INTERNAL", requestId: "req-1", stack: "stack",
  } as never);
  assert.equal(p.service, "electron");
  assert.equal(p.path, "/api/x");
  assert.equal(p.method, "GET");
  assert.equal(p.status_code, 500);
  assert.equal(p.error_message, "boom");
  assert.equal(p.error_code, "INTERNAL");
  assert.equal(p.request_id, "req-1");
  assert.equal(p.stack, "stack");
});

test("buildServerErrorPayload defaults service to server", () => {
  const p = buildServerErrorPayload({
    path: "/api/x", method: "GET", statusCode: 500, errorMessage: "boom",
  } as never);
  assert.equal(p.service, "server");
});
