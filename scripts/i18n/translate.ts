#!/usr/bin/env tsx
/**
 * scripts/i18n/translate.ts
 *
 * ko.json (마스터) → en/ja/zh.json (자동 번역) — Anthropic SDK 호출.
 *
 * Usage:
 *   pnpm i18n:translate
 *   pnpm i18n:translate --feature story
 *   pnpm i18n:translate --feature story --target ja
 *   pnpm i18n:translate --key "common.brand"
 *   pnpm i18n:translate --force          # 기존 번역 덮어쓰기
 *   pnpm i18n:translate --dry            # 호출하지 않고 대상 키만 표시
 *
 * 요구: 환경변수 ANTHROPIC_API_KEY (dry 모드는 불필요).
 *
 * Exit code 0 = success, 1 = drift after run, 2 = error.
 */
import { promises as fs } from "node:fs";
import path from "node:path";

const TARGETS = ["en", "ja", "zh"] as const;
type Target = (typeof TARGETS)[number];

const MODEL = "claude-sonnet-4-6";

const SYSTEM_PROMPT = `당신은 Product Builder (SaaS product-building platform) 의 UI 번역가입니다.

- 사용자 = SaaS 빌더 / 제품 운영자
- 한국어 ko 가 마스터, en/ja/zh 번역
- 톤: 친근하지만 전문적, 군더더기 없이 명확
- 기술 용어는 필요한 만큼만 쓰고 제품 빌더가 이해하기 쉬운 표현 우선
- SaaS, 운영, 빌더 도구 맥락의 표준 용어 사용
- UI 요소: button label 짧게, tooltip/description 한 문장
- glossary 의 고유 명사는 반드시 매핑된 번역 사용
- Placeholder ({{name}}, {{count}}) 그대로 보존

응답은 반드시 다음 형식의 단일 JSON 객체로 출력합니다 (코드 펜스 금지):
{ "{key}": "{translated}", ... }
`;

const SKIP_DIRS = new Set([
  "node_modules",
  "dist",
  "build",
  ".turbo",
  "coverage",
  ".next",
]);

// ────────────────────────────────────────────────────────────────
// Pure helpers (테스트 대상)
// ────────────────────────────────────────────────────────────────

export type FlatLocale = Record<string, string>;

/**
 * 객체를 flat dot-key 맵으로 변환. JSON 파일이 이미 flat 이면 그대로 통과.
 */
export function flattenLocale(obj: unknown, prefix = ""): FlatLocale {
  const out: FlatLocale = {};
  if (typeof obj !== "object" || obj === null) return out;
  for (const [k, v] of Object.entries(obj)) {
    const full = prefix ? `${prefix}.${k}` : k;
    if (typeof v === "string") {
      out[full] = v;
    } else if (typeof v === "object" && v !== null) {
      Object.assign(out, flattenLocale(v, full));
    }
  }
  return out;
}

/**
 * 번역 대상 키 선정.
 *   - force = true → ko 전체.
 *   - force = false → existing 에 없거나 ko 값이 changed (마스터 hash 추적은 future) 인 키만.
 *   - keyFilter 가 있으면 prefix match 로 더 좁힌다.
 */
export function selectKeysToTranslate(
  ko: FlatLocale,
  existing: FlatLocale,
  opts: { force?: boolean; keyFilter?: string } = {},
): string[] {
  const all = Object.keys(ko);
  const filtered = opts.keyFilter
    ? all.filter((k) => k === opts.keyFilter || k.startsWith(`${opts.keyFilter}.`))
    : all;
  if (opts.force) return filtered;
  return filtered.filter((k) => !(k in existing));
}

export function applyTranslations(base: FlatLocale, translated: FlatLocale): FlatLocale {
  return { ...base, ...translated };
}

/**
 * LLM 응답에서 첫 번째 균형잡힌 JSON 객체를 추출. 코드 펜스 / 프로즈 wrapping 도 허용.
 * 따옴표 / 이스케이프 / 문자열 안의 중괄호를 정확히 처리.
 */
export function extractJsonObject(raw: string): string {
  const fenceMatch = raw.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const source = fenceMatch ? fenceMatch[1] : raw;
  const start = source.indexOf("{");
  if (start === -1) throw new Error("응답에 JSON 객체가 없음");
  let depth = 0;
  let inStr = false;
  let escaped = false;
  for (let i = start; i < source.length; i++) {
    const ch = source[i];
    if (escaped) {
      escaped = false;
      continue;
    }
    if (inStr) {
      if (ch === "\\") escaped = true;
      else if (ch === '"') inStr = false;
      continue;
    }
    if (ch === '"') {
      inStr = true;
      continue;
    }
    if (ch === "{") depth++;
    else if (ch === "}") {
      depth--;
      if (depth === 0) return source.slice(start, i + 1);
    }
  }
  throw new Error("응답 JSON 객체 균형이 맞지 않음");
}

// ────────────────────────────────────────────────────────────────
// Anthropic client wrapper — DI 가능
// ────────────────────────────────────────────────────────────────

