/**
 * PolarAdapter — server-side wrapper around the Polar.sh REST API.
 *
 * Why hand-rolled fetch (and not @polar-sh/sdk)?
 *   • The plan / spec §5 mandates a precise retry policy (200/400/800 ms
 *     exponential backoff on 5xx and 429, max 3) and structured error
 *     mapping (`PolarApiError` with status + code). The SDK does not expose
 *     a clean hook for that.
 *   • The SDK ships `zod/v4-mini` and complex generated unions for trivial
 *     calls (e.g. four discount-create variants for a single endpoint),
 *     bloating our test surface.
 *   • Our public surface is small (six methods) and stable per spec §5.
 *
 * The adapter is the only place in the codebase that should know the Polar
 * wire format — consumers see `CheckoutRequest`, `PolarSubscription`, etc.
 *
 * Secret hygiene: the bearer token is never logged. Errors only carry
 * status / code / response body (no headers).
 *
 * Idempotency: Polar's `/v1/checkouts/` is naturally idempotent on the
 * caller's input. A future change in the tRPC layer will pass an
 * `idempotency-key` header (spec §5.7) — this adapter accepts an optional
 * `headers` extension for that.
 */

import { PolarApiError, PaymentRetriableError } from "../common/errors";
import type { PaymentConfig } from "../config/payment.config";
import type {
  CheckoutRequest,
  CheckoutResponse,
  DiscountCreateInput,
  DiscountCreateResponse,
  PolarSubscription,
  PolarSubscriptionStatus,
  RefundResponse,
} from "../common/types";

type FetchLike = (
  input: string,
  init?: RequestInit,
) => Promise<Response>;

interface RequestOpts {
  method: "GET" | "POST" | "PATCH" | "DELETE";
  path: string;
  body?: unknown;
  /** caller-supplied extra headers (e.g. Idempotency-Key) */
  headers?: Record<string, string>;
}

const RETRY_DELAYS_MS = [200, 400, 800] as const;

