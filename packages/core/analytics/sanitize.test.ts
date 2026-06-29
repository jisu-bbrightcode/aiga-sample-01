import assert from "node:assert/strict";
import test from "node:test";
import { sanitize, sanitizeUrl } from "./sanitize";

test("sanitize returns undefined for undefined input", () => {
  assert.equal(sanitize(undefined), undefined);
});

test("sanitize masks sensitive top-level keys", () => {
  const out = sanitize({ token: "abc", password: "p", apiKey: "k", normal: "ok" });
  assert.equal(out?.token, "[REDACTED]");
  assert.equal(out?.password, "[REDACTED]");
  assert.equal(out?.apiKey, "[REDACTED]");
  assert.equal(out?.normal, "ok");
});

test("sanitize masks sensitive keys case-insensitively and matches Authorization/Cookie", () => {
  const out = sanitize({ Authorization: "Bearer x", COOKIE: "c", api_key: "k" });
  assert.equal(out?.Authorization, "[REDACTED]");
  assert.equal(out?.COOKIE, "[REDACTED]");
  assert.equal(out?.api_key, "[REDACTED]");
});

test("sanitize recurses into nested objects up to depth 3", () => {
  const out = sanitize({ a: { b: { token: "deep" } } }) as Record<string, unknown>;
  const a = out.a as Record<string, unknown>;
  const b = a.b as Record<string, unknown>;
  assert.equal(b.token, "[REDACTED]");
});

test("sanitize truncates beyond max depth", () => {
  const out = sanitize({ l1: { l2: { l3: { l4: { secret: "x" } } } } }) as Record<string, unknown>;
  const l1 = out.l1 as Record<string, unknown>;
  const l2 = l1.l2 as Record<string, unknown>;
  const l3 = l2.l3 as Record<string, unknown>;
  // depth 4 노드는 "[TRUNCATED]" 로 잘림
  assert.equal(l3.l4, "[TRUNCATED]");
});

test("sanitize handles arrays", () => {
  const out = sanitize({ list: [{ token: "a" }, { ok: "b" }] }) as Record<string, unknown>;
  const list = out.list as Record<string, unknown>[];
  assert.equal(list[0]!.token, "[REDACTED]");
  assert.equal(list[1]!.ok, "b");
});

test("sanitize caps total visited nodes", () => {
  const big: Record<string, unknown> = {};
  for (let i = 0; i < 500; i++) big[`k${i}`] = i;
  const out = sanitize(big) as Record<string, unknown>;
  // MAX_NODES = 200. walk(root) consumes visited=1, then each key's value
  // increments visited. Keys k0..k198 → visited 2..200 (≤200, kept).
  // Keys k199..k499 → visited 201..501 (>200, "[TRUNCATED]").
  const truncated = Object.values(out).filter((v) => v === "[TRUNCATED]");
  const kept = Object.values(out).filter((v) => v !== "[TRUNCATED]");
  assert.equal(kept.length, 199);
  assert.equal(truncated.length, 301);
});

test("sanitizeUrl redacts token and preserves other params", () => {
  const out = sanitizeUrl("https://example.com/callback?token=abc&foo=bar");
  const u = new URL(out);
  assert.equal(u.searchParams.get("token"), "[REDACTED]");
  assert.equal(u.searchParams.get("foo"), "bar");
});

test("sanitizeUrl redacts OAuth code param", () => {
  const out = sanitizeUrl("https://example.com/callback?code=xyz&state=abc");
  const u = new URL(out);
  assert.equal(u.searchParams.get("code"), "[REDACTED]");
  assert.equal(u.searchParams.get("state"), "[REDACTED]");
});

test("sanitizeUrl redacts token in relative URL and keeps it relative", () => {
  const out = sanitizeUrl("/api/x?token=abc&foo=bar");
  assert.ok(!out.startsWith("http://"), "must remain relative");
  const u = new URL(out, "http://_");
  assert.equal(u.searchParams.get("token"), "[REDACTED]");
  assert.equal(u.searchParams.get("foo"), "bar");
});

test("sanitizeUrl returns truly invalid string unchanged", () => {
  assert.equal(sanitizeUrl("not a url at all %%%"), "not a url at all %%%");
});

test("sanitizeUrl returns URL without query params unchanged", () => {
  const url = "https://example.com/path";
  assert.equal(sanitizeUrl(url), url);
});
