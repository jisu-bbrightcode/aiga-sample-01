#!/usr/bin/env node
/**
 * Audit `sql\`...\`` usage across the server / features / core packages and
 * classify each occurrence so the team can decide what to migrate, what to
 * keep, and where the new `no-raw-sql` lint rule should allow exceptions.
 *
 * Output: stdout report and `docs/architecture/raw-sql-inventory.md` (when
 * --write is passed).
 *
 * Classification heuristic:
 *
 *   FRAGMENT  — sql`` used as an EXPRESSION inside a drizzle builder call
 *               (.set({ col: sql`...` }), .where(sql`...`), conditions.push(sql`...`)).
 *               Standard drizzle pattern. Not a debt.
 *
 *   RAW_QUERY — sql`` passed to db.execute / tx.execute / db.run. Contains
 *               full SELECT/INSERT/UPDATE/DELETE statements. Legitimate when
 *               using features drizzle cannot express (CTE, pg_advisory_lock,
 *               window functions). Worth reviewing per call.
 *
 *   UNKNOWN   — pattern did not match the above. Manual review needed.
 *
 * This script does not modify code. It produces a triage report.
 */

import { readFileSync, readdirSync, statSync, writeFileSync } from "node:fs";
import { join, relative } from "node:path";

const ROOT = process.cwd();
const SCOPE_DIRS = ["apps/server/src", "packages/features", "packages/core"];
const SKIP_FILE_SUFFIX = [".test.ts", ".spec.ts"];

const findings = [];

for (const dir of SCOPE_DIRS) walk(join(ROOT, dir));

function walk(dir) {
  let entries;
  try {
    entries = readdirSync(dir);
  } catch {
    return;
  }
  for (const e of entries) {
    const p = join(dir, e);
    let s;
    try {
      s = statSync(p);
    } catch {
      continue;
    }
    if (s.isDirectory()) {
      if (e === "node_modules" || e === "dist" || e === "__tests__") continue;
      walk(p);
    } else if (e.endsWith(".ts") && !SKIP_FILE_SUFFIX.some((suf) => e.endsWith(suf))) {
      scan(p);
    }
  }
}

function scan(file) {
  const lines = readFileSync(file, "utf8").split("\n");
  for (let i = 0; i < lines.length; i++) {
    const raw = lines[i];
    if (!/\bsql`/.test(raw)) continue;
    // Skip pure import statements
    if (/^\s*import\b/.test(raw)) continue;
    // Skip comments / docstrings (line and block)
    if (/^\s*\*/.test(raw)) continue;
    if (/^\s*\/\//.test(raw)) continue;

    const ctx = lines
      .slice(Math.max(0, i - 2), i + 1)
      .map((l) => l.trim())
      .join(" ");

    const classification = classify(ctx);
    findings.push({
      file: relative(ROOT, file),
      line: i + 1,
      classification,
      snippet: raw.trim().slice(0, 120),
    });
  }
}

function classify(ctxLowered) {
  const c = ctxLowered;
  // Raw full statement passed to execute/run, or the postgres-js sql tag
  // used directly (await sql`SELECT ...`, etc.).
  if (
    /\.(execute|run)\s*[<(]/.test(c) ||
    /\.(execute|run)\s*\(\s*sql`/.test(c) ||
    /\bawait\s+sql`/.test(c)
  ) {
    return "RAW_QUERY";
  }
  // Used as a column expression or condition fragment.
  if (
    /\.(set|where|having|orderby|orderBy|values)\s*\(/.test(c) ||
    /:\s*sql`/.test(c) ||
    /push\s*\(\s*sql`/.test(c) ||
    /,\s*sql`/.test(c) ||
    /\(\s*sql`/.test(c)
  ) {
    return "FRAGMENT";
  }
  return "UNKNOWN";
}

// --- summary ----------------------------------------------------------

const total = findings.length;
const byClass = findings.reduce((acc, f) => {
  acc[f.classification] = (acc[f.classification] ?? 0) + 1;
  return acc;
}, {});

const byFile = findings.reduce((acc, f) => {
  acc[f.file] ??= { total: 0, FRAGMENT: 0, RAW_QUERY: 0, UNKNOWN: 0 };
  acc[f.file].total += 1;
  acc[f.file][f.classification] += 1;
  return acc;
}, {});

console.log(`Total sql\`\` occurrences: ${total}`);
console.log(`By classification: ${JSON.stringify(byClass)}`);
console.log("");
console.log("By file:");
const ranked = Object.entries(byFile).sort((a, b) => b[1].total - a[1].total);
for (const [file, stat] of ranked) {
  console.log(
    `  ${stat.total.toString().padStart(3)}  F:${stat.FRAGMENT} Q:${stat.RAW_QUERY} ?:${stat.UNKNOWN}  ${file}`,
  );
}

if (process.argv.includes("--write")) {
  const lines = [];
  lines.push("# raw `sql\\`\\`` 사용 인벤토리");
  lines.push("");
  lines.push("`scripts/audit-raw-sql.mjs` 산출. 운영자가 한 번씩 머지 전 점검.");
  lines.push("");
  lines.push("## 요약");
  lines.push("");
  lines.push(`- 총 ${total}건`);
  for (const [k, v] of Object.entries(byClass)) lines.push(`- ${k}: ${v}`);
  lines.push("");
  lines.push("## 분류");
  lines.push("");
  lines.push(
    "- **FRAGMENT** — drizzle builder 안의 표현식 (`set({ col: sql\\`${col}+1\\` })`, `where(sql\\`...\\`)`, `conditions.push(sql\\`...\\`)`). 정당. 부채 아님.",
  );
  lines.push(
    "- **RAW_QUERY** — `db.execute(sql\\`SELECT ...\\`)` / `tx.execute(...)`. drizzle 표현 어려운 영역 (CTE, advisory lock 등) 에서 정당. 한 건씩 리뷰.",
  );
  lines.push("- **UNKNOWN** — 패턴 매칭 실패. 수동 분류 필요.");
  lines.push("");
  lines.push("## 파일별 카운트 (FRAGMENT / RAW_QUERY / UNKNOWN)");
  lines.push("");
  lines.push("| file | total | F | Q | ? |");
  lines.push("|---|---:|---:|---:|---:|");
  for (const [file, stat] of ranked) {
    lines.push(
      `| \`${file}\` | ${stat.total} | ${stat.FRAGMENT} | ${stat.RAW_QUERY} | ${stat.UNKNOWN} |`,
    );
  }
  lines.push("");
  lines.push("## RAW_QUERY 전체 목록 (수동 리뷰 대상)");
  lines.push("");
  for (const f of findings.filter((x) => x.classification === "RAW_QUERY")) {
    lines.push(`- \`${f.file}:${f.line}\`  \`${f.snippet}\``);
  }
  if (findings.some((f) => f.classification === "UNKNOWN")) {
    lines.push("");
    lines.push("## UNKNOWN 목록");
    lines.push("");
    for (const f of findings.filter((x) => x.classification === "UNKNOWN")) {
      lines.push(`- \`${f.file}:${f.line}\`  \`${f.snippet}\``);
    }
  }
  const out = join(ROOT, "docs/architecture/raw-sql-inventory.md");
  writeFileSync(out, lines.join("\n") + "\n");
  console.log("");
  console.log(`wrote ${out}`);
}
