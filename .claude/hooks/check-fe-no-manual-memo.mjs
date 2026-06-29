#!/usr/bin/env node
// React Compiler 환경 수동 메모이제이션 차단 hook
// useMemo / useCallback / React.memo / memo() 사용 시 차단
// React Compiler가 자동 메모이제이션하므로 수동 메모 불필요
// 규칙: docs/rules/frontend/react-component.md §1
import { contentOrFile, emitAllow, emitBlock, readHookInput } from "./_hook-io.mjs";

const { filePath, content } = await readHookInput();

// .tsx/.jsx/.ts/.js — React 관련 파일만
if (!/\.(tsx|jsx|ts|js)$/.test(filePath)) {
  emitAllow("not a JS/TS file");
}

// 테스트/스토리/타입 선언 파일 제외
if (/\.(stories|test|spec|bench|d)\.(tsx|jsx|ts|js)$/.test(filePath)) {
  emitAllow("test/story/types — skip");
}

// __tests__, __bench__, __mocks__ 디렉토리 제외
if (/__(?:tests|bench|mocks)__/.test(filePath)) {
  emitAllow("test directory — skip");
}

const text = contentOrFile(content, filePath);

if (!text) {
  emitAllow("no content to check");
}

// Escape hatch 1: "use no memo" directive (React Compiler 공식 opt-out)
if (/^["']use no memo["']/m.test(text)) {
  emitAllow("use no memo directive — Compiler opt-out");
}

// Escape hatch 2: 파일 상단 @memo-override 주석 + 사유 (첫 20줄)
const first20 = text.split("\n").slice(0, 20).join("\n");
if (/@memo-override:\s*\S/.test(first20)) {
  emitAllow("@memo-override annotation with reason");
}

const violations = [];

// useMemo( — 함수 호출만 검출
if (/\buseMemo\s*[(<]/.test(text)) {
  violations.push("• useMemo() 호출 발견 — React Compiler가 자동 메모이제이션");
}

// useCallback(
if (/\buseCallback\s*[(<]/.test(text)) {
  violations.push("• useCallback() 호출 발견 — React Compiler가 자동 메모이제이션");
}

// React.memo(
if (/\bReact\.memo\s*\(/.test(text)) {
  violations.push("• React.memo() 호출 발견 — React Compiler가 자동 메모이제이션");
}

// import { memo } from 'react'
if (/^import\s*\{[^}]*\bmemo\b[^}]*\}\s*from\s*['"]react['"]/m.test(text)) {
  violations.push("• memo (from 'react') import 발견 — React Compiler가 자동 메모이제이션");
}

// import { useMemo, useCallback } from 'react'
if (/^import\s*\{[^}]*\b(?:useMemo|useCallback)\b[^}]*\}\s*from\s*['"]react['"]/m.test(text)) {
  violations.push("• useMemo/useCallback (from 'react') import 발견");
}

if (violations.length > 0) {
  const vlist = violations.map((v) => `\n${v}`).join("");
  const reason =
    `⛔ 수동 메모이제이션 금지 (${filePath}):${vlist}\n\n` +
    `이 프로젝트는 React Compiler를 사용합니다. useMemo/useCallback/React.memo/memo는 컴파일러가 자동 처리하므로 수동 작성 금지.\n\n` +
    `참조 안정성(Effect deps, 자식 props identity)이 정말 필요하면:\n` +
    `  • Effect dep 안정화: 먼저 코드 구조를 재검토. 대부분 Compiler가 해결.\n` +
    `  • 정말 필요하면 파일 상단에 // @memo-override: <구체적 사유> 주석 + 리뷰\n` +
    `  • 또는 파일 최상단에 "use no memo" directive로 Compiler opt-out (사유 주석 필수)\n\n` +
    `규칙: docs/rules/frontend/react-component.md §1`;
  emitBlock(reason);
}

emitAllow("no manual memoization");
