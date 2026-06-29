#!/usr/bin/env node
/**
 * Forbid disabling specific lint rules via inline comments.
 *
 * The `no-raw-sql-query` and `no-schema-outside-drizzle` rules are part of the
 * data-safety harness: they ensure every SQL statement goes through the
 * drizzle query builder and every PostgreSQL table is declared once in
 * `@repo/drizzle`. Bypassing them locally (per-line `eslint-disable`,
 * file-level `oxlint-disable`, etc.) defeats the purpose — a single skipped
 * INSERT can desync the canonical schema path.
 *
 * This script greps the working tree for any comment that disables one of
 * those rules and exits non-zero if found. Run it from CI and as a
 * pre-commit / pre-push hook.
 *
 *   node scripts/forbid-rule-disable.mjs           # scan whole repo
 *   node scripts/forbid-rule-disable.mjs path/...  # scan given paths
 *
 * To intentionally extend the allowed-pattern set instead of disabling per
 * call, edit `packages/oxlint-plugin/src/rules/<rule>.mjs`'s
 * `ALLOWED_PATTERNS` / whitelist arrays.
 */

import { execFileSync } from "node:child_process";
import { existsSync, readFileSync, statSync } from "node:fs";
import path from "node:path";

const PROTECTED_RULES = ["product-builder/no-raw-sql-query", "product-builder/no-schema-outside-drizzle"];

// Regexes that match ANY of: eslint-disable, eslint-disable-next-line,
// eslint-disable-line, oxlint-disable, biome-ignore lint/correctness/<rule>.
// Biome doesn't run our product-builder/* rules so we only look for eslint/oxlint
// directives, plus a defensive catch-all for any future linter that might
// honour the rule name.
const PROTECTED_REGEX = new RegExp(
  String.raw`(?://|/\*)\s*(?:eslint|oxlint)-(?:disable(?:-(?:next-)?line)?|enable)\b[^*\n]*\b(?:${PROTECTED_RULES.map((r) => r.replace("/", "\\/")).join("|")})\b`,
);

// Files that legitimately contain the directive text (rule source itself,
// detection regexes, smoke tests). Skip them to avoid self-flagging.
const EXEMPT_FILES = [
  /(?:^|\/)scripts\/forbid-rule-disable\.mjs$/,
  /(?:^|\/)packages\/oxlint-plugin\/src\/rules\//,
  /(?:^|\/)\.pi\/extensions\/rules\//,
  /(?:^|\/)\.pi\/extensions\/no-banned-patterns\//,
];

function listSourceFiles(roots) {
  const args = ["ls-files"];
  for (const r of roots) args.push(r);
  const out = execFileSync("git", args, { encoding: "utf8", maxBuffer: 32 * 1024 * 1024 });
  return out
    .split("\n")
    .filter(Boolean)
    .filter((f) => /\.(ts|tsx|mjs|mts|cjs|cts|js|jsx)$/.test(f))
    .filter((f) => !EXEMPT_FILES.some((rx) => rx.test(f)));
}

function scanFile(file) {
  const violations = [];
  let text;
  try {
    text = readFileSync(file, "utf8");
  } catch {
    return violations;
  }
  const lines = text.split("\n");
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (PROTECTED_REGEX.test(line)) {
      violations.push({ file, lineNo: i + 1, line: line.trim() });
    }
  }
  return violations;
}

function main() {
  const argv = process.argv.slice(2);
  const roots = argv.length > 0 ? argv : ["."];
  // Validate paths exist
  for (const r of roots) {
    if (!existsSync(r)) {
      console.error(`forbid-rule-disable: path does not exist: ${r}`);
      process.exit(2);
    }
  }
  const files = listSourceFiles(roots);
  const allViolations = [];
  for (const f of files) {
    if (!existsSync(f)) continue;
    if (statSync(f).isDirectory()) continue;
    // Skip self.
    if (path.resolve(f) === import.meta.url.replace("file://", "")) continue;
    allViolations.push(...scanFile(f));
  }

  if (allViolations.length === 0) {
    console.log(
      `forbid-rule-disable: 0 disable directives found for ${PROTECTED_RULES.join(", ")} ✓`,
    );
    process.exit(0);
  }

  console.error(
    `forbid-rule-disable: ${allViolations.length} forbidden disable directive(s) found.`,
  );
  console.error(
    `The following rules MUST NOT be disabled per line/file: ${PROTECTED_RULES.join(", ")}.`,
  );
  console.error("If you genuinely need a new exception, expand ALLOWED_PATTERNS in");
  console.error("  packages/oxlint-plugin/src/rules/<rule>.mjs (with code review).\n");
  for (const v of allViolations) {
    console.error(`  ${v.file}:${v.lineNo}: ${v.line}`);
  }
  process.exit(1);
}

main();
