import assert from "node:assert/strict";
import test from "node:test";
import { ANALYTICS_EVENTS } from "./events";

test("ANALYTICS_EVENTS values are snake_case object_action", () => {
  for (const value of Object.values(ANALYTICS_EVENTS)) {
    assert.match(value, /^[a-z][a-z0-9]*(_[a-z0-9]+)*$/, `"${value}" must be snake_case`);
  }
});

test("ANALYTICS_EVENTS has stable P0 funnel event names", () => {
  // 퍼널/인사이트가 이 문자열에 묶임 — 이름 바꾸면 히스토리 끊김. 회귀 가드.
  assert.equal(ANALYTICS_EVENTS.SIGNUP_COMPLETED, "signup_completed");
  assert.equal(ANALYTICS_EVENTS.ONBOARDING_STEP_COMPLETED, "onboarding_step_completed");
  assert.equal(ANALYTICS_EVENTS.ONBOARDING_COMPLETED, "onboarding_completed");
  assert.equal(ANALYTICS_EVENTS.PROJECT_CREATED, "project_created");
  assert.equal(ANALYTICS_EVENTS.ENTITY_CREATED, "entity_created");
  assert.equal(ANALYTICS_EVENTS.DRAFT_CREATED, "draft_created");
  assert.equal(ANALYTICS_EVENTS.PRICING_VIEWED, "pricing_viewed");
  assert.equal(ANALYTICS_EVENTS.CHECKOUT_STARTED, "checkout_started");
  assert.equal(ANALYTICS_EVENTS.SUBSCRIPTION_ACTIVATED, "subscription_activated");
});

test("ANALYTICS_EVENTS values are unique", () => {
  const values = Object.values(ANALYTICS_EVENTS);
  assert.equal(new Set(values).size, values.length);
});
