#!/usr/bin/env tsx
/**
 * scripts/i18n/verify-keys.ts
 *
 * 4언어 (ko/en/ja/zh) JSON 키 셋이 일치하는지 검증.
 *
 * 디렉토리 패턴: **\/locales/{ko,en,ja,zh}.json
 *
 * Usage:
 *   pnpm i18n:verify
 *   pnpm i18n:verify --feature story
 *   pnpm i18n:verify --json
 *
 * Exit code 0 = clean, 1 = drift, 2 = error.
 */
import { promises as fs } from "node:fs";
import path from "node:path";

const TARGETS = ["en", "ja", "zh"] as const;
type Target = (typeof TARGETS)[number];

const SKIP_DIRS = new Set([
  "node_modules",
  "dist",
  "build",
  ".turbo",
  "coverage",
  ".next",
]);

/**
 * 객체 트리를 flatten — leaf 가 문자열인 키 경로를 수집.
 * 키가 이미 dot-separated 라도 정상 동작 (그대로 키 이름으로 취급).
 */
export function flattenKeys(obj: unknown, prefix = ""): string[] {
  if (typeof obj !== "object" || obj === null) return [];
  const keys: string[] = [];
  for (const [k, v] of Object.entries(obj)) {
    const full = prefix ? `${prefix}.${k}` : k;
    if (typeof v === "string") {
      keys.push(full);
    } else if (typeof v === "object" && v !== null) {
      keys.push(...flattenKeys(v, full));
    }
  }
  return keys;
}

export interface DriftReport {
  dir: string;
  master: number;
  missing: Record<Target, string[]>;
  extra: Record<Target, string[]>;
}

export function diffKeys(
  masterKeys: string[],
  otherKeys: string[],
): { missing: string[]; extra: string[] } {
  const masterSet = new Set(masterKeys);
  const otherSet = new Set(otherKeys);
  const missing = masterKeys.filter((k) => !otherSet.has(k));
  const extra = otherKeys.filter((k) => !masterSet.has(k));
  return { missing, extra };
}

async function readJson(p: string): Promise<unknown | null> {
  try {
    const text = await fs.readFile(p, "utf8");
    return JSON.parse(text);
  } catch {
    return null;
  }
}

async function* findLocaleDirs(root: string): AsyncGenerator<string> {
  let entries: import("node:fs").Dirent[];
  try {
    entries = await fs.readdir(root, { withFileTypes: true });
  } catch {
    return;
  }
  for (const e of entries) {
    const p = path.join(root, e.name);
    if (!e.isDirectory()) continue;
    if (SKIP_DIRS.has(e.name) || e.name.startsWith(".")) continue;
    if (e.name === "locales") {
      yield p;
      continue;
    }
    yield* findLocaleDirs(p);
  }
}

export interface VerifyOptions {
  root: string;
  feature?: string;
}

export async function verifyRoot(opts: VerifyOptions): Promise<DriftReport[]> {
  const roots = opts.feature
    ? [
        path.join(opts.root, "apps/app/src/features", opts.feature),
        path.join(opts.root, "apps/app/src/pages", opts.feature),
        path.join(opts.root, "packages/widgets/src", opts.feature),
      ]
    : [
        path.join(opts.root, "apps/app/src"),
        path.join(opts.root, "packages/widgets/src"),
        path.join(opts.root, "packages/ui/src"),
      ];

  const reports: DriftReport[] = [];
  for (const r of roots) {
    try {
      const stat = await fs.stat(r);
      if (!stat.isDirectory()) continue;
    } catch {
      continue;
    }
    for await (const dir of findLocaleDirs(r)) {
      const koPath = path.join(dir, "ko.json");
      const ko = await readJson(koPath);
      if (ko === null) continue;
      const koKeys = flattenKeys(ko);
      const missing: Record<Target, string[]> = { en: [], ja: [], zh: [] };
      const extra: Record<Target, string[]> = { en: [], ja: [], zh: [] };
      for (const t of TARGETS) {
        const data = (await readJson(path.join(dir, `${t}.json`))) ?? {};
        const tKeys = flattenKeys(data);
        const d = diffKeys(koKeys, tKeys);
        missing[t] = d.missing;
        extra[t] = d.extra;
      }
      const hasDrift = TARGETS.some((t) => missing[t].length > 0 || extra[t].length > 0);
      if (hasDrift || opts.feature) {
        reports.push({ dir, master: koKeys.length, missing, extra });
      }
    }
  }
  return reports;
}

interface CliArgs {
  feature?: string;
  json?: boolean;
  root?: string;
}

function parseArgs(argv: string[]): CliArgs {
  const args: CliArgs = {};
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--feature") args.feature = argv[++i];
    else if (a === "--json") args.json = true;
    else if (a === "--root") args.root = argv[++i];
  }
  return args;
}

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2));
  const root = args.root ?? process.cwd();
  const reports = await verifyRoot({ root, feature: args.feature });
  const drift = reports.filter((r) =>
    TARGETS.some((t) => r.missing[t].length > 0 || r.extra[t].length > 0),
  );
  if (args.json) {
    process.stdout.write(`${JSON.stringify(reports, null, 2)}\n`);
    process.exit(drift.length > 0 ? 1 : 0);
  }
  if (drift.length === 0) {
    console.log("[i18n:verify] 4언어 키 셋 일치.");
    process.exit(0);
  }
  console.log(`[i18n:verify] 키 drift ${drift.length} locale 디렉토리:`);
  for (const r of drift) {
    const rel = path.relative(root, r.dir);
    console.log(`  ${rel}  (ko ${r.master} keys)`);
    for (const t of TARGETS) {
      if (r.missing[t].length > 0)
        console.log(
          `    ${t} missing(${r.missing[t].length}): ${r.missing[t].slice(0, 5).join(", ")}${r.missing[t].length > 5 ? " ..." : ""}`,
        );
      if (r.extra[t].length > 0)
        console.log(
          `    ${t} extra(${r.extra[t].length}): ${r.extra[t].slice(0, 5).join(", ")}${r.extra[t].length > 5 ? " ..." : ""}`,
        );
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
