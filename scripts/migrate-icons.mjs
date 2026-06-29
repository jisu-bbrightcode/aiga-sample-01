#!/usr/bin/env node
/**
 * migrate-icons.mjs — one-time codemod.
 *
 * Normalizes lucide-react icon glyph sizes to the standard inline size
 * `size-3.5` (14px). ONLY touches JSX opening tags whose component name is a
 * lucide-react import in that file — never plain <div>/<span>/Avatar/Spinner
 * badge containers that happen to use the same size utilities.
 *
 * Migrated (→ size-3.5):  size-3, size-4, h-4 w-4 / w-4 h-4, h-3 w-3,
 *                         h-[12px]/[14px]/[16px] w-[…] (either order).
 * Preserved (intentional large): size-5/6/7/8, h-5 w-5.
 *
 * Scope: same in-scope roots / excludes as migrate-typography.mjs.
 * Usage:  node scripts/migrate-icons.mjs [--dry]
 */
import { readFileSync, writeFileSync, statSync, readdirSync } from "node:fs";
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
    if (e.isDirectory()) walk(full, acc);
    else if (e.isFile() && extname(e.name) === ".tsx" && !e.name.endsWith(".snap")) acc.push(full);
  }
  return acc;
}

const files = [];
for (const r of ROOTS) {
  const abs = join(ROOT, r);
  try {
    if (statSync(abs).isDirectory()) walk(abs, files);
  } catch {
    /* */
  }
}

// Parse local names imported from lucide-react — barrel `import { A, B as C } from
// "lucide-react"` AND per-icon deep imports `import Lock from "lucide-react/dist/esm/icons/lock"`
// (default or named, any subpath). Handles aliases + multiline.
function lucideNames(src) {
  const names = new Set();
  // barrel / named (optional subpath): import { A, B as C } from "lucide-react[/...]"
  const named = /import\s+(?:type\s+)?\{([^}]*)\}\s+from\s+["']lucide-react(?:\/[^"']*)?["']/g;
  let m = named.exec(src);
  while (m) {
    for (const part of m[1].split(",")) {
      const t = part.trim();
      if (!t) continue;
      const as = t.split(/\s+as\s+/);
      const local = (as[1] || as[0]).trim();
      if (/^[A-Za-z_$][\w$]*$/.test(local)) names.add(local);
    }
    m = named.exec(src);
  }
  // deep default import: import Lock from "lucide-react/dist/esm/icons/lock"
  const deep = /import\s+([A-Za-z_$][\w$]*)\s+from\s+["']lucide-react\/[^"']*["']/g;
  let d = deep.exec(src);
  while (d) {
    names.add(d[1]);
    d = deep.exec(src);
  }
  return names;
}

// Rewrite size utilities inside one opening-tag attribute blob.
function rewriteAttrs(attrs) {
  let s = attrs;
  s = s.replace(/\bsize-3(?![\d.])/g, "size-3.5"); // size-3 (not size-3.5)
  s = s.replace(/\bsize-4\b/g, "size-3.5");
  s = s.replace(/\bh-4\s+w-4\b/g, "size-3.5");
  s = s.replace(/\bw-4\s+h-4\b/g, "size-3.5");
  s = s.replace(/\bh-3\s+w-3\b/g, "size-3.5");
  s = s.replace(/\bw-3\s+h-3\b/g, "size-3.5");
  s = s.replace(/h-\[12px\]\s+w-\[12px\]/g, "size-3.5");
  s = s.replace(/w-\[12px\]\s+h-\[12px\]/g, "size-3.5");
  s = s.replace(/h-\[14px\]\s+w-\[14px\]/g, "size-3.5");
  s = s.replace(/w-\[14px\]\s+h-\[14px\]/g, "size-3.5");
  s = s.replace(/h-\[16px\]\s+w-\[16px\]/g, "size-3.5");
  s = s.replace(/w-\[16px\]\s+h-\[16px\]/g, "size-3.5");
  return s;
}

let changedFiles = 0;
let totalEls = 0;
let skippedNoLucide = 0;

for (const f of files) {
  const src = readFileSync(f, "utf8");
  const names = lucideNames(src);
  if (names.size === 0) {
    skippedNoLucide++;
    continue;
  }
  const nameAlt = [...names].sort((a, b) => b.length - a.length).join("|");
  // match opening tag: <Name ...attrs...>  (attrs has no '>')
  const re = new RegExp(`<(${nameAlt})\\b([^>]*)>`, "g");
  let n = 0;
  const out = src.replace(re, (full, name, attrs) => {
    const next = rewriteAttrs(attrs);
    if (next !== attrs) n++;
    return `<${name}${next}>`;
  });
  if (n > 0) {
    totalEls += n;
    changedFiles++;
    if (!DRY) writeFileSync(f, out);
  }
}

console.log(`\n${DRY ? "[DRY] " : ""}files scanned: ${files.length}`);
console.log(`files without lucide import (skipped): ${skippedNoLucide}`);
console.log(`files changed: ${changedFiles}`);
console.log(`lucide icon elements resized → size-3.5: ${totalEls}`);
