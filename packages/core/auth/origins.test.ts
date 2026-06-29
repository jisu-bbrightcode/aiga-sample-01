import assert from "node:assert/strict";
import test from "node:test";
import { resolveTrustedOrigins } from "./origins";

test("resolveTrustedOrigins includes production custom domains and legacy aliases by default", () => {
  const origins = resolveTrustedOrigins({});

  assert.ok(origins.includes("https://product-builder-app.vercel.app"));
  assert.ok(origins.includes("https://product-builder-api.vercel.app"));
});

test("resolveTrustedOrigins includes preview deployment wildcards for BetterAuth matcher", () => {
  const origins = resolveTrustedOrigins({});

  assert.ok(origins.includes("https://product-builder-app-*.vercel.app"));
  assert.ok(origins.includes("https://product-builder-*.vercel.app"));
  assert.ok(origins.includes("https://product-builder-admin-*.vercel.app"));
});

test("resolveTrustedOrigins trims CORS_ORIGINS entries and removes duplicates", () => {
  const origins = resolveTrustedOrigins({
    CORS_ORIGINS: " https://custom.example.com,https://custom.example.com, http://localhost:3000 ",
  });

  assert.deepEqual(origins, ["https://custom.example.com", "http://localhost:3000"]);
});
