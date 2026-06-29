import assert from "node:assert/strict";
import test from "node:test";
import { aliasFlagKey, shouldAlias } from "./identity";

test("aliasFlagKey is app-prefixed", () => {
  assert.equal(aliasFlagKey("anon-123"), "product_builder_posthog_alias_done_anon-123");
});

test("shouldAlias true when anonId differs from userId and not yet aliased", () => {
  assert.equal(shouldAlias("anon-1", "user-1", () => false), true);
});

test("shouldAlias false when anonId equals userId", () => {
  assert.equal(shouldAlias("user-1", "user-1", () => false), false);
});

test("shouldAlias false when already aliased", () => {
  assert.equal(shouldAlias("anon-1", "user-1", () => true), false);
});
