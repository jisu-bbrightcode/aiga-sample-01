/**
 * scripts/audit-trpc-rest-gap.mjs
 *
 * dual feature 별로 tRPC procedure 목록 vs controller route 목록을 비교해
 * 마크다운 테이블 출력.
 *
 * 사용: node scripts/audit-trpc-rest-gap.mjs > docs/superpowers/plans/2026-06-10-trpc-rest-gap-audit.md
 *
 * Fix v2 (2026-06-10):
 *  - Multi-controller: parse ALL @Controller(...) classes in a file, scope each route to its enclosing class prefix
 *  - Injected-client usage: also grep for path segments (e.g. `.entityTag.add.`) not just `trpc.` prefix
 *  - community.feed.all + community.karma.getBatch GAP→✅ corrected
 */

import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative } from "node:path";

const ROOT = new URL("../", import.meta.url).pathname.replace(/\/$/, "");
const FEATURES_DIR = join(ROOT, "packages/features");

// dual feature 목록 + tRPC client prefix (apps/server/src/trpc/router.ts 기준)
const DUAL = [
  { name: "blog",          trpcKey: "blog" },
  { name: "comment",       trpcKey: "comment" },
  { name: "community",     trpcKey: "community" },
  { name: "email",         trpcKey: "email" },
  { name: "localization",  trpcKey: "localization" },
  { name: "notification",  trpcKey: "notification" },
  { name: "onboarding",    trpcKey: "onboarding" },
  { name: "project",       trpcKey: "project" },
  { name: "reaction",      trpcKey: "reaction" },
  { name: "scheduled-job", trpcKey: "scheduledJob" },
  { name: "story",         trpcKey: "story" },
];

// ─── helpers ──────────────────────────────────────────────────────────────────

function walk(dir, out = []) {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) walk(p, out);
    else if (p.endsWith(".ts")) out.push(p);
  }
  return out;
}

/**
 * Extract tRPC procedures from a feature directory.
 * Returns { name, kind, subRouter, file }[]
 */
