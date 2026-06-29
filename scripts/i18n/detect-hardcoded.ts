#!/usr/bin/env tsx
/**
 * scripts/i18n/detect-hardcoded.ts
 *
 * .ts / .tsx 의 비-i18n 한글 리터럴 스캔.
 * Biome custom plugin 의 보완 — template literal, 상수 객체, toast 인자 등을 잡는다.
 *
 * Usage:
 *   pnpm i18n:detect
 *   pnpm i18n:detect --feature story
 *   pnpm i18n:detect --json
 *
 * Exit code 0 = clean, 1 = hits found, 2 = error.
 */
import { promises as fs } from "node:fs";
import path from "node:path";

export interface Hit {
  file: string;
  line: number;
  snippet: string;
  korean: string;
}

const KOREAN_RE = /[가-힣]/;
const IGNORE_DIRECTIVE = "i18n-ignore-next-line";

const SKIP_DIRS = new Set([
  "node_modules",
  "dist",
  "build",
  ".turbo",
  "coverage",
  "out",
  ".next",
  "raw",
  "locales",
]);

function isCodeFile(name: string): boolean {
  return /\.(tsx?|jsx?)$/.test(name);
}
function isTestFile(name: string): boolean {
  return /\.(test|spec)\.(tsx?|jsx?)$/.test(name);
}

async function* walk(dir: string): AsyncGenerator<string> {
  let entries: import("node:fs").Dirent[];
  try {
    entries = await fs.readdir(dir, { withFileTypes: true });
  } catch {
    return;
  }
  for (const e of entries) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) {
      if (SKIP_DIRS.has(e.name) || e.name.startsWith(".")) continue;
      yield* walk(p);
    } else if (e.isFile() && isCodeFile(e.name) && !isTestFile(e.name)) {
      yield p;
    }
  }
}

function isConsoleCallLine(line: string): boolean {
  return /\bconsole\.(log|warn|error|info|debug|trace)\s*\(/.test(line);
}

function isDataAttrContext(line: string, koreanIdx: number): boolean {
  const before = line.slice(Math.max(0, koreanIdx - 80), koreanIdx);
  return /\bdata-[a-zA-Z-]+\s*=\s*["'{`]?$/.test(before);
}

/**
 * 단일 소스 컨텐츠 스캔. fs 의존 없음 → 단위 테스트에서 직접 호출.
 */
export function scanSource(filePath: string, content: string): Hit[] {
  const hits: Hit[] = [];
  const lines = content.split("\n");
  let inBlockComment = false;

  for (let i = 0; i < lines.length; i++) {
    const raw = lines[i] ?? "";
    let line = raw;

    if (inBlockComment) {
      const end = line.indexOf("*/");
      if (end === -1) continue;
      line = line.slice(end + 2);
      inBlockComment = false;
    }
    while (true) {
      const start = line.indexOf("/*");
      if (start === -1) break;
      const end = line.indexOf("*/", start);
      if (end === -1) {
        inBlockComment = true;
        line = line.slice(0, start);
        break;
      }
      line = line.slice(0, start) + line.slice(end + 2);
    }
    const lineCommentIdx = line.indexOf("//");
    if (lineCommentIdx !== -1) line = line.slice(0, lineCommentIdx);

    const prev = lines[i - 1] ?? "";
    if (prev.includes(IGNORE_DIRECTIVE)) continue;
    if (isConsoleCallLine(line)) continue;

    const match = KOREAN_RE.exec(line);
    if (!match) continue;
    const idx = match.index;
    if (isDataAttrContext(line, idx)) continue;

    const koreanRun = line.slice(idx).match(/[가-힣][^"`'<>{}]*[가-힣]?/);
    hits.push({
      file: filePath,
      line: i + 1,
      snippet: raw.trim(),
      korean: koreanRun?.[0] ?? line[idx] ?? "",
    });
  }
  return hits;
}

export interface ScanOptions {
  root: string;
  feature?: string;
}

export async function scanRoot(opts: ScanOptions): Promise<Hit[]> {
  const targets = opts.feature
    ? [
        path.join(opts.root, "apps/app/src/features", opts.feature),
        path.join(opts.root, "apps/app/src/pages", opts.feature),
        path.join(opts.root, "packages/widgets/src", opts.feature),
      ]
    : [
        path.join(opts.root, "apps/app/src"),
        path.join(opts.root, "apps/admin/src"),
        path.join(opts.root, "packages/widgets/src"),
        path.join(opts.root, "packages/ui/src"),
      ];

  const hits: Hit[] = [];
  for (const target of targets) {
    try {
      const stat = await fs.stat(target);
      if (!stat.isDirectory()) continue;
    } catch {
      continue;
    }
    for await (const file of walk(target)) {
      const content = await fs.readFile(file, "utf8");
      hits.push(...scanSource(file, content));
    }
  }
  return hits;
}

interface CliArgs {
  feature?: string;
  json?: boolean;
  quiet?: boolean;
  root?: string;
}

function parseArgs(argv: string[]): CliArgs {
  const args: CliArgs = {};
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--feature") args.feature = argv[++i];
    else if (a === "--json") args.json = true;
    else if (a === "--quiet") args.quiet = true;
    else if (a === "--root") args.root = argv[++i];
  }
  return args;
}

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2));
  const root = args.root ?? process.cwd();
  const hits = await scanRoot({ root, feature: args.feature });
  if (args.json) {
    process.stdout.write(`${JSON.stringify(hits, null, 2)}\n`);
    process.exit(0);
  }
  if (hits.length === 0) {
    if (!args.quiet) console.log("[i18n:detect] 한글 리터럴 0건.");
    process.exit(0);
  }
  if (!args.quiet) {
    console.log(`[i18n:detect] 한글 리터럴 ${hits.length}건:`);
    for (const h of hits) {
      const rel = path.relative(root, h.file);
      console.log(`  ${rel}:${h.line}  ${h.korean.slice(0, 60)}`);
    }
  }
  process.exit(1);
}

const invokedDirectly =
  process.argv[1] !== undefined &&
  import.meta.url === new URL(`file://${path.resolve(process.argv[1])}`).href;

if (invokedDirectly) {
  main().catch((e) => {
    console.error(e);
    process.exit(2);
  });
}
