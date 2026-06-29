#!/usr/bin/env node
// check-payment-untouched.mjs
// Iron Law 1 (settings redesign spec § 2.1): payment module is 0% change.
// Blocks Edit/Write to payment module paths during settings-redesign work.
//
// Spec: docs/superpowers/specs/2026-04-27-settings-redesign-design-v2.md § 2.1
import { emitAllow, emitBlock, normalizeRel, readHookInput } from "./_hook-io.mjs";

const { filePath } = await readHookInput();

if (!filePath) {
  emitAllow("no file path");
}

const normalized = normalizeRel(filePath);

const PROTECTED_REGEX =
  /^(packages\/features\/payment\/|apps\/app\/src\/features\/payment\/|apps\/server\/src\/api\/payment)/;

if (PROTECTED_REGEX.test(normalized)) {
  const reason = `⛔ Iron Law 1 위반: ${normalized} 는 settings redesign 동안 0% 변경 보호.\n결제 모듈은 손대지 않습니다 (사용자 명시).\n규칙: docs/superpowers/specs/2026-04-27-settings-redesign-design-v2.md § 2.1`;
  emitBlock(reason);
}

emitAllow("not a protected payment path");