export interface TranslateClient {
  translate(args: {
    target: Target;
    pairs: FlatLocale; // {key: koValue}
    glossary: Record<string, Record<Target, string>>;
  }): Promise<FlatLocale>; // {key: translatedValue}
}

async function createAnthropicClient(): Promise<TranslateClient> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    throw new Error(
      "ANTHROPIC_API_KEY 가 설정되어 있지 않습니다. --dry 모드 가 아니라면 필수입니다.",
    );
  }
  const mod = (await import("@anthropic-ai/sdk")) as typeof import("@anthropic-ai/sdk");
  const Anthropic = mod.default;
  const sdk = new Anthropic({ apiKey });
  return {
    async translate({ target, pairs, glossary }) {
      const glossarySection = Object.entries(glossary)
        .map(([ko, m]) => `- ${ko} → ${m[target]}`)
        .join("\n");
      const userPayload = JSON.stringify({ target, ko: pairs }, null, 2);
      const buildResponse = async (extraNudge: string) =>
        sdk.messages.create({
          model: MODEL,
          max_tokens: 16000,
          system: [
            { type: "text", text: SYSTEM_PROMPT, cache_control: { type: "ephemeral" } },
            {
              type: "text",
              text: `Glossary (target=${target}):\n${glossarySection}`,
              cache_control: { type: "ephemeral" },
            },
          ],
          messages: [
            {
              role: "user",
              content: `${userPayload}\n\nOutput JSON only. Start your response with { and end with }. ${extraNudge}`.trim(),
            },
          ],
        });

      let res = await buildResponse("");
      const tryParse = (resp: typeof res): FlatLocale | null => {
        const block = resp.content.find((b) => b.type === "text");
        if (!block || block.type !== "text") return null;
        try {
          const jsonText = extractJsonObject(block.text.trim());
          const parsed = JSON.parse(jsonText);
          if (typeof parsed === "object" && parsed !== null) return parsed as FlatLocale;
        } catch {}
        return null;
      };
      let parsed = tryParse(res);
      if (!parsed) {
        res = await buildResponse("(이전 응답에 JSON 이 없었습니다. 객체만 출력하세요.)");
        parsed = tryParse(res);
      }
      if (!parsed) throw new Error("응답에 JSON 객체가 없음 (2회 재시도)");
      const cleaned: FlatLocale = {};
      const pairKeys = new Set(Object.keys(pairs));
      const ingest = (rawKey: string, val: unknown): void => {
        if (typeof val === "string") {
          let k = rawKey;
          const langPrefix = k.match(/^(en|ja|zh|ko|target)\.(.+)$/);
          if (langPrefix) k = langPrefix[2];
          if (pairKeys.has(k)) cleaned[k] = val;
          return;
        }
        if (typeof val === "object" && val !== null) {
          for (const [innerKey, innerVal] of Object.entries(val)) {
            const fullKey = rawKey ? `${rawKey}.${innerKey}` : innerKey;
            ingest(fullKey, innerVal);
          }
        }
      };
      for (const [k, v] of Object.entries(parsed)) ingest(k, v);
      // 두번째 시도: outermost wrapper 가 언어 키일 때 (예: { "ja": { "entity.foo": ... } })
      if (Object.keys(cleaned).length === 0) {
        for (const [k, v] of Object.entries(parsed)) {
          if (typeof v === "object" && v !== null && /^(en|ja|zh|ko|target)$/.test(k)) {
            for (const [innerKey, innerVal] of Object.entries(v as Record<string, unknown>)) {
              ingest(innerKey, innerVal);
            }
          }
        }
      }
      return cleaned;
    },
  };
}

// ────────────────────────────────────────────────────────────────
// File walking
// ────────────────────────────────────────────────────────────────

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

async function readJsonOr(p: string, fallback: unknown): Promise<unknown> {
  try {
    return JSON.parse(await fs.readFile(p, "utf8"));
  } catch {
    return fallback;
  }
}

async function writeJson(p: string, value: unknown): Promise<void> {
  const sorted = sortKeys(value);
  await fs.writeFile(p, `${JSON.stringify(sorted, null, 2)}\n`);
}

function sortKeys(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(sortKeys);
  if (typeof value === "object" && value !== null) {
    const out: Record<string, unknown> = {};
    for (const k of Object.keys(value).sort()) {
      out[k] = sortKeys((value as Record<string, unknown>)[k]);
    }
    return out;
  }
  return value;
}

// ────────────────────────────────────────────────────────────────
// Core processing
// ────────────────────────────────────────────────────────────────

export interface ProcessLocaleDirOptions {
  dir: string;
  client: TranslateClient | null; // null → dry mode
  targets: readonly Target[];
  glossary: Record<string, Record<Target, string>>;
  force?: boolean;
  keyFilter?: string;
  log?: (msg: string) => void;
}

export interface ProcessResult {
  dir: string;
  perTarget: Record<Target, { translated: number; total: number; failed: number; dry: boolean }>;
}

