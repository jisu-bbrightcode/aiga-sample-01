import assert from 'node:assert/strict';
import { test } from 'node:test';

import {
  DEFAULT_RETRY_POLICY,
  nextDelayMs,
  shouldRetry,
} from '../lib/retry-policy.ts';

test('nextDelayMs is exponential and capped', () => {
  const p = { maxAttempts: 5, baseDelayMs: 1000, maxDelayMs: 30000, factor: 2 };
  assert.equal(nextDelayMs(0, p), 1000);
  assert.equal(nextDelayMs(1, p), 2000);
  assert.equal(nextDelayMs(2, p), 4000);
  assert.equal(nextDelayMs(10, p), 30000); // capped
  assert.equal(nextDelayMs(-1, p), 0);
});

test('shouldRetry honors retryable flag and attempt budget', () => {
  const p = DEFAULT_RETRY_POLICY; // maxAttempts 3
  assert.equal(shouldRetry({ attempt: 0, retryable: true, policy: p }), true);
  assert.equal(shouldRetry({ attempt: 1, retryable: true, policy: p }), true);
  assert.equal(shouldRetry({ attempt: 2, retryable: true, policy: p }), false); // budget exhausted
  assert.equal(shouldRetry({ attempt: 0, retryable: false, policy: p }), false); // permanent
});
