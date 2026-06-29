import assert from "node:assert/strict";
import test from "node:test";
import { buildServerEventPayload } from "./capture-server-event";

test("buildServerEventPayload passes distinctId/event/properties/groups", () => {
  const p = buildServerEventPayload({
    distinctId: "u1",
    event: "subscription_activated",
    properties: { plan: "pro", value: 12 },
    groups: { organization: "org-1" },
  });
  assert.equal(p.distinctId, "u1");
  assert.equal(p.event, "subscription_activated");
  assert.deepEqual(p.groups, { organization: "org-1" });
  assert.equal((p.properties as Record<string, unknown>).plan, "pro");
  assert.equal((p.properties as Record<string, unknown>).value, 12);
});

test("buildServerEventPayload defaults properties to empty object", () => {
  const p = buildServerEventPayload({ distinctId: "u1", event: "x_y" });
  assert.deepEqual(p.properties, {});
});

test("buildServerEventPayload omits groups when absent", () => {
  const p = buildServerEventPayload({ distinctId: "u1", event: "x_y" });
  assert.equal(p.groups, undefined);
});

test("buildServerEventPayload sanitizes sensitive property keys", () => {
  const p = buildServerEventPayload({
    distinctId: "u1",
    event: "x_y",
    properties: { password: "secret", plan: "free" },
  });
  const props = p.properties as Record<string, unknown>;
  assert.notEqual(props.password, "secret");
  assert.equal(props.plan, "free");
});
