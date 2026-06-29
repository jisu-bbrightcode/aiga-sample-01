// @ts-nocheck
/**
 * danger-gate.ts
 *
 * pi extension — 위험 동작 차단 + 사용자 승인 게이트.
 *
 * 동작 원리:
 *   1. `bash` / `write` / `edit` 툴 호출 직전 (tool_call 이벤트) 가로채기
 *   2. 위험 패턴 매칭 (FS rm/mv/chmod, DB DROP/TRUNCATE/DELETE-no-WHERE, Git destructive, 배포/네트워크)
 *   3. UI 가능하면 `ctx.ui.confirm()` 으로 승인 다이얼로그
 *      - 승인 → 통과
 *      - 거부 → block + reason
 *   4. UI 불가 (RPC/print) 또는 타임아웃 → 무조건 block
 *
 * 강화 포인트:
 *   - bash 명령은 chained command (; && || | $() ``) 까지 분해해서 검사
 *   - psql/mysql -c, drizzle CLI, sequelize 등 DB 도구 명시적 처리
 *   - DELETE FROM ... 에 WHERE 가 없으면 위험
 *   - rm -rf / mv 절대경로 / chmod 777 등 FS 위험
 *
 * 예외:
 *   - 명시적으로 안전한 경로 (./tmp, ./.cache, ./node_modules, ./dist, ./build, ./graphify-out*) 에 대한 rm 은 안내만
 *
 * 환경변수:
 *   - DANGER_GATE_DISABLED=1 → 게이트 완전 비활성 (디버깅용)
 *   - DANGER_GATE_AUTOAPPROVE=1 → 모든 승인 자동 통과 (CI 전용, 비권장)
 */

import type {
  ExtensionAPI,
  ExtensionContext,
  ToolCallEvent,
} from "@earendil-works/pi-coding-agent";

// ─── 분류 ──────────────────────────────────────────────────────────────────
type Category = "fs" | "db" | "git" | "net";

interface Hit {
  category: Category;
  rule: string;
  detail: string;
  severity: "critical" | "high";
  hardBlock?: true;
}

// ─── FS 패턴 ───────────────────────────────────────────────────────────────
const FS_SAFE_TARGETS =
  /^(?:\.\/)?(?:tmp|\.cache|\.tmp|node_modules|dist|build|\.next|\.turbo|coverage|graphify-out|graphify-out-engine)(?:\/|$)/;

