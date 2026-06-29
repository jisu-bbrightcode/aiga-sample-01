import assert from "node:assert/strict";
import test from "node:test";
import { buildCorsHeaders, resolveAllowedOrigin } from "./cors";

test("resolveAllowedOrigin reflects an explicitly allowed production origin", () => {
  const allowed = "https://product-builder-app.vercel.app, https://product-builder-app.vercel.app";

  assert.equal(resolveAllowedOrigin("https://product-builder-app.vercel.app", allowed), "https://product-builder-app.vercel.app");
});

test("resolveAllowedOrigin rejects origins outside the allowlist", () => {
  const allowed = "https://product-builder-app.vercel.app, https://product-builder-app.vercel.app";

  assert.equal(resolveAllowedOrigin("https://evil.example", allowed), null);
});

test("buildCorsHeaders adds CORS and cache variance headers for allowed origins", () => {
  const headers = buildCorsHeaders(
    new Headers({ Origin: "https://product-builder-app.vercel.app" }),
    "https://product-builder-app.vercel.app, https://product-builder-app.vercel.app",
  );

  assert.equal(headers.get("Access-Control-Allow-Origin"), "https://product-builder-app.vercel.app");
  assert.equal(headers.get("Access-Control-Allow-Methods"), "POST, OPTIONS");
  assert.equal(headers.get("Access-Control-Allow-Headers"), "Content-Type,Authorization");
  assert.equal(headers.get("Vary"), "Origin");
});
