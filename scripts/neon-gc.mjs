#!/usr/bin/env node
/**
 * Neon feature branch GC.
 *
 * Lists `feat/*` branches and deletes those whose last update is older than
 * the threshold. Dry-run by default; pass --apply to actually delete.
 *
 * env:
 *   NEON_API_KEY        Neon API token (required)
 *   NEON_PROJECT_ID     Project id (required)
 *   NEON_BRANCH_PREFIX  Branch name prefix to consider (default: "feat/")
 *   NEON_GC_MAX_AGE_D   Max age in days (default: 14)
 */

const TOKEN = process.env.NEON_API_KEY;
const PROJECT = process.env.NEON_PROJECT_ID;
const PREFIX = process.env.NEON_BRANCH_PREFIX ?? "feat/";
const MAX_AGE_D = Number(process.env.NEON_GC_MAX_AGE_D ?? "14");
const APPLY = process.argv.includes("--apply");

if (!TOKEN || !PROJECT) {
  console.error("NEON_API_KEY / NEON_PROJECT_ID 필요");
  process.exit(2);
}

const base = `https://console.neon.tech/api/v2/projects/${PROJECT}`;
const headers = {
  Authorization: `Bearer ${TOKEN}`,
  Accept: "application/json",
  "Content-Type": "application/json",
};

async function api(path, init = {}) {
  const res = await fetch(`${base}${path}`, { ...init, headers });
  const text = await res.text();
  if (!res.ok) {
    throw new Error(`Neon ${init.method ?? "GET"} ${path} ${res.status}: ${text}`);
  }
  return text ? JSON.parse(text) : null;
}

const { branches } = await api("/branches");
const now = Date.now();
const cutoff = now - MAX_AGE_D * 24 * 60 * 60 * 1000;

const candidates = branches.filter((b) => {
  if (!b.name?.startsWith(PREFIX)) return false;
  const last = Date.parse(b.updated_at ?? b.created_at ?? 0);
  return Number.isFinite(last) && last < cutoff;
});

if (candidates.length === 0) {
  console.log(`GC 대상 없음 (prefix=${PREFIX}, age>${MAX_AGE_D}d)`);
  process.exit(0);
}

console.log(`삭제 후보 ${candidates.length}개 (prefix=${PREFIX}, age>${MAX_AGE_D}d):`);
for (const b of candidates) {
  const ageD = Math.floor((now - Date.parse(b.updated_at ?? b.created_at)) / 86400000);
  console.log(`  ${b.name}  id=${b.id}  age=${ageD}d`);
}

if (!APPLY) {
  console.log("\n(dry-run) 실삭제는 --apply 추가.");
  process.exit(0);
}

let failed = 0;
for (const b of candidates) {
  try {
    await api(`/branches/${b.id}`, { method: "DELETE" });
    console.log(`✓ deleted ${b.name}`);
  } catch (err) {
    failed += 1;
    console.error(`✗ ${b.name}: ${err.message}`);
  }
}
process.exit(failed > 0 ? 1 : 0);
