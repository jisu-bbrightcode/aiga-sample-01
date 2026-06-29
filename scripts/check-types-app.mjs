#!/usr/bin/env node
/**
 * App-scoped typecheck (clean baseline).
 *
 * Runs `turbo run check-types` ONLY on packages whose current type baseline is
 * green. Other packages carry pre-existing strict-mode debt that is unrelated
 * to the user's current turn and must NOT cascade into the per-turn gate.
 *
 * As packages get cleaned up, add them to INCLUDE.
 *
 * Used by `.pi/extensions/turn-end-typecheck` (via TYPECHECK_CMD).
 *
 * Usage:
 *   node scripts/check-types-app.mjs
 *   TYPECHECK_CMD="node scripts/check-types-app.mjs" pi
 */
import { spawnSync } from "node:child_process";

const INCLUDE = [
  "@repo/drizzle",
  "@repo/shared",
  "@repo/core",
  "landing",
  "server",
];

const filters = INCLUDE.flatMap((p) => ["--filter", p]);
// Extra args after `--` are forwarded to turbo (e.g. `--force` to bust stale cache).
const extraArgs = process.argv.includes("--")
  ? process.argv.slice(process.argv.indexOf("--") + 1)
  : [];
// `--only` 로 transitive dep 실행을 막는다.
const result = spawnSync(
  "pnpm",
  ["exec", "turbo", "run", "check-types", "--only", ...filters, ...extraArgs],
  {
    stdio: "inherit",
  },
);
process.exit(result.status ?? 1);
