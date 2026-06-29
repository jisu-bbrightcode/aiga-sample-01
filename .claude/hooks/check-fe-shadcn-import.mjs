#!/usr/bin/env node
// FE shadcn 컴포넌트 사용 강제 hook
// .tsx/.jsx 파일에서 raw HTML <button>/<input>/<select>/<textarea> 발견 시 차단
// (대문자 <Button>, <Input> 등은 React 컴포넌트이므로 통과)
// 규칙: docs/rules/frontend/react-component.md
import { contentOrFile, emitAllow, emitBlock, readHookInput } from "./_hook-io.mjs";

const { filePath, content } = await readHookInput();

if (!/\.(tsx|jsx)$/.test(filePath)) {
  emitAllow("not a JSX file");
}

if (/\.(stories|test|spec|d)\.(tsx|jsx)$/.test(filePath)) {
  emitAllow("test/story/types — skip");
}

// packages/ui (shadcn registry 자체) 제외
if (/packages\/ui\//.test(filePath)) {
  emitAllow("shadcn registry");
}

const text = contentOrFile(content, filePath);

if (!text) {
  emitAllow("no content to check");
}

const violations = [];

// raw <button> (소문자)
if (/<button[\s>]/.test(text)) {
  violations.push(
    "• raw <button> 발견 — shadcn <Button> 사용 (@repo/ui/shadcn 또는 components/ui/button)",
  );
}

// raw <input> — type="hidden" / type="file" 허용
if (/<input[\s>]/.test(text) && !/type="hidden"|type="file"/.test(text)) {
  violations.push("• raw <input> 발견 — shadcn <Input> 사용 (hidden/file 제외)");
}

// raw <select>
if (/<select[\s>]/.test(text)) {
  violations.push("• raw <select> 발견 — shadcn <Select> 사용");
}

// raw <textarea>
if (/<textarea[\s>]/.test(text)) {
  violations.push("• raw <textarea> 발견 — shadcn <Textarea> 사용");
}

if (violations.length > 0) {
  const vlist = violations.map((v) => `\n${v}`).join("");
  const reason =
    `⛔ shadcn 컴포넌트 누락 (${filePath}):${vlist}\n\n` +
    `예외 (raw HTML 허용 케이스)는 파일 상단 코멘트에 사유 명시 후 hook을 우회. 기본은 shadcn 사용.\n` +
    `규칙: docs/rules/frontend/react-component.md\n` +
    `shadcn registry: packages/ui/components.json`;
  emitBlock(reason);
}

emitAllow("shadcn compliant");
