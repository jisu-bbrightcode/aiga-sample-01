// @ts-nocheck
/**
 * no-raw-html.ts
 *
 * pi extension — FE 코드에서 raw HTML 폼/구조 요소 사용을 차단한다.
 * shadcn (Base-UI) 래퍼 사용을 강제하기 위한 hard gate.
 *
 * 차단 대상 태그 (JSX 여는 태그만):
 *   <button> <input> <select> <textarea> <dialog> <table>
 *
 * 적용 경로 (FE only):
 *   - apps/*\/(components|src|app|routes|pages)/**\/*.{tsx,jsx}
 *   - packages/(ui|widgets|features)/**\/*.{tsx,jsx}
 *
 * 예외 (shadcn 내부 wrapper — raw 허용):
 *   - packages/ui/src/_shadcn/**
 *   - packages/ui/src/components/ui/**
 *
 * 예외 (테스트 / 스토리북):
 *   - *.{test,spec,stories}.{tsx,jsx}
 *
 * 동작:
 *   - write 툴: content 전체 검사
 *   - edit 툴: 새로 삽입되는 edits[].newText 만 검사 (기존 위반은 점진적 수정 허용)
 *   - 위반 시 block + 안내 reason 반환 → 에이전트가 shadcn 으로 재작성
 *
 * @ts-nocheck: 본 파일은 pi 가 globally 설치된 `@earendil-works/pi-coding-agent`
 * 를 런타임에 로드한다. 프로젝트 tsconfig 가 없거나 모듈 해상이 안 되는 환경에서도
 * 동작해야 하므로 의도적으로 타입 검사를 끈다.
 */

import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";

// lowercase only — uppercase (e.g. <Button>) is a shadcn component, not a raw HTML tag
const FORBIDDEN_JSX = /<(button|input|select|textarea|dialog|table)(\s|\/|>)/;
const FE_PATH =
  /(?:^|\/)(?:apps\/[^/]+\/(?:components|src|app|routes|pages)|packages\/(?:ui|widgets|features))\//;
const EXEMPT_SHADCN = /(?:^|\/)packages\/ui\/src\/(?:_shadcn|components\/ui)\//;
const EXEMPT_TEST = /\.(?:test|spec|stories)\.(?:tsx|jsx)$/;
const FE_EXT = /\.(?:tsx|jsx)$/;

function blockMsg(tag: string): string {
  return (
    `Raw <${tag}> 사용 금지 (FE shadcn 강제 규칙). ` +
    `다음 컴포넌트를 사용하세요: ` +
    `button→Button, input→Input, select→Select, textarea→Textarea, dialog→Dialog, table→Table ` +
    `(from @repo/ui 또는 @/components/ui/*). ` +
    `shadcn 내부 (packages/ui/src/_shadcn, packages/ui/src/components/ui) 만 예외. ` +
    `상세: AGENTS.md "FE UI 컴포넌트 강제 규칙" 섹션.`
  );
}

function shouldGuard(path: string): boolean {
  if (!path) return false;
  if (!FE_EXT.test(path)) return false;
  if (!FE_PATH.test(path)) return false;
  if (EXEMPT_SHADCN.test(path)) return false;
  if (EXEMPT_TEST.test(path)) return false;
  return true;
}

function findViolation(text: string | undefined): string | null {
  if (!text) return null;
  const m = text.match(FORBIDDEN_JSX);
  return m ? m[1].toLowerCase() : null;
}

type BlockResult = { block: true; reason: string } | undefined;

function checkContent(content: string | undefined): BlockResult {
  const violation = findViolation(content);
  return violation ? { block: true, reason: blockMsg(violation) } : undefined;
}

function checkEdits(edits: Array<{ newText?: string }>): BlockResult {
  // 기존 코드의 위반은 통과시키고, 새로 삽입되는 newText 만 검사한다.
  for (const e of edits) {
    const result = checkContent(e.newText);
    if (result) return result;
  }
  return undefined;
}

function inspect(event: { toolName: string; input?: Record<string, unknown> }): BlockResult {
  const { toolName: tool, input = {} } = event;
  if (tool !== "write" && tool !== "edit") return undefined;
  if (!shouldGuard((input.path as string) ?? "")) return undefined;
  return tool === "write"
    ? checkContent(input.content as string | undefined)
    : checkEdits((input.edits as Array<{ newText?: string }>) ?? []);
}

export default function (pi: ExtensionAPI) {
  pi.on("tool_call", (event) => inspect(event));
}