function checkFs(cmd: string): Hit | null {
  // rm -rf / rm -r / rm -fr
  const rm = cmd.match(
    /\brm\s+(-[a-zA-Z]*[rfRF][a-zA-Z]*\s+|--recursive\s+|--force\s+)+([^\s;&|]+)/,
  );
  if (rm) {
    const target = rm[2];
    // 매우 위험: / , $HOME , ~ , .. 시작
    if (/^(\/|~|\$HOME|\.\.\/)/.test(target)) {
      return {
        category: "fs",
        rule: "rm-recursive-system-path",
        detail: `rm 재귀 + 시스템/홈 경로 (${target})`,
        severity: "critical",
      };
    }
    // 안전한 빌드 산출물은 통과
    if (FS_SAFE_TARGETS.test(target.replace(/^['"]|['"]$/g, ""))) return null;
    return {
      category: "fs",
      rule: "rm-recursive",
      detail: `rm 재귀 (${target})`,
      severity: "high",
    };
  }

  // chmod 777 / chown -R / setuid 비슷한 권한 확대
  if (/\bchmod\s+(-R\s+)?[0-7]?777\b/.test(cmd)) {
    return {
      category: "fs",
      rule: "chmod-777",
      detail: "chmod 777 (전체 권한 부여)",
      severity: "high",
    };
  }
  if (/\bchown\s+-R\b/.test(cmd)) {
    return { category: "fs", rule: "chown-recursive", detail: "chown 재귀", severity: "high" };
  }

  // mv 가 시스템/홈 경로를 덮어쓰기
  const mv = cmd.match(/\bmv\s+(?:-[a-zA-Z]+\s+)*([^\s;&|]+)\s+([^\s;&|]+)/);
  if (mv) {
    const dst = mv[2];
    if (/^(\/(?:bin|etc|usr|var|System|Library)\b|~|\$HOME)/.test(dst)) {
      return {
        category: "fs",
        rule: "mv-system-path",
        detail: `mv 대상이 시스템 경로 (${dst})`,
        severity: "critical",
      };
    }
  }

  // > 또는 >> 로 시스템 파일 덮어쓰기
  if (/>\s*\/(?:etc|usr|var|System|Library)\//.test(cmd)) {
    return {
      category: "fs",
      rule: "redirect-system",
      detail: "시스템 경로로 리다이렉트",
      severity: "critical",
    };
  }

  // dd / mkfs / fdisk 류
  if (/\b(dd|mkfs(?:\.[a-z0-9]+)?|fdisk|diskutil\s+erase)\b/.test(cmd)) {
    return {
      category: "fs",
      rule: "disk-tool",
      detail: "디스크 직접 조작 도구",
      severity: "critical",
    };
  }

  return null;
}

// ─── DB 패턴 ───────────────────────────────────────────────────────────────
function checkDb(cmd: string): Hit | null {
  // SQL 본문 추출: psql -c "...", mysql -e "...", `<<EOF ... EOF`, drizzle-kit push 등
  const sqlChunks: string[] = [];

  const quoted = cmd.matchAll(/-[ce]\s+(['"])([\s\S]*?)\1/g);
  for (const m of quoted) sqlChunks.push(m[2]);

  const heredoc = cmd.match(/<<[-]?\s*['"]?(\w+)['"]?\s*([\s\S]*?)\n\s*\1\b/);
  if (heredoc) sqlChunks.push(heredoc[2]);

  // 명령 안에 SQL 키워드가 그냥 박혀있을 때 (echo "DROP TABLE x" | psql)
  sqlChunks.push(cmd);

  const sql = sqlChunks.join("\n").toUpperCase();

  if (/\bDROP\s+(TABLE|DATABASE|SCHEMA|INDEX|VIEW)\b/.test(sql)) {
    return {
      category: "db",
      rule: "drop-ddl",
      detail: "DROP TABLE/DATABASE/SCHEMA/INDEX/VIEW",
      severity: "critical",
    };
  }
  if (/\bTRUNCATE\s+(TABLE\s+)?\w+/.test(sql)) {
    return { category: "db", rule: "truncate", detail: "TRUNCATE", severity: "critical" };
  }
  // DELETE 인데 WHERE 가 없으면 위험
  const deletes = sql.match(/\bDELETE\s+FROM\s+[^\s;]+(?:\s+[^;]*)?/g) || [];
  for (const d of deletes) {
    if (!/\bWHERE\b/.test(d)) {
      return {
        category: "db",
        rule: "delete-no-where",
        detail: `WHERE 없는 DELETE (${d.slice(0, 80)})`,
        severity: "critical",
      };
    }
  }
  // UPDATE WHERE 없음
  const updates = sql.match(/\bUPDATE\s+\w+\s+SET\s+[^;]+/g) || [];
  for (const u of updates) {
    if (!/\bWHERE\b/.test(u)) {
      return {
        category: "db",
        rule: "update-no-where",
        detail: `WHERE 없는 UPDATE (${u.slice(0, 80)})`,
        severity: "critical",
      };
    }
  }

  // drizzle / prisma destructive
  if (
    /\bdrizzle-kit\s+(drop|push)\b/.test(cmd) ||
    /\bprisma\s+migrate\s+(reset|deploy\s+--force)\b/.test(cmd)
  ) {
    return {
      category: "db",
      rule: "orm-destructive",
      detail: "drizzle-kit drop/push 또는 prisma migrate reset",
      severity: "high",
    };
  }

  // pg_dump 는 안전, 그러나 pg_restore --clean 은 위험
  if (/\bpg_restore\b[^;]*--clean\b/.test(cmd)) {
    return {
      category: "db",
      rule: "pg-restore-clean",
      detail: "pg_restore --clean (기존 객체 DROP)",
      severity: "high",
    };
  }

  return null;
}

// ─── Git destructive ──────────────────────────────────────────────────────
function shellTokens(cmd: string): string[] {
  return Array.from(cmd.matchAll(/"([^"]*)"|'([^']*)'|(\S+)/g), (m) => m[1] ?? m[2] ?? m[3]);
}

function isGitForcePush(cmd: string): boolean {
  const tokens = shellTokens(cmd);
  for (let i = 0; i < tokens.length; i += 1) {
    if (tokens[i] !== "git") continue;

    const pushIndex = tokens.indexOf("push", i + 1);
    if (pushIndex === -1) continue;

    const args = tokens.slice(pushIndex + 1);
    if (args.some((arg) => arg === "--force" || arg.startsWith("--force-with-lease"))) {
      return true;
    }
    if (args.some((arg) => /^-[A-Za-z]*f[A-Za-z]*$/.test(arg))) return true;
    if (args.some((arg) => arg.startsWith("+") && arg.length > 1)) return true;
  }
  return false;
}

function checkGit(cmd: string): Hit | null {
  if (isGitForcePush(cmd)) {
    return {
      category: "git",
      rule: "git-push-force-hard-block",
      detail:
        "git force-push is never allowed (--force, -f, --force-with-lease, leading + refspec)",
      severity: "critical",
      hardBlock: true,
    };
  }
  if (/\bgit\s+reset\s+--hard\b/.test(cmd)) {
    return {
      category: "git",
      rule: "git-reset-hard",
      detail: "git reset --hard (작업 손실)",
      severity: "high",
    };
  }
  if (/\bgit\s+clean\s+-[a-z]*[fd][a-z]*\b/.test(cmd)) {
    return {
      category: "git",
      rule: "git-clean",
      detail: "git clean -fd (untracked 삭제)",
      severity: "high",
    };
  }
  if (/\bgit\s+branch\s+-D\b/.test(cmd)) {
    return {
      category: "git",
      rule: "git-branch-D",
      detail: "git branch -D (강제 삭제)",
      severity: "high",
    };
  }
  if (/\bgit\s+push\b[^;]*--delete\b/.test(cmd) || /\bgit\s+push\s+\S+\s+:[\w./-]+/.test(cmd)) {
    return {
      category: "git",
      rule: "git-push-delete",
      detail: "원격 브랜치 삭제",
      severity: "high",
    };
  }
  if (/\bgit\s+push\b/.test(cmd) && /\b(main|master)\b/.test(cmd)) {
    return {
      category: "git",
      rule: "git-push-protected-branch",
      detail: "main/master 브랜치에 직접 push 금지 — PR/MR 워크플로우를 사용하세요",
      severity: "critical",
    };
  }
  if (/\bgit\s+(filter-branch|filter-repo|update-ref\s+-d)\b/.test(cmd)) {
    return {
      category: "git",
      rule: "git-history-rewrite",
      detail: "히스토리 재작성",
      severity: "critical",
    };
  }
  return null;
}

// ─── 네트워크 / 배포 ──────────────────────────────────────────────────────
function checkNet(cmd: string): Hit | null {
  // curl | sh, wget | bash
  if (/\b(curl|wget)\b[^|;]*\|\s*(sh|bash|zsh|python|node)\b/.test(cmd)) {
    return {
      category: "net",
      rule: "curl-pipe-sh",
      detail: "원격 스크립트 직접 실행 (curl | sh)",
      severity: "critical",
    };
  }
  // kubectl destructive
  if (/\bkubectl\s+(delete|drain|cordon)\b/.test(cmd)) {
    return {
      category: "net",
      rule: "kubectl-destructive",
      detail: "kubectl delete/drain/cordon",
      severity: "high",
    };
  }
  if (/\bkubectl\b[^;]*--context[= ]\S*prod/.test(cmd) || /\bkubectl\b[^;]*-n\s+prod\b/.test(cmd)) {
    return {
      category: "net",
      rule: "kubectl-prod",
      detail: "kubectl 프로덕션 컨텍스트",
      severity: "critical",
    };
  }
  // terraform apply/destroy
  if (/\bterraform\s+(destroy|apply)\b/.test(cmd)) {
    return {
      category: "net",
      rule: "terraform",
      detail: "terraform apply/destroy",
      severity: "high",
    };
  }
  // aws s3 rm / aws ec2 terminate
  if (/\baws\s+s3\s+rm\b/.test(cmd) || /\baws\s+ec2\s+terminate-instances\b/.test(cmd)) {
    return {
      category: "net",
      rule: "aws-destructive",
      detail: "aws 리소스 삭제",
      severity: "critical",
    };
  }
  // docker system prune, volume rm
  if (/\bdocker\s+(system\s+prune|volume\s+rm|image\s+prune)\b/.test(cmd)) {
    return {
      category: "net",
      rule: "docker-prune",
      detail: "docker prune/volume rm",
      severity: "high",
    };
  }
  // vercel / netlify 직접 배포 전면 차단 — 반드시 git 워크플로우 (push → CI/CD) 사용
  const vercelMatch = cmd.match(
    /\b(?:npx\s+|pnpm\s+(?:dlx|exec)\s+|yarn\s+(?:dlx|exec)\s+|bunx\s+)?(vercel|netlify)\b(.*)$/m,
  );
  if (vercelMatch) {
    const tool = vercelMatch[1];
    const rest = (vercelMatch[2] ?? "").trim();
    // readonly / 세팅 명령은 허용 (배포와 무관)
    const READONLY =
      /^(?:--version|-v|--help|-h|help|whoami|login|logout|switch|teams\b|projects\b|env\b(?!.*\b(?:rm|remove)\b)|env\s+pull|env\s+ls|domains\s+(?:ls|inspect)|certs\s+ls|inspect\b|logs\b|list\b|ls\b|link\b|pull\b|open\b|status\b|sites:list|api:list)/;
    // 명시적 배포/상태변경 키워드
    const DEPLOY =
      /(^|\s)(deploy\b|build\b|--prod\b|promote\b|rollback\b|alias\b|redeploy\b|sites:create\b|env\s+(?:add|rm|remove)\b|domains\s+(?:add|rm|remove)\b)/;
    const isReadonly = READONLY.test(rest);
    // 명시적 대움이 deploy/build/--prod/promote/rollback 등이면 강제 차단
    const isExplicitDeploy = DEPLOY.test(rest);
    // rest 가 비어있거나 (기본 deploy) 일반 인자만 있으면 차단
    const isBareInvocation = rest === "" || /^[^-]/.test(rest);
    if (isExplicitDeploy || (!isReadonly && isBareInvocation)) {
      return {
        category: "net",
        rule: "direct-deploy-forbidden",
        detail:
          `${tool} 직접 실행 차단. 반드시 git 워크플로우를 사용하세요: ` +
          `commit → push → PR → CI/CD 로 자동 배포. ` +
          `로컬 프리뷰가 필요하면 개발 서버 (pnpm dev) 를 쓰세요.`,
        severity: "critical",
      };
    }
  }
  return null;
}

// ─── bash 명령 분해 (chained) ──────────────────────────────────────────────
function splitChained(cmd: string): string[] {
  // ;  &&  ||  |  $(...)  `...`  내부를 모두 분리해서 각각 검사
  const parts: string[] = [];
  // 간단히 ; && || | 로 split (정밀 파싱은 과해서 의도적으로 생략)
  for (const piece of cmd.split(/(?:;|&&|\|\||(?<!\|)\|(?!\|))/)) {
    parts.push(piece.trim());
  }
  // $() 와 `` 내부 추출
  for (const m of cmd.matchAll(/\$\(([^()]+)\)/g)) parts.push(m[1]);
  for (const m of cmd.matchAll(/`([^`]+)`/g)) parts.push(m[1]);
  return parts.filter(Boolean);
}

export function scanCommand(cmd: string): Hit | null {
  // 네트워크 패턴 (curl | sh 등)은 파이프 자체가 의미이므로 원본을 먼저 검사
  const netWhole = checkNet(cmd);
  if (netWhole) return netWhole;
  for (const piece of splitChained(cmd)) {
    const hit = checkFs(piece) || checkDb(piece) || checkGit(piece) || checkNet(piece);
    if (hit) return hit;
  }
  return null;
}

// ─── 진입점 ────────────────────────────────────────────────────────────────
const ICON: Record<Category, string> = { fs: "📁", db: "🗄️ ", git: "🌿", net: "🌐" };
const LABEL: Record<Category, string> = {
  fs: "파일시스템",
  db: "데이터베이스",
  git: "Git",
  net: "네트워크/배포",
};

function buildConfirmMessage(hit: Hit, cmd: string): { title: string; message: string } {
  const sev = hit.severity === "critical" ? "🛑 CRITICAL" : "⚠️  HIGH";
  const title = `${sev} ${ICON[hit.category]} ${LABEL[hit.category]} 위험 동작 승인`;
  const message =
    `규칙: ${hit.rule}\n` +
    `사유: ${hit.detail}\n\n` +
    `명령:\n  ${cmd.length > 400 ? `${cmd.slice(0, 400)}…` : cmd}\n\n` +
    `이 동작은 되돌릴 수 없을 수 있습니다. 진행할까요?`;
  return { title, message };
}

export async function gate(
  event: ToolCallEvent,
  ctx: ExtensionContext,
): Promise<{ block: true; reason: string } | undefined> {
  if (process.env.DANGER_GATE_DISABLED === "1") return undefined;

  // bash 만 검사 (write/edit 은 다른 게이트들이 처리)
  if (event.toolName !== "bash") return undefined;
  const cmd = (event.input?.command as string) ?? "";
  if (!cmd) return undefined;

  const hit = scanCommand(cmd);
  if (!hit) return undefined;

  if (hit.hardBlock) {
    return {
      block: true,
      reason:
        `[danger-gate] hard-block: 이 명령은 승인으로도 실행할 수 없습니다.\n` +
        `규칙: ${hit.rule} / 사유: ${hit.detail}\n` +
        `안전한 대안: 새 커밋을 만들거나 PR/MR 워크플로우로 복구하세요.`,
    };
  }

  // CI 자동 승인
  if (process.env.DANGER_GATE_AUTOAPPROVE === "1") {
    ctx.ui?.notify?.(`[danger-gate] auto-approved: ${hit.rule}`, "warning");
    return undefined;
  }

  const { title, message } = buildConfirmMessage(hit, cmd);

  // UI 없으면 무조건 block
  if (!ctx.hasUI) {
    return {
      block: true,
      reason:
        `[danger-gate] 위험 동작 차단 (비대화형 모드).\n` +
        `규칙: ${hit.rule} / 사유: ${hit.detail}\n` +
        `사용자에게 직접 실행을 요청하거나, DANGER_GATE_AUTOAPPROVE=1 로 우회하세요.`,
    };
  }

  try {
    const approved = await ctx.ui.confirm(title, message, { timeout: 120_000 });
    if (approved) {
      ctx.ui.notify?.(`[danger-gate] approved: ${hit.rule}`, "info");
      return undefined;
    }
    return {
      block: true,
      reason: `[danger-gate] 사용자가 거부했습니다. (${hit.rule}: ${hit.detail})\n안전한 대안을 제안하거나 명령을 수정하세요.`,
    };
  } catch (err) {
    return {
      block: true,
      reason: `[danger-gate] 승인 다이얼로그 오류로 차단. (${hit.rule}: ${hit.detail}) — ${(err as Error)?.message ?? err}`,
    };
  }
}

function commandFromUserBashEvent(event: unknown): string {
  const candidate = event as { command?: unknown; input?: { command?: unknown } };
  if (typeof candidate.command === "string") return candidate.command;
  if (typeof candidate.input?.command === "string") return candidate.input.command;
  return "";
}

export default function (pi: ExtensionAPI) {
  pi.on("tool_call", (event, ctx) => gate(event, ctx));
  pi.on("user_bash", (event, ctx) =>
    gate({ toolName: "bash", input: { command: commandFromUserBashEvent(event) } }, ctx),
  );
}
