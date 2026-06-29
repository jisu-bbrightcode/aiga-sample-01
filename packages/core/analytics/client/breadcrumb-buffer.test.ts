import assert from "node:assert/strict";
import test from "node:test";
import {
  __resetBreadcrumbs,
  getBreadcrumbs,
  pushBreadcrumb,
} from "./breadcrumb-buffer";

test("pushBreadcrumb appends and getBreadcrumbs returns a copy", () => {
  __resetBreadcrumbs();
  pushBreadcrumb({ ts: 1, level: "info", ns: "test", message: "a" });
  const out = getBreadcrumbs();
  assert.equal(out.length, 1);
  assert.equal(out[0]!.message, "a");
  // 반환값은 복사본 — 변경해도 내부에 영향 없음
  out.push({ ts: 2, level: "info", ns: "x", message: "b" });
  assert.equal(getBreadcrumbs().length, 1);
});

test("breadcrumb buffer caps at 50 entries (FIFO shift)", () => {
  __resetBreadcrumbs();
  for (let i = 0; i < 60; i++) {
    pushBreadcrumb({ ts: i, level: "info", ns: "test", message: `m${i}` });
  }
  const out = getBreadcrumbs();
  assert.equal(out.length, 50);
  assert.equal(out[0]!.message, "m10"); // 처음 10개는 shift 됨
  assert.equal(out[49]!.message, "m59");
});

test("__resetBreadcrumbs clears the buffer", () => {
  __resetBreadcrumbs();
  pushBreadcrumb({ ts: 1, level: "info", ns: "test", message: "a" });
  __resetBreadcrumbs();
  assert.equal(getBreadcrumbs().length, 0);
});
