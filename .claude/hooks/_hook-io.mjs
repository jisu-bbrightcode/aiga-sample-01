// 공유 hook I/O 헬퍼 — 모든 .mjs PreToolUse hook 공통.
// Claude Code PreToolUse 계약: stdin 으로 {"tool_name","tool_input":{...}} JSON.
// test 하네스 호환: file_path 없으면 TOOL_INPUT 환경변수 fallback.

import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import path from "node:path";

// stdin JSON 읽어 표준 필드 추출. tool_input.content || new_string 통합.
export async function readHookInput() {
  const raw = await new Promise((res) => {
    let d = "";
    process.stdin.on("data", (c) => (d += c));
    process.stdin.on("end", () => res(d));
    // stdin 이 닫혀있으면(없으면) 즉시 빈값
    if (process.stdin.isTTY) res("");
  });
  let json = {};
  try {
    json = JSON.parse(raw || "{}");
  } catch {
    /* 파싱 실패 → 빈 객체 */
  }
  const ti = json.tool_input || {};
  return {
    json,
    toolName: json.tool_name || "",
    filePath: ti.file_path || process.env.TOOL_INPUT || "",
    content: ti.content || ti.new_string || "",
    command: ti.command || "",
  };
}

// repo 루트 (git 실패 시 cwd).
export function repoRoot() {
  try {
    return execFileSync("git", ["rev-parse", "--show-toplevel"], {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
    }).trim();
  } catch {
    return process.cwd();
  }
}

// 현재 체크아웃 브랜치 ("" if 불가).
export function currentBranch() {
  try {
    return execFileSync("git", ["rev-parse", "--abbrev-ref", "HEAD"], {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
    }).trim();
  } catch {
    return "";
  }
}

// 절대/상대 경로를 repo 루트 기준 상대 경로로 정규화.
export function normalizeRel(filePath, root = repoRoot()) {
  if (!filePath) return "";
  const abs = path.isAbsolute(filePath)
    ? path.normalize(filePath)
    : path.normalize(path.join(root, filePath));
  return abs.startsWith(root + path.sep) ? abs.slice(root.length + 1) : abs;
}

// content 비었고 파일 존재하면 디스크에서 읽어 fallback.
export function contentOrFile(content, filePath) {
  if (content) return content;
  try {
    return filePath ? readFileSync(filePath, "utf8") : "";
  } catch {
    return "";
  }
}

// --- 출력 계약 (각 hook 의 기존 shape 보존용) ---
// decision 스타일 (Edit|Write hooks 대부분):
export function emitAllow(reason = "ok") {
  process.stdout.write(JSON.stringify({ decision: "allow", reason }));
  process.exit(0);
}
export function emitBlock(reason) {
  process.stdout.write(JSON.stringify({ decision: "block", reason }));
  process.exit(0);
}
// continue 스타일 (db-destructive / main-direct-merge):
export function emitContinue() {
  process.stdout.write(JSON.stringify({ continue: true }));
  process.exit(0);
}
export function emitStop(stopReason) {
  process.stdout.write(JSON.stringify({ continue: false, stopReason }));
  process.exit(0);
}
