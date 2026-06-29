import assert from "node:assert/strict";
import { test } from "node:test";
import { scanSource } from "../detect-hardcoded.ts";

test("flags Korean in JSX text", () => {
  const hits = scanSource("a.tsx", `<button>저장</button>`);
  assert.equal(hits.length, 1);
  assert.match(hits[0]?.korean ?? "", /저장/);
});

test("flags Korean in string literal", () => {
  const hits = scanSource("a.tsx", `const label = "한국어";`);
  assert.equal(hits.length, 1);
});

test("flags Korean in template literal", () => {
  // biome-ignore lint/suspicious/noTemplateCurlyInString: payload string used as input to scanSource — not a runtime template.
  const src = `const msg = \`\${n}건 발견\`;`;
  const hits = scanSource("a.tsx", src);
  assert.equal(hits.length, 1);
});

test("ignores line comments", () => {
  const hits = scanSource("a.tsx", `// 이건 주석`);
  assert.equal(hits.length, 0);
});

test("ignores block comments single line", () => {
  const hits = scanSource("a.tsx", `/* 블록 주석 */ const x = 1;`);
  assert.equal(hits.length, 0);
});

test("ignores block comments multi line", () => {
  const src = ["/**", " * 다국어 비활성화", " */", 'const x = "ok";'].join("\n");
  const hits = scanSource("a.tsx", src);
  assert.equal(hits.length, 0);
});

test("ignores console calls", () => {
  const hits = scanSource("a.tsx", `console.warn("저장 실패");`);
  assert.equal(hits.length, 0);
});

test("ignores i18n-ignore-next-line directive", () => {
  const src = [
    `// i18n-ignore-next-line — internal debug`,
    `const debugLabel = "내부 디버그";`,
  ].join("\n");
  const hits = scanSource("a.tsx", src);
  assert.equal(hits.length, 0);
});

test("ignores data-* attributes", () => {
  const hits = scanSource("a.tsx", `<div data-label="저장">x</div>`);
  assert.equal(hits.length, 0);
});

test("flags multiple lines independently", () => {
  const src = [`const a = "첫번째";`, `const b = "두번째";`].join("\n");
  const hits = scanSource("a.tsx", src);
  assert.equal(hits.length, 2);
  assert.equal(hits[0]?.line, 1);
  assert.equal(hits[1]?.line, 2);
});
