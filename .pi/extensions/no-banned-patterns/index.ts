// @ts-nocheck
/**
 * no-banned-patterns
 *
 * Single Pi extension that dispatches `write` / `edit` / `multi_edit` tool
 * calls through every write-time rule under `.pi/extensions/rules/`. Rules
 * are pure regex predicates (framework-free); this hook stitches them into
 * a `{ block, reason }` for the Pi runtime.
 *
 * Rules in scope:
 *   • no-raw-sql              (rules/no-raw-sql.ts)
 *   • no-schema-outside-drizzle (rules/no-schema-outside-drizzle.ts)
 *   • no-db-in-controller     (rules/no-db-in-controller.ts)
 *   • no-manual-memoization   (rules/no-manual-memoization.ts)
 *   • no-local-css-import     (rules/no-local-css-import.ts)
 *   • jotai-state-policy      (rules/jotai-state-policy.ts)
 *
 * Adding a new rule = drop a `rules/<name>.ts` exporting
 *   `{ shouldGuard(path), findViolations(text), ADVICE }`
 * and append it to the RULES table below.
 *
 * Each rule's `findViolations` also flags inline disable directives for its
 * own oxlint counterpart, so the agent cannot silence them per line.
 */

import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { buildBlockMessage, readToolPath, readToolText, type Violation } from "../rules/lib.ts";

import * as rawSql from "../rules/no-raw-sql.ts";
import * as schemaOutside from "../rules/no-schema-outside-drizzle.ts";
import * as dbInController from "../rules/no-db-in-controller.ts";
import * as manualMemo from "../rules/no-manual-memoization.ts";
import * as localCss from "../rules/no-local-css-import.ts";
import * as e2eConv from "../rules/e2e-spec-conventions.ts";
import * as testLoc from "../rules/test-file-location.ts";
import * as jotaiState from "../rules/jotai-state-policy.ts";

interface RuleModule {
  name: string;
  shouldGuard: (path: string) => boolean;
  // path 이익이 필요한 룰 (e.g. e2e-spec-conventions) 은 2nd arg 사용.
  findViolations: (text: string, path?: string) => Violation[];
  ADVICE: readonly string[];
}

const RULES: readonly RuleModule[] = [
  {
    name: "no-raw-sql-query",
    shouldGuard: rawSql.shouldGuard,
    findViolations: rawSql.findViolations,
    ADVICE: [],
  },
  {
    name: "no-schema-outside-drizzle",
    shouldGuard: schemaOutside.shouldGuard,
    findViolations: schemaOutside.findViolations,
    ADVICE: schemaOutside.ADVICE,
  },
  {
    name: "no-db-in-controller",
    shouldGuard: dbInController.shouldGuard,
    findViolations: dbInController.findViolations,
    ADVICE: dbInController.ADVICE,
  },
  {
    name: "no-manual-memoization",
    shouldGuard: manualMemo.shouldGuard,
    findViolations: manualMemo.findViolations,
    ADVICE: manualMemo.ADVICE,
  },
  {
    name: "no-local-css-import",
    shouldGuard: localCss.shouldGuard,
    findViolations: localCss.findViolations,
    ADVICE: localCss.ADVICE,
  },
  {
    name: "e2e-spec-conventions",
    shouldGuard: e2eConv.shouldGuard,
    findViolations: e2eConv.findViolations,
    ADVICE: e2eConv.ADVICE,
  },
  {
    name: "test-file-location",
    shouldGuard: testLoc.shouldGuard,
    findViolations: testLoc.findViolations,
    ADVICE: testLoc.ADVICE,
  },
  {
    name: "jotai-state-policy",
    shouldGuard: jotaiState.shouldGuard,
    findViolations: jotaiState.findViolations,
    ADVICE: jotaiState.ADVICE,
  },
];

type BlockResult = { block: true; reason: string } | undefined;

function checkOneRule(rule: RuleModule, path: string, texts: string[]): BlockResult {
  if (!rule.shouldGuard(path)) return undefined;
  const violations: Violation[] = [];
  for (const t of texts) violations.push(...rule.findViolations(t, path));
  if (violations.length === 0) return undefined;
  // no-raw-sql 은 자체 build message 가 있음. 다른 룰은 공통 헬퍼.
  if (rule.name === "no-raw-sql-query") {
    return { block: true, reason: rawSql.buildBlockMessage(violations) };
  }
  return { block: true, reason: buildBlockMessage(rule.name, rule.ADVICE, violations) };
}

export function inspect(event: { toolName: string; input?: Record<string, unknown> }): BlockResult {
  if (event.toolName !== "write" && event.toolName !== "edit" && event.toolName !== "multi_edit") {
    return undefined;
  }
  const path = readToolPath(event);
  if (!path) return undefined;
  const texts = readToolText(event);
  if (texts.length === 0) return undefined;
  for (const rule of RULES) {
    const result = checkOneRule(rule, path, texts);
    if (result) return result;
  }
  return undefined;
}

export default function (pi: ExtensionAPI) {
  pi.on("tool_call", (event) => inspect(event));
}
