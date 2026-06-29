#!/usr/bin/env node
// Spec-retreat guard — 사용자 요구 대신 스펙 문서에 끼워맞추려는 행위 차단.
//
// 문제 패턴 (실제 발생):
//   1. 사용자가 이미지/요구를 제시
//   2. 에이전트가 코드 수정 (방향 O)
//   3. 에이전트가 "스펙 문서와 다르다" 는 이유로 다시 원복
//   4. 사용자: "스펙에 끼워맞추는거 아닌가?"
//
// 원칙: 사용자 의도 > 스펙 문서. 충돌 시 스펙을 업데이트하고 사용자 의도를 구현.
//
// 감지 시 블록이 아닌 경고 (decision: allow + reason). 에이전트가 주의를
// 환기하도록. 정당한 경우도 많기 때문에 hard-block 아님.
import { emitAllow, readHookInput } from "./_hook-io.mjs";

const { filePath, json } = await readHookInput();
const ti = json.tool_input || {};
// spec-retreat: new_string first, then content (matches sh behavior)
const newContent = (ti.new_string || ti.content || "").trim();

// 파일 대상이 없거나 content 없으면 skip.
if (!filePath || !newContent) {
  emitAllow("no file/content to inspect");
}

// 스펙 문서 자체를 편집하는 경우는 정상 — skip.
if (/\/docs\/specs\/|\/docs\/superpowers\/specs\/|\/docs\/superpowers\/plans\//.test(filePath)) {
  emitAllow("spec/plan doc edit");
}

// 테스트 파일도 skip — 테스트는 종종 spec 문구 인용.
if (/\/__tests__\/|\.(test|spec)\.(ts|tsx|js|jsx)$/.test(filePath)) {
  emitAllow("test file");
}

// 감지 패턴 (대소문자 무시, 줄 단위).
const KEYWORD_RE =
  /스펙\s*(?:준수|대로|에\s*따라|위반)|원래\s*방향|원상\s*(?:복구|복귀)|(?:per|as\s+per)\s+spec|spec\s+compliance|rollback|revert\s+to\s+spec|복원/i;
const SPEC_REF_RE = /(?:docs\/specs\/|docs\/superpowers\/specs\/)[a-z0-9-]+\.md/i;

const lines = newContent.split("\n");
const hits = [];
const specRefs = [];

for (let i = 0; i < lines.length; i++) {
  const line = lines[i];
  if (KEYWORD_RE.test(line) && hits.length < 5) hits.push(`${i + 1}:${line}`);
  if (SPEC_REF_RE.test(line) && specRefs.length < 3) specRefs.push(`${i + 1}:${line}`);
}

if (hits.length === 0 && specRefs.length === 0) {
  emitAllow("no spec-retreat markers");
}

// Build reason string — mirrors shell escaping behavior
let reason = `⚠️ SPEC-RETREAT 의심 — 스펙 문서에 끼워맞추려는 변경 감지.\n\n파일: ${filePath}\n\n`;

if (hits.length > 0) {
  reason += `키워드 매치:\n`;
  for (const h of hits) reason += `  ${h}\n`;
}
if (specRefs.length > 0) {
  reason += `스펙 문서 인용:\n`;
  for (const r of specRefs) reason += `  ${r}\n`;
}

reason +=
  `\n원칙:\n` +
  `  1. 사용자 의도 > 스펙 문서. 충돌 시 스펙을 업데이트 (사용자 의도를 구현).\n` +
  `  2. '스펙에 맞춰 되돌린다' 는 이유는 허용되지 않음 — 방금 사용자가 제시한 이미지/요구와 대조.\n` +
  `  3. 원복이 정당한 경우: 사용자가 직접 '되돌려라' 지시한 경우, 또는 명백한 버그.\n\n` +
  `이 변경이 사용자의 최신 요구와 일치하는지 다시 확인하라.\n` +
  `(Hard-block 아님 — 자각 후 계속 진행 가능)`;

// decision:allow 로 두되 reason 에 warning 출력 — Claude 가 reason 을 읽고 재고.
emitAllow(reason);
