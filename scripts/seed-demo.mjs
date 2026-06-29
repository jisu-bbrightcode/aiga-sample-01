#!/usr/bin/env node
/**
 * Demo seed orchestrator — repeatable demo dataset.
 *
 * Runs the existing seed scripts in order, then marks the super-user
 * email as verified so it can sign in on a production (Vercel) server
 * where better-auth requires email verification.
 *
 * Reads DATABASE_URL + PRODUCT_BUILDER_SEED_* from the repo-root .env.local
 * (same convention as scripts/neon-branch.mjs and db-migrate.ts).
 *
 * Usage:
 *   PRODUCT_BUILDER_SEED_EMAIL=demo@flotter.io \
 *   PRODUCT_BUILDER_SEED_PASSWORD=... \
 *     node scripts/seed-demo.mjs
 */

import { execSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, "..");

// Best-effort .env.local load (only fills vars that aren't already set).
const envPath = resolve(root, ".env.local");
if (existsSync(envPath)) {
  for (const line of readFileSync(envPath, "utf8").split("\n")) {
    const m = line.match(/^\s*([A-Z][A-Z0-9_]*)\s*=\s*(.*)\s*$/);
    if (!m) continue;
    const [, k, rawV] = m;
    if (process.env[k] !== undefined) continue;
    let v = rawV;
    if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) {
      v = v.slice(1, -1);
    }
    process.env[k] = v;
  }
}

const EMAIL = process.env.PRODUCT_BUILDER_SEED_EMAIL;
const DATABASE_URL = process.env.DATABASE_URL;
if (!EMAIL) {
  console.error("[seed-demo] PRODUCT_BUILDER_SEED_EMAIL required");
  process.exit(1);
}
if (!DATABASE_URL) {
  console.error("[seed-demo] DATABASE_URL required (set in .env.local)");
  process.exit(1);
}

const run = (cmd) => {
  console.log(`\n[seed-demo] $ ${cmd}`);
  execSync(cmd, { cwd: root, stdio: "inherit" });
};

// Super-user first: better-auth signUpEmail creates the user AND auto-syncs
// the profiles row via databaseHooks (packages/core/auth/server.ts). The
// legacy db:seed:profiles (Supabase auth.users → profiles) does not apply here.
run("pnpm -F server exec tsx src/scripts/seed-super-user.ts");
// Payment catalog is standalone (no user/org dependency).
run("pnpm --filter @repo/drizzle db:seed:payment");

// Mark the super-user verified so production sign-in works.
// Run inside @repo/drizzle so the `postgres` dep resolves (it is not a
// repo-root dependency).
run("pnpm --filter @repo/drizzle exec tsx src/scripts/mark-email-verified.ts");
console.log("[seed-demo] ✅ done");
