#!/usr/bin/env node
/**
 * Neon branch lifecycle helper for E2E pipelines.
 *
 * Subcommands:
 *   create <name>      Create branch (forks from primary) and print
 *                      `DATABASE_URL=postgres://...` on stdout. The CI step
 *                      can `eval $(node scripts/neon-branch.mjs create ...)`
 *                      or capture the URL via stdout parsing.
 *   delete <name>      Delete the branch. Idempotent (no-op if missing).
 *   url    <name>      Print the branch's current connection URL.
 *
 * env:
 *   NEON_API_KEY        Neon API token (required)
 *   NEON_PROJECT_ID     Project id (required)
 *   NEON_PARENT_BRANCH  Parent branch id or name to fork from (default: primary)
 *   NEON_ROLE_NAME      DB role to use in the URL (default: project default)
 *   NEON_DB_NAME        DB to use in the URL (default: project default)
 *   NEON_BRANCH_PREFIX  Default prefix when name is "auto" (default: "e2e/")
 *
 * Usage from CI:
 *   DATABASE_URL=$(node scripts/neon-branch.mjs create e2e/pr-$PR_NUMBER)
 *
 * Companion: scripts/neon-gc.mjs deletes stale `feat/*` and `e2e/*` branches.
 */

// Auto-load .env.local from repo root if env vars aren't already set.
// Lets devs run `pnpm db:branch:new` without manually exporting NEON_*.
try {
  const { existsSync, readFileSync } = await import("node:fs");
  const { resolve, dirname } = await import("node:path");
  const { fileURLToPath } = await import("node:url");
  const here = dirname(fileURLToPath(import.meta.url));
  const envPath = resolve(here, "..", ".env.local");
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
} catch {
  // best-effort; ignore failures.
}

const TOKEN = process.env.NEON_API_KEY;
const PROJECT = process.env.NEON_PROJECT_ID;

if (!TOKEN || !PROJECT) {
  console.error("[neon-branch] NEON_API_KEY / NEON_PROJECT_ID required");
  process.exit(2);
}

const BASE = `https://console.neon.tech/api/v2/projects/${PROJECT}`;
const HEADERS = {
  Authorization: `Bearer ${TOKEN}`,
  Accept: "application/json",
  "Content-Type": "application/json",
};

async function api(path, init = {}) {
  const res = await fetch(`${BASE}${path}`, { ...init, headers: HEADERS });
  const text = await res.text();
  if (!res.ok) {
    throw new Error(`Neon ${init.method ?? "GET"} ${path} ${res.status}: ${text}`);
  }
  return text ? JSON.parse(text) : null;
}

async function listBranches() {
  const out = await api("/branches");
  return out?.branches ?? [];
}

async function findBranchByName(name) {
  const branches = await listBranches();
  return branches.find((b) => b.name === name) ?? null;
}

/**
 * Best-effort parse of role + db from an existing DATABASE_URL. The Neon
 * connection_uri endpoint requires both query parameters even though the
 * project has defaults, so we fall back to the primary URL the developer
 * already has in .env.local.
 */
function inferRoleAndDb() {
  const url = process.env.DATABASE_URL;
  if (!url) return { role: "", db: "" };
  try {
    const u = new URL(url);
    return {
      role: u.username || "",
      db: u.pathname.replace(/^\//, "") || "",
    };
  } catch {
    return { role: "", db: "" };
  }
}

async function buildConnectionUri(branchId) {
  const inferred = inferRoleAndDb();
  const role = process.env.NEON_ROLE_NAME || inferred.role;
  const db = process.env.NEON_DB_NAME || inferred.db;
  if (!role || !db) {
    throw new Error(
      "Neon connection_uri requires role + database. Set NEON_ROLE_NAME and NEON_DB_NAME, or ensure DATABASE_URL has both.",
    );
  }
  const params = new URLSearchParams({
    branch_id: branchId,
    pooled: "true",
    role_name: role,
    database_name: db,
  });
  const out = await api(`/connection_uri?${params.toString()}`);
  if (!out?.uri) throw new Error("Neon API returned no connection uri");
  return out.uri;
}

async function createBranch(name) {
  const existing = await findBranchByName(name);
  if (existing) {
    process.stderr.write(`[neon-branch] reusing existing branch ${name} (${existing.id})\n`);
    return await buildConnectionUri(existing.id);
  }
  const parent = process.env.NEON_PARENT_BRANCH;
  const body = {
    branch: parent ? { name, parent_id: parent } : { name },
    endpoints: [{ type: "read_write" }],
  };
  const out = await api("/branches", { method: "POST", body: JSON.stringify(body) });
  const branch = out?.branch;
  if (!branch?.id) throw new Error("Neon create branch returned no id");
  // Wait for endpoint to become active before issuing connection_uri.
  for (let i = 0; i < 30; i++) {
    const branches = await listBranches();
    const refreshed = branches.find((b) => b.id === branch.id);
    if (refreshed && refreshed.current_state === "ready") break;
    await new Promise((r) => setTimeout(r, 1000));
  }
  return await buildConnectionUri(branch.id);
}

async function deleteBranch(name) {
  const existing = await findBranchByName(name);
  if (!existing) {
    process.stderr.write(`[neon-branch] no branch named ${name} (already gone)\n`);
    return;
  }
  await api(`/branches/${existing.id}`, { method: "DELETE" });
  process.stderr.write(`[neon-branch] deleted ${name} (${existing.id})\n`);
}

async function urlOfBranch(name) {
  const existing = await findBranchByName(name);
  if (!existing) throw new Error(`[neon-branch] branch not found: ${name}`);
  return await buildConnectionUri(existing.id);
}

function autoName() {
  const prefix = process.env.NEON_BRANCH_PREFIX ?? "e2e/";
  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  return `${prefix}${stamp}`;
}

async function main() {
  const [cmd, rawName] = process.argv.slice(2);
  const name = rawName === "auto" ? autoName() : rawName;
  if (!cmd) {
    console.error("usage: neon-branch <create|delete|url> <name|auto>");
    process.exit(2);
  }
  if (cmd === "create") {
    const url = await createBranch(name);
    process.stdout.write(`${url}\n`);
  } else if (cmd === "delete") {
    if (!name) throw new Error("delete requires <name>");
    await deleteBranch(name);
  } else if (cmd === "url") {
    if (!name) throw new Error("url requires <name>");
    const url = await urlOfBranch(name);
    process.stdout.write(`${url}\n`);
  } else {
    console.error(`unknown subcommand: ${cmd}`);
    process.exit(2);
  }
}

main().catch((err) => {
  console.error(err.stack ?? err.message ?? err);
  process.exit(1);
});
