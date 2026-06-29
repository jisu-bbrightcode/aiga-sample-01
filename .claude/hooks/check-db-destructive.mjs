#!/usr/bin/env node
// 파괴적 DB 작업 차단 hook — 규칙: docs/rules/backend/db-safety.md
// stdin JSON: {"tool_name":"Bash","tool_input":{"command":"..."}}
import { readFileSync } from "node:fs";
import { emitContinue, emitStop, readHookInput, repoRoot } from "./_hook-io.mjs";

const { command: CMD } = await readHookInput();

if (!CMD) {
  emitContinue();
}

// 텍스트 전달 명령(git commit / log / show / diff, echo, cat, grep, rg, printf 등)은
// 메시지/파일 내용에 파괴적 키워드가 literal 로 있어도 실행이 아니므로 bypass
if (
  /^\s*(?:git\s+(?:commit|log|show|diff|blame)|echo|printf|cat|head|tail|grep|rg|awk|sed)\b/.test(
    CMD,
  )
) {
  emitContinue();
}

let destructive = false;
let pattern = "";

if (/drizzle-kit\s+(?:push|drop)(\b|$)/.test(CMD)) {
  destructive = true;
  pattern = "drizzle-kit push/drop";
}
if (/db:(?:push|drop|reset)\b/.test(CMD)) {
  destructive = true;
  pattern = "pnpm db:push/drop/reset";
}
if (
  /DROP\s+(?:TABLE|SCHEMA|DATABASE)|TRUNCATE\s+TABLE|ALTER\s+TABLE\s+\S+\s+DROP\s+COLUMN/i.test(CMD)
) {
  destructive = true;
  pattern = "raw SQL DROP/TRUNCATE/ALTER DROP";
}
if (/DELETE\s+FROM\s+\S+/i.test(CMD) && !/WHERE/i.test(CMD)) {
  destructive = true;
  pattern = "DELETE FROM without WHERE";
}

if (!destructive) {
  emitContinue();
}

// Resolve DATABASE_URL
const ROOT = repoRoot();
let currentDbUrl = process.env.DATABASE_URL || "";
if (!currentDbUrl) {
  try {
    const envLocal = readFileSync(`${ROOT}/.env.local`, "utf8");
    const match = envLocal.match(/^DATABASE_URL=(.+)$/m);
    if (match) currentDbUrl = match[1].trim().replace(/^"|"$/g, "");
  } catch {
    /* no .env.local */
  }
}

let currentHost = "";
if (currentDbUrl) {
  const m = currentDbUrl.match(/^[a-z]+:\/\/[^@]*@([^:/]+)/);
  if (m) currentHost = m[1];
}

// Check prod hosts
const prodHostsFile = `${ROOT}/.claude/state/prod-db-hosts.txt`;
let isProd = false;
if (currentHost) {
  try {
    const lines = readFileSync(prodHostsFile, "utf8").split("\n");
    for (const line of lines) {
      const h = line.trim();
      if (!h || h.startsWith("#")) continue;
      if (h === currentHost) {
        isProd = true;
        break;
      }
    }
  } catch {
    /* file missing → not prod */
  }
}

if (isProd) {
  const reason = `⛔ 운영 DB 파괴적 작업 차단 — 패턴:[${pattern}] 호스트:[${currentHost}](운영). 운영에는 절대 db:push/reset/drop/raw DROP 금지. 스키마 변경은 db:generate → 리뷰 → db:migrate. 규칙: docs/rules/backend/db-safety.md`;
  emitStop(reason);
}

if ((process.env.PRODUCT_BUILDER_DB_ALLOW_DESTRUCTIVE || "0") !== "1") {
  const reason = `⛔ 파괴적 DB 작업에 명시적 허용 필요 — 패턴:[${pattern}] 호스트:[${currentHost || "unknown"}]. 개발 DB에서 실행하려면 PRODUCT_BUILDER_DB_ALLOW_DESTRUCTIVE=1 을 앞에 붙이세요. 운영이면 절대 금지. 규칙: docs/rules/backend/db-safety.md`;
  emitStop(reason);
}

emitContinue();
