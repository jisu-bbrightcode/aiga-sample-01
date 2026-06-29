#!/usr/bin/env node
// check-tailwind-arbitrary.mjs
// Iron Law 4 (settings redesign spec § 2.4): tailwind arbitrary values are
// forbidden in settings-redesign code paths.
//
// Scope:
//   apps/app/src/pages/settings/**
//   apps/app/src/features/settings/**
//   packages/ui/src/settings/**
// Out-of-scope files are allowed (existing arbitrary usage elsewhere is
// noisy and out of this redesign's scope).
//
// Spec: docs/superpowers/specs/2026-04-27-settings-redesign-design-v2.md § 2.4
import { contentOrFile, emitAllow, emitBlock, normalizeRel, readHookInput } from "./_hook-io.mjs";

const { filePath, content } = await readHookInput();

if (!filePath) {
  emitAllow("no file path");
}

const normalized = normalizeRel(filePath);

// Scope: only apply to settings redesign paths.
const SCOPE_REGEX =
  /^(apps\/app\/src\/pages\/settings\/|apps\/app\/src\/features\/settings\/|packages\/ui\/src\/settings\/)/;
if (!SCOPE_REGEX.test(normalized)) {
  emitAllow("out of settings-redesign scope");
}

// Inspect tsx/jsx/ts/css files only.
if (!/\.(tsx|jsx|ts|css)$/.test(normalized)) {
  emitAllow("not a styled file");
}

// Skip test/story files
if (/\.(stories|test|spec)\.(tsx|jsx|ts)$/.test(normalized)) {
  emitAllow("test/story file");
}

// Read tool_input.content or tool_input.new_string, fall back to disk file.
const newContent = contentOrFile(content, filePath);

if (!newContent) {
  emitAllow("no content to inspect");
}

// Generic arbitrary-value pattern: any tailwind utility followed by [...].
// This catches text-[Npx], w-[247px], gap-[7px], bg-[red], border-[1px],
// translate-x-[2px], shadow-[...], ring-[...], from/to/via-[...], size-[...] etc.
const PATTERN = /\b[a-z][a-z0-9-]*-\[[^\]]+\]/;

// Allowlist exceptions: data-[state=...], aria-[...], group-[...], peer-[...]
// selectors are not class arbitrary values — strip them before match.
const STRIP_REGEX = /data-\[[^\]]+\]|aria-\[[^\]]+\]|group-\[[^\]]+\]|peer-\[[^\]]+\]/g;
const filtered = newContent.replace(STRIP_REGEX, "");

// Check per-line (grep is per-line), collect first 5 violations.
const lines = filtered.split("\n");
const violations = [];
for (let i = 0; i < lines.length && violations.length < 5; i++) {
  if (PATTERN.test(lines[i])) {
    violations.push(`${i + 1}:${lines[i]}`);
  }
}

if (violations.length > 0) {
  const violationsText = violations.join("\n");
    const reason = `⛔ Iron Law 4 위반: settings 경로에서 tailwind arbitrary value 사용 금지.\n파일: ${normalized}\n발견:\n${violationsText}\n부족한 토큰은 packages/ui/src/styles.css 에 먼저 추가하세요.`;
  emitBlock(reason);
}

emitAllow("no arbitrary values");