function trpcProcedures(featureDir) {
  const all = walk(featureDir);
  const trpcFiles = all.filter(
    (f) =>
      f.endsWith(".ts") &&
      !f.includes(".spec.") &&
      !f.includes("/dto/") &&
      !f.endsWith("/index.ts") &&
      (f.includes("/trpc/") || /\/[\w-]+\.router\.ts$/.test(f)),
  );

  const procs = [];

  for (const f of trpcFiles) {
    const src = readFileSync(f, "utf8");
    const rel = relative(featureDir, f);

    const baseName = f.split("/").pop().replace(/\.(router|route)\.ts$/, "");

    const routerBlocks = src.split(/\brouter\s*\(\s*\{/);

    for (let blockIdx = 0; blockIdx < routerBlocks.length; blockIdx++) {
      const block = routerBlocks[blockIdx];

      let subRouter = baseName;
      if (blockIdx > 0) {
        const preceding = routerBlocks[blockIdx - 1];
        const varMatch = preceding.match(/const\s+(\w+Router)\s*=\s*$/);
        if (varMatch) {
          subRouter = varMatch[1].replace(/Router$/, "");
        }
      }

      const procPattern = /^\s{1,4}(\w+)\s*:\s*\w*[Pp]rocedure[\s\S]*?\.(query|mutation)\s*\(/gm;
      for (const m of block.matchAll(procPattern)) {
        procs.push({
          name: m[1],
          kind: m[2],
          subRouter,
          file: rel,
        });
      }
    }
  }

  return procs;
}

/**
 * Extract REST routes from all *.controller.ts files in a feature.
 * FIX v2: parse EVERY @Controller(...) class in a file, not just the first.
 * Returns { method, path, handlerName, file }[]
 */
function restRoutes(featureDir) {
  const all = walk(featureDir);
  const ctrlFiles = all.filter((f) => f.endsWith(".controller.ts") && !f.includes(".spec."));
  const routes = [];

  for (const f of ctrlFiles) {
    const src = readFileSync(f, "utf8");
    const rel = relative(featureDir, f);

    // Find all @Controller("...") positions and their prefixes
    // Each defines a new "class scope" for subsequent routes
    const controllerPositions = [];
    const ctrlRe = /@Controller\(\s*["'`]([^"'`]*)["'`]\s*\)/g;
    let ctrlM;
    while ((ctrlM = ctrlRe.exec(src)) !== null) {
      controllerPositions.push({ index: ctrlM.index, prefix: ctrlM[1] });
    }

    if (controllerPositions.length === 0) {
      // No @Controller found — skip
      continue;
    }

    // For each character position, determine which controller prefix applies
    function prefixAt(pos) {
      let prefix = controllerPositions[0].prefix;
      for (const cp of controllerPositions) {
        if (cp.index <= pos) prefix = cp.prefix;
        else break;
      }
      return prefix;
    }

    // Find all HTTP decorators and associate them with the correct controller prefix
    const lines = src.split("\n");
    let lineStart = 0; // character offset of the current line
    let pendingMethod = null;
    let pendingPath = null;
    let pendingDecoratorPos = null;

    for (const line of lines) {
      const trimmed = line.trim();

      const decoratorMatch = trimmed.match(/^@(Get|Post|Put|Patch|Delete)\s*\(\s*(?:["'`]([^"'`]*)["'`])?\s*\)/);
      if (decoratorMatch) {
        pendingMethod = decoratorMatch[1].toUpperCase();
        pendingPath = decoratorMatch[2] ?? "";
        pendingDecoratorPos = lineStart;
        lineStart += line.length + 1;
        continue;
      }

      if (pendingMethod !== null) {
        const methodMatch = trimmed.match(/^(?:public\s+)?(?:async\s+)?(\w+)\s*\(/);
        if (methodMatch) {
          const handlerName = methodMatch[1];
          const SKIP = new Set(["constructor", "if", "for", "while", "switch", "catch"]);
          if (!SKIP.has(handlerName) && !/^[A-Z]/.test(handlerName)) {
            const ctrlPrefix = prefixAt(pendingDecoratorPos);
            const fullPath =
              `/${ctrlPrefix}/${pendingPath}`
                .replace(/\/+$/, "")
                .replace(/\/+/g, "/") || `/${ctrlPrefix}`;

            routes.push({
              method: pendingMethod,
              path: fullPath,
              handlerName,
              file: rel,
            });
          }
          pendingMethod = null;
          pendingPath = null;
          pendingDecoratorPos = null;
        }
      }

      lineStart += line.length + 1;
    }
  }

  return routes;
}

/**
 * Check client usage of a tRPC procedure.
 * FIX v2: also match injected-client call patterns like `c.story.entityTag.add.mutate`
 *   by searching for the path SEGMENT chain (`.subRouter.procName.`) without the `trpc.` prefix.
 * Returns true if found in client source directories.
 */
function isUsedByClient(trpcKey, procName, subRouter, featureName) {
  const searchDirs = [
    join(ROOT, "apps/app/src"),
    join(ROOT, "apps/admin/src"),
    join(ROOT, "packages/widgets/src"),
    join(ROOT, "packages/data"),
  ];

  // Pattern set 1: canonical trpc client prefix
  let patterns;
  if (subRouter && subRouter !== featureName && subRouter !== "index") {
    patterns = [
      `trpc.${trpcKey}.${subRouter}.${procName}`,
    ];
  } else {
    patterns = [
      `trpc.${trpcKey}.${procName}`,
    ];
  }

  // Pattern set 2: injected-client call patterns (packages/data DI pattern: `c.story.entityTag.add.mutate`)
  // We match the trailing path segments: `.subRouter.procName.` or `.trpcKey.procName.`
  if (subRouter && subRouter !== featureName && subRouter !== "index") {
    // e.g. `.entityTag.add.` — matches c.story.entityTag.add.mutate(...)
    patterns.push(`.${subRouter}.${procName}.`);
    patterns.push(`.${subRouter}.${procName}(`);
  } else {
    // e.g. `.story.createScene.`
    patterns.push(`.${trpcKey}.${procName}.`);
    patterns.push(`.${trpcKey}.${procName}(`);
  }

  for (const dir of searchDirs) {
    try {
      const files = walk(dir).filter((f) => /\.(ts|tsx)$/.test(f));
      for (const f of files) {
        const src = readFileSync(f, "utf8");
        for (const pat of patterns) {
          if (src.includes(pat)) return true;
        }
      }
    } catch {
      // dir may not exist
    }
  }
  return false;
}

// ─── main ─────────────────────────────────────────────────────────────────────

let md = `# tRPC ↔ REST 갭 감사 (자동 생성)

> 생성일: ${new Date().toISOString().slice(0, 10)}
> 스크립트: \`scripts/audit-trpc-rest-gap.mjs\`
> **상태 키:** ✅ 대응 REST 존재 | ❌ GAP (endpoint 추가 필요) | 🗑 DROP (클라 미사용)
> **v2 수정:** 다중 @Controller 파싱 · 인젝션 클라이언트 사용 감지 · 커뮤니티 GAP 2건 수정

---

`;

const summaryRows = [];

for (const { name: feature, trpcKey } of DUAL) {
  const dir = join(FEATURES_DIR, feature);
  const procs = trpcProcedures(dir);
  const routes = restRoutes(dir);

  // Build a multi-map: handlerName → routes[] (many controllers can share handler names like "list")
  const routesByHandler = new Map();
  for (const r of routes) {
    if (!routesByHandler.has(r.handlerName)) routesByHandler.set(r.handlerName, []);
    routesByHandler.get(r.handlerName).push(r);
  }

  /**
   * Given a list of candidate routes, prefer the one whose path contains the subRouter name.
   * For ties, prefer shorter paths (less specific = less likely to be admin-only).
   * Falls back to the first candidate.
   */
  function preferSubRouterMatch(candidates, subRouter) {
    if (!subRouter || subRouter === "index" || candidates.length === 1) return candidates[0];
    const sub = subRouter.toLowerCase();
    // Try exact plural/singular match in path
    const exact = candidates.filter((r) => {
      const pathLower = r.path.toLowerCase();
      return pathLower.includes(`/${sub}/`) || pathLower.endsWith(`/${sub}`) ||
             pathLower.includes(`/${sub}s/`) || pathLower.endsWith(`/${sub}s`);
    });
    if (exact.length === 1) return exact[0];
    if (exact.length > 1) {
      // Among ties, prefer shorter path (e.g. /community over /admin/community)
      return exact.slice().sort((a, b) => a.path.length - b.path.length)[0];
    }
    // No exact sub match — prefer shorter path overall
    return candidates.slice().sort((a, b) => a.path.length - b.path.length)[0];
  }

  function findMatchingRoute(procName, subRouter, procKind) {
    const lowerProc = procName.toLowerCase();
    const subLower = (subRouter ?? "").toLowerCase();

    // Mutation → write methods (POST/PUT/PATCH/DELETE); query → read methods (GET)
    const WRITE_METHODS = new Set(["POST", "PUT", "PATCH", "DELETE"]);
    const READ_METHODS = new Set(["GET"]);
    function kindFilter(r) {
      if (!procKind) return true;
      if (procKind === "mutation") return WRITE_METHODS.has(r.method);
      if (procKind === "query") return READ_METHODS.has(r.method);
      return true;
    }

    function filterByKind(candidates) {
      const filtered = candidates.filter(kindFilter);
      return filtered.length > 0 ? filtered : candidates; // fallback to all if kind filter removes everything
    }

    const VERB_ONLY = new Set(["list", "create", "update", "delete", "getbyid", "get", "find", "remove", "all", "add"]);

    // Helper: pick best route from candidates, preferring sub-router path match + kind filter
    function best(candidates) {
      const kindFiltered = filterByKind(candidates);
      return preferSubRouterMatch(kindFiltered, subRouter);
    }

    // 1. Direct handler name match — but if in a sub-router, require path contains sub-router name
    if (routesByHandler.has(procName)) {
      const cands = filterByKind(routesByHandler.get(procName));
      if (!subRouter || subRouter === "index") return best(cands);
      const subMatches = cands.filter((r) => {
        const p = r.path.toLowerCase();
        return p.includes(`/${subLower}`) || p.includes(`/${subLower}s`);
      });
      if (subMatches.length > 0) return best(subMatches); // best() applies shortest-path preference
    }

    // 2. Handler = subRouter + procName compound (e.g. proc="getBatch", sub="karma" → handler="batchKarma" or "karmaGetBatch")
    if (subLower) {
      const compound1 = subLower + lowerProc; // e.g. "karmabatch" (not likely but check)
      const compound2 = lowerProc + subLower; // e.g. "getBatchKarma" → "getbatchkarma"
      const camelSub = subLower.charAt(0).toUpperCase() + subLower.slice(1);
      // Try "batch" + sub, sub + "Batch", etc.
      for (const [handler, rlist] of routesByHandler) {
        const hl = handler.toLowerCase();
        if (
          hl === compound1 ||
          hl === compound2 ||
          // e.g. "batchKarma" for karma.getBatch
          (hl.includes(subLower) && hl.includes(lowerProc.replace("get", "").replace("batch", "batch")))
        ) {
          return best(rlist);
        }
      }
    }

    // 3. Handler name contains procName (>= 4 chars) scoped to sub-router path
    if (lowerProc.length >= 4) {
      // With sub-router: prefer handlers whose route path contains the sub-router
      const subMatches = [];
      const anyMatches = [];
      for (const [handler, rlist] of routesByHandler) {
        if (handler.toLowerCase().includes(lowerProc)) {
          for (const r of rlist) {
            const p = r.path.toLowerCase();
            if (subLower && (p.includes(`/${subLower}`) || p.includes(`/${subLower}s`))) {
              subMatches.push(r);
            } else {
              anyMatches.push(r);
            }
          }
        }
      }
      if (subMatches.length > 0) return best(subMatches);
      // Only fall back to anyMatches if there's no sub-router context (avoid cross-contamination)
      if (anyMatches.length > 0 && (!subRouter || subRouter === "index")) return best(anyMatches);
    }

    // 4. proc = "all" in sub-router: look for handler named subAll or allSub or just path containing sub/all
    if (lowerProc === "all" && subLower) {
      for (const [handler, rlist] of routesByHandler) {
        const hl = handler.toLowerCase();
        if (hl.includes(subLower) || hl === "all" + subLower || hl === subLower + "all") {
          const pathMatch = rlist.find((r) => r.path.toLowerCase().includes(`/${subLower}/`));
          if (pathMatch) return pathMatch;
          return best(rlist);
        }
      }
      // Also try: handler "feedAll" for sub "feed"
      for (const [handler, rlist] of routesByHandler) {
        const hl = handler.toLowerCase();
        if (hl.startsWith(subLower)) return best(rlist);
      }
    }

    // 5. For verb-only proc names in sub-routers — match handler starting with verb + containing sub name
    if (VERB_ONLY.has(lowerProc) && subLower && subRouter !== "index") {
      for (const [handler, rlist] of routesByHandler) {
        const handlerLower = handler.toLowerCase();
        if (
          handlerLower.startsWith(lowerProc.replace("byid", "").replace("getbyid", "get")) &&
          handlerLower.includes(subLower)
        ) {
          return best(rlist);
        }
      }
    }

    // 6. Handler name == subRouter (e.g. subRouter="karma", procName="get" → handler="karma")
    if (VERB_ONLY.has(lowerProc) && subLower && subRouter !== "index") {
      if (routesByHandler.has(subRouter)) return best(routesByHandler.get(subRouter));
      if (routesByHandler.has(subRouter + "s")) return best(routesByHandler.get(subRouter + "s"));
    }

    // 7. Direct handler name match with no sub-router context (fallback)
    if (routesByHandler.has(procName)) {
      return best(routesByHandler.get(procName));
    }

    return null;
  }

  let checkCount = 0;
  let gapCount = 0;
  let dropCount = 0;

  const rows = procs.map((p) => {
    const match = findMatchingRoute(p.name, p.subRouter, p.kind);
    let restCol = "(없음)";
    let status = "";

    if (match) {
      restCol = `\`${match.method} ${match.path}\``;
      status = "✅";
      checkCount++;
    } else {
      const used = isUsedByClient(trpcKey, p.name, p.subRouter, feature);
      if (used) {
        status = "❌ GAP";
        gapCount++;
      } else {
        status = "🗑 DROP";
        dropCount++;
      }
    }

    const subPart = p.subRouter && p.subRouter !== feature.replace(/-/g, "") ? `.${p.subRouter}` : "";
    return `| \`${trpcKey}${subPart}.${p.name}\` | ${p.kind} | ${restCol} | ${status} |`;
  });

  summaryRows.push({ feature, trpcKey, procCount: procs.length, routeCount: routes.length, checkCount, gapCount, dropCount });

  md += `## ${feature} (trpc key: \`${trpcKey}\`) — procedures: ${procs.length}, REST routes: ${routes.length}\n\n`;
  md += `| tRPC procedure | kind | 대응 REST | 상태 |\n|---|---|---|---|\n`;
  md += rows.join("\n") + "\n";

  md += "\n### REST routes\n\n";
  if (routes.length === 0) {
    md += "_없음_\n";
  } else {
    // Dedupe routes by method+path (multi-controller files may register the same route multiple times in the array)
    const seen = new Set();
    for (const r of routes) {
      const key = `${r.method} ${r.path}`;
      if (seen.has(key)) continue;
      seen.add(key);
      md += `- \`${r.method} ${r.path}\` → \`${r.handlerName}()\` — \`${r.file}\`\n`;
    }
  }
  md += "\n---\n\n";
}

// Summary table — insert after the first ---
md = md.replace(
  "---\n\n",
  `---\n\n## 요약\n\n| feature | tRPC procedures | REST routes | ✅ | ❌ GAP | 🗑 DROP |\n|---|---|---|---|---|---|\n` +
    summaryRows
      .map(
        (r) =>
          `| ${r.feature} | ${r.procCount} | ${r.routeCount} | ${r.checkCount} | ${r.gapCount} | ${r.dropCount} |`,
      )
      .join("\n") +
    "\n\n---\n\n",
);

process.stdout.write(md);
