/**
 * Payment domain errors.
 *
 * - PolarApiError: thrown when Polar returns a non-2xx response we cannot retry.
 *   Carries HTTP status + Polar error code + raw detail (for logging / mapping
 *   in upper layers, e.g. tRPC error codes).
 * - PaymentRetriableError: thrown after exhausting retries for transient
 *   failures (5xx, 429, network). Upper layers may surface as 503.
 */

export class PolarApiError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: string,
    message: string,
    public readonly detail?: unknown,
  ) {
    super(`[polar] ${status} ${code}: ${message}`);
    this.name = "PolarApiError";
  }
}

export class PaymentRetriableError extends Error {
  constructor(message: string, public readonly cause?: unknown) {
    super(`[polar] retries exhausted: ${message}`);
    this.name = "PaymentRetriableError";
  }
}