function isRetriableStatus(status: number): boolean {
  return status === 429 || (status >= 500 && status < 600);
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

export class PolarAdapter {
  private readonly fetchImpl: FetchLike;

  constructor(
    private readonly cfg: PaymentConfig,
    fetchImpl?: FetchLike,
  ) {
    this.fetchImpl = fetchImpl ?? (globalThis.fetch as FetchLike);
    if (!this.fetchImpl) {
      throw new Error(
        "[polar.adapter] no fetch implementation available — pass one explicitly",
      );
    }
  }

  // ───────────────────────────── public API ─────────────────────────────

  async createCheckout(req: CheckoutRequest): Promise<CheckoutResponse> {
    // Polar /v1/checkouts requires snake_case field names — sandbox API silently
    // ignores camelCase fields and falls back to defaults (e.g. successUrl camelCase
    // → success_url null → Polar's own confirmation page instead of our app).
    const body: Record<string, unknown> = {
      products: [req.productId],
      customer_email: req.customerEmail,
      external_customer_id: req.customerExternalId,
      success_url: req.successUrl,
    };
    if (req.customerName !== undefined) body.customer_name = req.customerName;
    if (req.metadata !== undefined) body.metadata = req.metadata;
    if (req.discountId !== undefined) body.discount_id = req.discountId;

    const data = await this.request<{ id: string; url: string }>({
      method: "POST",
      path: "/v1/checkouts/",
      body,
      headers: req.idempotencyKey
        ? { "Idempotency-Key": req.idempotencyKey }
        : undefined,
    });
    return { url: data.url, checkoutId: data.id };
  }

  async getSubscription(id: string): Promise<PolarSubscription> {
    const raw = await this.request<RawSubscription>({
      method: "GET",
      path: `/v1/subscriptions/${encodeURIComponent(id)}`,
    });
    return mapSubscription(raw);
  }

  /**
   * Polar PATCH /v1/subscriptions/{id} 통합 진입점.
   *  - product_id 변경 → upgrade/downgrade
   *  - cancel_at_period_end 토글 → cancel/uncancel
   *  - proration_behavior: 'invoice' (즉시 차액) | 'prorate' (다음 청구) | 'next_period' (proration 없음)
   *
   * 모든 필드는 snake_case (Polar REST API 규약, payment v2 fixup 사고 #58).
   */
  async updateSubscription(
    id: string,
    body: {
      product_id?: string;
      proration_behavior?: "invoice" | "prorate" | "next_period";
      cancel_at_period_end?: boolean;
    },
  ): Promise<PolarSubscription> {
    const raw = await this.request<RawSubscription>({
      method: "PATCH",
      path: `/v1/subscriptions/${encodeURIComponent(id)}`,
      body,
    });
    return mapSubscription(raw);
  }

  /** 즉시 취소 (revoke). 14일 이내 환불 + 즉시 종료 시 사용. */
  async revokeSubscription(id: string): Promise<PolarSubscription> {
    const raw = await this.request<RawSubscription>({
      method: "POST",
      path: `/v1/subscriptions/${encodeURIComponent(id)}/cancel`,
      body: { revoke: true },
    });
    return mapSubscription(raw);
  }

  /**
   * Cancel a subscription. By default cancels at period end; pass `atPeriodEnd=false`
   * to revoke immediately.
   *
   * @deprecated Prefer `updateSubscription({ cancel_at_period_end: true })` or
   *   `revokeSubscription(id)` directly. Kept for v1 admin compatibility.
   */
  async cancelSubscription(
    id: string,
    atPeriodEnd = true,
  ): Promise<PolarSubscription> {
    return atPeriodEnd
      ? this.updateSubscription(id, { cancel_at_period_end: true })
      : this.revokeSubscription(id);
  }

  async refundOrder(
    orderId: string,
    amountCents?: number,
    reason = "customer_request",
  ): Promise<RefundResponse> {
    const body: Record<string, unknown> = { order_id: orderId, reason };
    if (amountCents !== undefined) body.amount = amountCents;
    const data = await this.request<{ id: string; status: string }>({
      method: "POST",
      path: "/v1/refunds/",
      body,
    });
    return { id: data.id, status: data.status };
  }

  async createDiscount(
    input: DiscountCreateInput,
  ): Promise<DiscountCreateResponse> {
    if (input.type === "percentage" && input.percentage === undefined) {
      throw new Error(
        "[polar.adapter] percentage discount requires `percentage`",
      );
    }
    if (input.type === "fixed" && input.amountCents === undefined) {
      throw new Error(
        "[polar.adapter] fixed discount requires `amountCents`",
      );
    }
    if (input.duration === "repeating" && !input.durationInMonths) {
      throw new Error(
        "[polar.adapter] repeating discount requires `durationInMonths`",
      );
    }

    const body: Record<string, unknown> = {
      organization_id: this.cfg.organizationId,
      code: input.code,
      duration: input.duration,
      type: input.type,
    };
    if (input.type === "percentage") body.basis_points = input.percentage! * 100;
    if (input.type === "fixed") body.amount = input.amountCents;
    if (input.duration === "repeating") {
      body.duration_in_months = input.durationInMonths;
    }
    if (input.maxRedemptions !== undefined) {
      body.max_redemptions = input.maxRedemptions;
    }
    if (input.expiresAt !== undefined) {
      body.ends_at = input.expiresAt.toISOString();
    }

    const data = await this.request<{ id: string; code: string }>({
      method: "POST",
      path: "/v1/discounts/",
      body,
    });
    return { id: data.id, code: data.code };
  }

  /** List orders for the configured organization. Cursor-based via `after`. */
  async listOrders(limit = 50, after?: string): Promise<unknown> {
    const qs = new URLSearchParams({
      organization_id: this.cfg.organizationId,
      limit: String(limit),
    });
    if (after) qs.set("page", after);
    return this.request({
      method: "GET",
      path: `/v1/orders/?${qs.toString()}`,
    });
  }

  // ─────────────────────────── transport ───────────────────────────────

  private async request<T>(opts: RequestOpts): Promise<T> {
    const url = `${this.cfg.apiBaseUrl}${opts.path}`;
    const headers: Record<string, string> = {
      Authorization: `Bearer ${this.cfg.token}`,
      Accept: "application/json",
      ...(opts.headers ?? {}),
    };
    if (opts.body !== undefined) {
      headers["Content-Type"] = "application/json";
    }

    let lastErr: unknown;
    for (let attempt = 0; attempt <= RETRY_DELAYS_MS.length; attempt++) {
      let res: Response;
      try {
        res = await this.fetchImpl(url, {
          method: opts.method,
          headers,
          body:
            opts.body === undefined ? undefined : JSON.stringify(opts.body),
        });
      } catch (networkErr) {
        // network-level failure → retry
        lastErr = networkErr;
        if (attempt < RETRY_DELAYS_MS.length) {
          await sleep(RETRY_DELAYS_MS[attempt]!);
          continue;
        }
        throw new PaymentRetriableError(
          `network error to ${opts.method} ${opts.path}`,
          networkErr,
        );
      }

      if (res.ok) {
        // 204 No Content
        if (res.status === 204) return undefined as T;
        return (await res.json()) as T;
      }

      if (isRetriableStatus(res.status)) {
        if (attempt < RETRY_DELAYS_MS.length) {
          lastErr = await safeReadBody(res);
          await sleep(RETRY_DELAYS_MS[attempt]!);
          continue;
        }
        // retriable status but no retries left
        throw new PaymentRetriableError(
          `${opts.method} ${opts.path} retries exhausted (last status ${res.status})`,
          await safeReadBody(res),
        );
      }

      // non-retriable → map to PolarApiError
      const detail = await safeReadBody(res);
      const { code, message } = extractError(detail);
      throw new PolarApiError(res.status, code, message, detail);
    }

    // unreachable — loop always returns or throws
    throw new PaymentRetriableError(
      `${opts.method} ${opts.path} unexpected fallthrough`,
      lastErr,
    );
  }
}

// ───────────────────────── internal helpers ─────────────────────────────

interface RawSubscription {
  id: string;
  customer_id: string;
  product_id: string;
  status: string;
  current_period_start: string;
  current_period_end: string | null;
  trial_end: string | null;
  cancel_at_period_end: boolean;
  metadata?: Record<string, string>;
}

const ALLOWED_SUB_STATUSES: readonly PolarSubscriptionStatus[] = [
  "trialing",
  "active",
  "past_due",
  "canceled",
  "incomplete",
];

function mapSubscription(raw: RawSubscription): PolarSubscription {
  if (!ALLOWED_SUB_STATUSES.includes(raw.status as PolarSubscriptionStatus)) {
    throw new PolarApiError(
      0,
      "unknown_status",
      `unexpected subscription status: ${raw.status}`,
      raw,
    );
  }
  return {
    id: raw.id,
    customerId: raw.customer_id,
    productId: raw.product_id,
    status: raw.status as PolarSubscriptionStatus,
    currentPeriodStart: new Date(raw.current_period_start),
    currentPeriodEnd: raw.current_period_end ? new Date(raw.current_period_end) : null,
    trialEnd: raw.trial_end ? new Date(raw.trial_end) : null,
    cancelAtPeriodEnd: raw.cancel_at_period_end,
    metadata: raw.metadata ?? {},
  };
}

async function safeReadBody(res: Response): Promise<unknown> {
  const text = await res.text().catch(() => "");
  if (!text) return null;
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}

function extractError(body: unknown): { code: string; message: string } {
  if (body && typeof body === "object") {
    const b = body as Record<string, unknown>;
    const code =
      typeof b.type === "string"
        ? b.type
        : typeof b.error === "string"
          ? b.error
          : "unknown";
    const message =
      typeof b.detail === "string"
        ? b.detail
        : typeof b.message === "string"
          ? b.message
          : "Polar API error";
    return { code, message };
  }
  return { code: "unknown", message: String(body ?? "Polar API error") };
}
