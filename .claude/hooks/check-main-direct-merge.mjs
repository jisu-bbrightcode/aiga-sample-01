#!/usr/bin/env node
// main 직접 변경 차단 hook — 룰: develop → main 은 GitHub PR 머지로만 허용.
//
// 차단 대상 (claude/codex agent 의 Bash git 명령):
//   1. main 으로 직접 push      (git push ... main / HEAD:main / x:main, main 체크아웃 상태 push)
//   2. main 에서 직접 commit     (main 체크아웃 상태 git commit)
//   3. main 에 로컬 merge        (main 체크아웃 상태 git merge)
//   --no-verify 우회 시도도 동일 차단 (husky 우회 방지).
//
// stdin JSON: {"tool_name":"Bash","tool_input":{"command":"..."}}
// stdout    : {"continue":true} 허용 / {"continue":false,"stopReason":"..."} 차단
import { execFileSync } from "node:child_process";

const allow = () => {
  process.stdout.write(JSON.stringify({ continue: true }));
  process.exit(0);
};
const block = (reason) => {
  process.stdout.write(JSON.stringify({ continue: false, stopReason: reason }));
  process.exit(0);
};

const raw = await new Promise((res) => {
  let d = "";
  process.stdin.on("data", (c) => (d += c));
  process.stdin.on("end", () => res(d));
});

let cmd = "";
try {
  cmd = JSON.parse(raw)?.tool_input?.command ?? "";
} catch {
  /* 파싱 실패 → 통과 */
}
if (!cmd || !/\bgit\b/.test(cmd)) allow();

// 읽기 전용 / 무해 git 서브커맨드는 통과
if (
  /^\s*git\s+(status|log|show|diff|blame|fetch|remote|branch|checkout|switch|pull|stash|tag|describe|rev-parse|config|reflog|cherry|shortlog|ls-files|ls-remote)\b/.test(
    cmd,
  )
) {
  allow();
}

let branch = "";
try {
  branch = execFileSync("git", ["rev-parse", "--abbrev-ref", "HEAD"], {
    encoding: "utf8",
    stdio: ["ignore", "pipe", "ignore"],
  }).trim();
} catch {
  /* git repo 아님 → branch 미상 */
}

const isPush = /\bgit\s+push\b/.test(cmd);
const isCommit = /\bgit\s+commit\b/.test(cmd);
const isMerge = /\bgit\s+merge\b/.test(cmd);

// push 가 main 을 목적지로 하는지 정확 판정.
// `git push [flags] [remote] [refspec...]` — flag(- 시작) 제외한 위치 토큰을 본다.
// 첫 위치 토큰 = remote, 그 뒤 = refspec 들. refspec 의 목적지(콜론 뒤, 없으면 토큰 자체)가 main 이면 차단.
// 위치 refspec 이 없으면(bare push / remote-only) 현재 브랜치를 push → HEAD==main 일 때만 차단.
function pushTargetsMain() {
  const m = cmd.match(/\bgit\s+push\b(.*)$/s);
  if (!m) return false;
  // 세미콜론/&& 등 뒤따르는 다음 명령은 잘라낸다
  const tail = m[1].split(/[;&|]/)[0];
  const tokens = tail.trim().split(/\s+/).filter(Boolean);
  const positional = tokens.filter((t) => !t.startsWith("-"));
  // positional[0] = remote, 나머지 = refspec
  const refspecs = positional.slice(1);
  const destIsMain = (r) => {
    const dest = r.includes(":") ? r.split(":").pop() : r;
    return dest === "main" || dest === "refs/heads/main";
  };
  if (refspecs.length > 0) return refspecs.some(destIsMain);
  return branch === "main"; // refspec 없음 → 현재 브랜치 push
}

// 1) main 직접 push
if (isPush && pushTargetsMain()) {
  block(
    `⛔ main 직접 push 차단 — develop → main 은 GitHub PR 머지로만 진행. 현재 브랜치:[${branch || "?"}]. feature/develop 에 push 후 PR 생성하세요. (의도적 차단)`,
  );
}

// 2) main 에서 직접 commit
if (branch === "main" && isCommit) {
  block(
    "⛔ main 직접 commit 차단 — main 에서 직접 작업 금지. develop(또는 feature) 브랜치로 전환 후 작업하고 PR 로 main 에 머지하세요.",
  );
}

// 3) main 에 로컬 merge
if (branch === "main" && isMerge) {
  block(
    "⛔ main 로컬 merge 차단 — develop → main 은 GitHub PR 로만 머지. 로컬에서 main 에 직접 merge 하지 마세요.",
  );
}

allow();
