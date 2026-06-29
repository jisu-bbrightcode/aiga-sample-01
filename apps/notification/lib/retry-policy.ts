/**
 * Retry policy (PB-NOTI-001, acceptance #3:
 * "발송 이력과 실패 재시도 정책이 정의되어 있다" — the retry half).
 *
 * A provider failure is retried only when {@link ProviderResult.retryable} is
 * true (rate limit / 5xx / network). Backoff is exponential with a cap; the
 * attempt count is persisted to history as `retryCount` so retries are
 * auditable and a dead-letter sweep can pick up exhausted sends.
 */

/** Tunable retry parameters. Defaults are conservative for transactional mail. */
export interface RetryPolicy {
  /** Total attempts including the first (so `3` = 1 try + 2 retries). */
  maxAttempts: number;
  /** Base backoff in ms for the first retry. */
  baseDelayMs: number;
  /** Hard ceiling on any single backoff. */
  maxDelayMs: number;
  /** Multiplier applied per retry (2 = exponential). */
  factor: number;
}

export const DEFAULT_RETRY_POLICY: RetryPolicy = {
  maxAttempts: 3,
  baseDelayMs: 1_000,
  maxDelayMs: 30_000,
  factor: 2,
};

/**
 * Backoff before the retry that follows `attempt` (0-based: the delay after the
 * first failed attempt is `nextDelayMs(0)`). Deterministic — jitter is the
 * caller's concern so this stays unit-testable without a clock.
 */
export function nextDelayMs(attempt: number, policy: RetryPolicy): number {
  if (attempt < 0) return 0;
  const raw = policy.baseDelayMs * policy.factor ** attempt;
  return Math.min(raw, policy.maxDelayMs);
}

/**
 * Should another attempt be made after a failure?
 *   - `attempt` is 0-based (0 = the first attempt just failed).
 *   - retry only when the provider marked the failure retryable AND we have
 *     attempts left.
 */
export function shouldRetry(input: {
  attempt: number;
  retryable: boolean;
  policy: RetryPolicy;
}): boolean {
  const { attempt, retryable, policy } = input;
  if (!retryable) return false;
  return attempt + 1 < policy.maxAttempts;
}

/** Async sleeper port so tests can run retries without real timers. */
export type Sleeper = (ms: number) => Promise<void>;

/** Real-timer sleeper for production. */
export const realSleeper: Sleeper = (ms) =>
  new Promise((resolve) => setTimeout(resolve, ms));
