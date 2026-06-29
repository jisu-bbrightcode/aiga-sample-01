#!/usr/bin/env node
/**
 * migrate-typography.mjs — one-time codemod.
 *
 * Replaces arbitrary `text-[Npx]` Tailwind classes with the absolute named
 * type-scale tokens defined in packages/ui/src/typography.css.
 *
 * Deterministic mapping (px → token). Any px value NOT in the table is mapped
 * to the nearest token AND logged as a warning so nothing is silently dropped.
 *
 * Scope: in-scope source roots only. Excludes design-demo templates, vendor
 * demo blocks, and build artifacts. `.tsx` / `.ts` className strings only —
 * CSS font-size px is handled separately (Phase 0 / Phase 4).
 *
 * Usage:  node scripts/migrate-typography.mjs [--dry]
 */
import { readFileSync, writeFileSync, statSync } from "node:fs";
import { readdirSync } from "node:fs";
import { join, extname } from "node:path";

const DRY = process.argv.includes("--dry");
const ROOT = process.cwd();

const ROOTS = [
  "apps/app/src",
  "apps/admin/src",
  "packages/ui/src",
  "packages/widgets/src",
  "packages/core/src",
  "packages/features/src",
];

const EXCLUDE = [
  "node_modules",
  "/dist/",
  "/release/",
  "/.next/",
  "/out/",
  "/templates/",
  "/shadcn-studio/blocks/",
];

// token px anchors for nearest-fallback
const TOKEN_PX = {
  "text-2xs": 11,
  "text-xs": 12,
  "text-sm": 13,
  "text-base": 14,
  "text-lg": 16,
  "text-xl": 18,
  "text-2xl": 20,
  "text-3xl": 24,
  "text-4xl": 30,
  "text-5xl": 36,
  "text-6xl": 48,
  "text-7xl": 60,
};

// explicit, decision-locked mapping
const MAP = {
  8: "text-2xs",
  9: "text-2xs",
  10: "text-2xs",
  10.5: "text-2xs",
  11: "text-xs",
  11.5: "text-xs",
  12: "text-xs",
  12.5: "text-xs",
  13: "text-base",
  14: "text-base",
  15: "text-lg",
  16: "text-lg",
  18: "text-xl",
  20: "text-2xl",
  22: "text-2xl",
  24: "text-3xl",
  28: "text-4xl",
  32: "text-4xl",
  40: "text-5xl",
  44: "text-6xl",
  52: "text-6xl",
  56: "text-6xl",
  64: "text-7xl",
  72: "text-7xl",
};

function nearestToken(px) {
  let best = null;
  let bestD = Infinity;
  for (const [tok, val] of Object.entries(TOKEN_PX)) {
    const d = Math.abs(val - px);
    if (d < bestD) {
      bestD = d;
      best = tok;
    }
  }
  return best;
}

function walk(dir, acc) {
  let entries;
  try {
    entries = readdirSync(dir, { withFileTypes: true });
  } catch {
    return acc;
  }
  for (const e of entries) {
    const full = join(dir, e.name);
    if (EXCLUDE.some((x) => full.includes(x))) continue;
    if (e.isDirectory()) {
      walk(full, acc);
    } else if (e.isFile()) {
      const ext = extname(e.name);
      if ((ext === ".tsx" || ext === ".ts") && !e.name.endsWith(".snap")) acc.push(full);
    }
  }
  return acc;
}

const files = [];
for (const r of ROOTS) {
  const abs = join(ROOT, r);
  try {
    if (statSync(abs).isDirectory()) walk(abs, files);
  } catch {
    /* root may not exist */
  }
}

const RE = /text-\[(\d+(?:\.\d+)?)px\]/g;
const unmapped = new Map();
const pxCounts = new Map();
let changedFiles = 0;
let totalRepl = 0;

for (const f of files) {
  const src = readFileSync(f, "utf8");
  let n = 0;
  const out = src.replace(RE, (m, pxStr) => {
    const px = Number(pxStr);
    let tok = MAP[px];
    if (!tok) {
      tok = nearestToken(px);
      unmapped.set(px, (unmapped.get(px) || 0) + 1);
    }
    pxCounts.set(px, (pxCounts.get(px) || 0) + 1);
    n++;
    return tok;
  });
  if (n > 0) {
    totalRepl += n;
    changedFiles++;
    if (!DRY) writeFileSync(f, out);
  }
}

console.log(`\n${DRY ? "[DRY] " : ""}files scanned: ${files.length}`);
console.log(`files changed: ${changedFiles}`);
console.log(`total text-[Npx] replaced: ${totalRepl}`);
console.log("\nby px:");
for (const [px, c] of [...pxCounts.entries()].sort((a, b) => b[1] - a[1])) {
  console.log(`  ${px}px → ${MAP[px] || `${nearestToken(px)} (NEAREST)`} : ${c}`);
}
if (unmapped.size) {
  console.log("\n⚠ UNMAPPED px (nearest-fallback applied, review):");
  for (const [px, c] of unmapped) console.log(`  ${px}px ×${c}`);
} else {
  console.log("\n✓ all px values in explicit map (no fallback)");
}
