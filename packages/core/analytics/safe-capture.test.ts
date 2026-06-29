import assert from "node:assert/strict";
import test from "node:test";
import { __resetClientCaptureState, safeCapture } from "./safe-capture";

test("safeCapture invokes capture with sanitized props", () => {
  __resetClientCaptureState();
  const calls: { event: string; props: Record<string, unknown> }[] = [];
  safeCapture("ev", () => ({ token: "x", ok: "y" }), (event, props) => calls.push({ event, props }));
  assert.equal(calls.length, 1);
  assert.equal(calls[0]!.event, "ev");
  assert.equal(calls[0]!.props.token, "[REDACTED]");
  assert.equal(calls[0]!.props.ok, "y");
});

test("safeCapture swallows errors thrown by capture", () => {
  __resetClientCaptureState();
  assert.doesNotThrow(() => {
    safeCapture("ev", () => ({}), () => { throw new Error("boom"); });
  });
});

test("safeCapture swallows errors thrown by buildProps", () => {
  __resetClientCaptureState();
  assert.doesNotThrow(() => {
    safeCapture("ev", () => { throw new Error("build fail"); }, () => {});
  });
});

test("safeCapture re-entrancy guard prevents recursion", () => {
  __resetClientCaptureState();
  let count = 0;
  const recurse = () => {
    count += 1;
    safeCapture("ev", () => ({}), recurse); // capture 내부에서 다시 safeCapture
  };
  safeCapture("ev", () => ({}), recurse);
  assert.equal(count, 1); // 재귀가드로 1회만
});

test("__resetClientCaptureState clears the guard", () => {
  __resetClientCaptureState();
  let count = 0;
  safeCapture("ev", () => ({}), () => { count += 1; });
  __resetClientCaptureState();
  safeCapture("ev", () => ({}), () => { count += 1; });
  assert.equal(count, 2);
});

test("guard is reset after capture throws", () => {
  __resetClientCaptureState();
  let count = 0;
  safeCapture("ev", () => ({}), () => { throw new Error("boom"); });
  safeCapture("ev", () => ({}), () => { count += 1; });
  assert.equal(count, 1);
});