export async function processLocaleDir(opts: ProcessLocaleDirOptions): Promise<ProcessResult> {
  const log =
    opts.log ??
    (() => {
      // no-op default — caller can pass a logger if they want progress output.
    });
  const koPath = path.join(opts.dir, "ko.json");
  const koObj = await readJsonOr(koPath, null);
  if (koObj === null) {
    throw new Error(`ko.json 없음 또는 파싱 실패: ${koPath}`);
  }
  const ko = flattenLocale(koObj);
  const perTarget: ProcessResult["perTarget"] = {
    en: { translated: 0, total: 0, failed: 0, dry: opts.client === null },
    ja: { translated: 0, total: 0, failed: 0, dry: opts.client === null },
    zh: { translated: 0, total: 0, failed: 0, dry: opts.client === null },
  };

  for (const target of opts.targets) {
    const targetPath = path.join(opts.dir, `${target}.json`);
    const existingObj = (await readJsonOr(targetPath, {})) as Record<string, unknown>;
    const existing = flattenLocale(existingObj);
    const toTranslate = selectKeysToTranslate(ko, existing, {
      force: opts.force,
      keyFilter: opts.keyFilter,
    });
    perTarget[target].total = toTranslate.length;
    if (toTranslate.length === 0) continue;
    if (opts.client === null) {
      log(`[dry] ${path.basename(opts.dir)} → ${target}: ${toTranslate.length}건`);
      continue;
    }
    const CHUNK = 20;
    let translatedAll: FlatLocale = {};
    for (let i = 0; i < toTranslate.length; i += CHUNK) {
      const slice = toTranslate.slice(i, i + CHUNK);
      const pairs: FlatLocale = {};
      for (const k of slice) pairs[k] = ko[k] ?? "";
      try {
        const translated = await opts.client.translate({
          target,
          pairs,
          glossary: opts.glossary,
        });
        translatedAll = { ...translatedAll, ...translated };
        log(
          `[chunk] ${path.basename(opts.dir)} → ${target}: ${i + slice.length}/${toTranslate.length}`,
        );
      } catch (err) {
        perTarget[target].failed += slice.length;
        log(
          `[warn] ${path.basename(opts.dir)} → ${target}: chunk ${i}-${i + slice.length} 실패 (${(err as Error).message}). 건너뜀.`,
        );
      }
    }
    const merged = applyTranslations(existing, translatedAll);
    await writeJson(targetPath, merged);
    perTarget[target].translated = Object.keys(translatedAll).length;
    log(`[ok] ${path.basename(opts.dir)} → ${target}: ${perTarget[target].translated}건 갱신`);
  }
  return { dir: opts.dir, perTarget };
}

// ────────────────────────────────────────────────────────────────
// CLI
// ────────────────────────────────────────────────────────────────

interface CliArgs {
  feature?: string;
  key?: string;
  force?: boolean;
  dry?: boolean;
  target?: Target;
  root?: string;
}

function parseArgs(argv: string[]): CliArgs {
  const args: CliArgs = {};
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--feature") args.feature = argv[++i];
    else if (a === "--key") args.key = argv[++i];
    else if (a === "--force") args.force = true;
    else if (a === "--dry") args.dry = true;
    else if (a === "--target") {
      const next = argv[++i] as Target;
      if (!TARGETS.includes(next)) throw new Error(`Invalid --target: ${next}`);
      args.target = next;
    } else if (a === "--root") args.root = argv[++i];
  }
  return args;
}

async function loadGlossary(root: string): Promise<Record<string, Record<Target, string>>> {
  const p = path.join(root, "scripts/i18n/glossary.json");
  const data = (await readJsonOr(p, {})) as Record<string, Record<Target, string>>;
  return data;
}

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2));
  const root = args.root ?? process.cwd();
  const glossary = await loadGlossary(root);

  const searchRoots = args.feature
    ? [
        path.join(root, "apps/app/src/features", args.feature),
        path.join(root, "apps/app/src/pages", args.feature),
        path.join(root, "packages/widgets/src", args.feature),
      ]
    : [
        path.join(root, "apps/app/src"),
        path.join(root, "packages/widgets/src"),
        path.join(root, "packages/ui/src"),
      ];

  const client: TranslateClient | null = args.dry ? null : await createAnthropicClient();
  const targets = args.target ? ([args.target] as const) : TARGETS;

  let totalChanged = 0;
  let totalFailed = 0;
  for (const r of searchRoots) {
    try {
      const stat = await fs.stat(r);
      if (!stat.isDirectory()) continue;
    } catch {
      continue;
    }
    for await (const dir of findLocaleDirs(r)) {
      const result = await processLocaleDir({
        dir,
        client,
        targets,
        glossary,
        force: args.force,
        keyFilter: args.key,
        log: (m) => console.log(m),
      });
      for (const t of targets) {
        totalChanged += result.perTarget[t].translated;
        totalFailed += result.perTarget[t].failed;
      }
    }
  }
  console.log(`[i18n:translate] ${args.dry ? "dry" : "live"} done — 갱신 ${totalChanged}건`);
  if (totalFailed > 0) {
    console.error(`[i18n:translate] FAILED — ${totalFailed}건 chunk 번역 실패. 재실행 필요.`);
    process.exit(3);
  }
  process.exit(0);
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
