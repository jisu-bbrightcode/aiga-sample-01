import assert from "node:assert/strict";
import { test } from "node:test";
import { diffKeys, flattenKeys } from "../verify-keys.ts";

test("flattenKeys: flat object passes through", () => {
  const k = flattenKeys({ "a.b": "1", "c.d": "2" });
  assert.deepEqual(k.sort(), ["a.b", "c.d"]);
});

test("flattenKeys: nested object expanded", () => {
  const k = flattenKeys({ a: { b: { c: "x" }, d: "y" }, e: "z" });
  assert.deepEqual(k.sort(), ["a.b.c", "a.d", "e"]);
});

test("flattenKeys: empty object returns no keys", () => {
  assert.deepEqual(flattenKeys({}), []);
});

test("flattenKeys: ignores non-string non-object leaves", () => {
  const k = flattenKeys({ a: 1, b: null, c: true, d: "s" });
  assert.deepEqual(k.sort(), ["d"]);
});

test("diffKeys: identical sets", () => {
  const d = diffKeys(["a", "b"], ["a", "b"]);
  assert.deepEqual(d.missing, []);
  assert.deepEqual(d.extra, []);
});

test("diffKeys: missing in other", () => {
  const d = diffKeys(["a", "b", "c"], ["a"]);
  assert.deepEqual(d.missing.sort(), ["b", "c"]);
  assert.deepEqual(d.extra, []);
});

test("diffKeys: extra in other", () => {
  const d = diffKeys(["a"], ["a", "b"]);
  assert.deepEqual(d.missing, []);
  assert.deepEqual(d.extra, ["b"]);
});

test("diffKeys: both", () => {
  const d = diffKeys(["a", "b"], ["b", "c"]);
  assert.deepEqual(d.missing, ["a"]);
  assert.deepEqual(d.extra, ["c"]);
});
