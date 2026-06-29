import { describe, expect, it, jest } from "@jest/globals";
import { PolarAdapter } from "./polar.adapter";
import { PolarApiError, PaymentRetriableError } from "../common/errors";
import type { PaymentConfig } from "../config/payment.config";

const cfg: PaymentConfig = {
  token: "polar_oat_test",
  env: "sandbox",
  organizationId: "org_test",
  webhookSecret: "",
  apiBaseUrl: "https://sandbox-api.polar.sh",
};

function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

describe("PolarAdapter", () => {
  describe("createCheckout", () => {
    it("returns url + checkoutId on 201", async () => {
      const fetchImpl = jest.fn(
        async () =>
          jsonResponse(201, {
            id: "co_abc",
            url: "https://sandbox.polar.sh/checkout/co_abc",
          }),
      );
      const adapter = new PolarAdapter(cfg, fetchImpl as never);

      const res = await adapter.createCheckout({
        productId: "prod_123",
        customerEmail: "qa@example.com",
        customerExternalId: "org_acme",
        successUrl: "https://example.com/billing/success",
        metadata: { plan: "pro_monthly" },
      });

      expect(res).toEqual({
        url: "https://sandbox.polar.sh/checkout/co_abc",
        checkoutId: "co_abc",
      });
      // bearer + body shape
      expect(fetchImpl).toHaveBeenCalledTimes(1);
      const [url, init] = fetchImpl.mock.calls[0]! as unknown as [string, RequestInit];
      expect(url).toBe("https://sandbox-api.polar.sh/v1/checkouts/");
      expect(init.method).toBe("POST");
      const headers = init.headers as Record<string, string>;
      expect(headers.Authorization).toBe("Bearer polar_oat_test");
      const body = JSON.parse(init.body as string);
      expect(body.products).toEqual(["prod_123"]);
      expect(body.external_customer_id).toBe("org_acme");
      expect(body.metadata).toEqual({ plan: "pro_monthly" });
    });

    it("throws PolarApiError on 422 (no retry)", async () => {
      const fetchImpl = jest.fn(
        async () =>
          jsonResponse(422, {
            type: "validation_error",
            detail: "products: must not be empty",
          }),
      );
      const adapter = new PolarAdapter(cfg, fetchImpl as never);

      await expect(
        adapter.createCheckout({
          productId: "",
          customerEmail: "qa@example.com",
          customerExternalId: "org_acme",
          successUrl: "https://example.com/billing/success",
        }),
      ).rejects.toMatchObject({
        name: "PolarApiError",
        status: 422,
        code: "validation_error",
      });
      // 4xx must NOT retry
      expect(fetchImpl).toHaveBeenCalledTimes(1);
    });

    it("retries on 5xx (3 attempts) then succeeds", async () => {
      const fetchImpl = jest
        .fn<() => Promise<Response>>()
        .mockResolvedValueOnce(jsonResponse(503, { detail: "service down" }))
        .mockResolvedValueOnce(jsonResponse(502, { detail: "bad gateway" }))
        .mockResolvedValueOnce(
          jsonResponse(201, {
            id: "co_xyz",
            url: "https://sandbox.polar.sh/checkout/co_xyz",
          }),
        );

      const adapter = new PolarAdapter(cfg, fetchImpl as never);
      const res = await adapter.createCheckout({
        productId: "prod_x",
        customerEmail: "qa@example.com",
        customerExternalId: "org_acme",
        successUrl: "https://example.com/ok",
      });

      expect(res.checkoutId).toBe("co_xyz");
      expect(fetchImpl).toHaveBeenCalledTimes(3);
    }, 10_000);

    it("gives up with PaymentRetriableError after 4 total 5xx attempts", async () => {
      const fetchImpl = jest.fn(
        async () => jsonResponse(503, { detail: "down" }),
      );
      const adapter = new PolarAdapter(cfg, fetchImpl as never);

      await expect(
        adapter.createCheckout({
          productId: "p",
          customerEmail: "a@b.c",
          customerExternalId: "o",
          successUrl: "https://ok",
        }),
      ).rejects.toBeInstanceOf(PaymentRetriableError);
      // 1 initial + 3 retries
      expect(fetchImpl).toHaveBeenCalledTimes(4);
    }, 10_000);
  });

  describe("getSubscription", () => {
    it("maps Polar subscription → PolarSubscription", async () => {
      const fetchImpl = jest.fn(async () =>
        jsonResponse(200, {
          id: "sub_1",
          customer_id: "cust_1",
          product_id: "prod_1",
          status: "active",
          current_period_start: "2026-04-01T00:00:00Z",
          current_period_end: "2026-05-01T00:00:00Z",
          trial_end: null,
          cancel_at_period_end: false,
          metadata: { plan: "pro" },
        }),
      );
      const adapter = new PolarAdapter(cfg, fetchImpl as never);

      const sub = await adapter.getSubscription("sub_1");

      expect(sub.id).toBe("sub_1");
      expect(sub.status).toBe("active");
      expect(sub.currentPeriodStart).toBeInstanceOf(Date);
      expect(sub.currentPeriodEnd?.toISOString()).toBe(
        "2026-05-01T00:00:00.000Z",
      );
      expect(sub.metadata).toEqual({ plan: "pro" });

      const [url, init] = fetchImpl.mock.calls[0]! as unknown as [string, RequestInit];
      expect(url).toBe("https://sandbox-api.polar.sh/v1/subscriptions/sub_1");
      expect(init.method).toBe("GET");
    });

    it("throws PolarApiError on unknown status", async () => {
      const fetchImpl = jest.fn(async () =>
        jsonResponse(200, {
          id: "sub_1",
          customer_id: "c",
          product_id: "p",
          status: "weird",
          current_period_start: "2026-04-01T00:00:00Z",
          current_period_end: null,
          trial_end: null,
          cancel_at_period_end: false,
        }),
      );
      const adapter = new PolarAdapter(cfg, fetchImpl as never);
      await expect(adapter.getSubscription("sub_1")).rejects.toBeInstanceOf(
        PolarApiError,
      );
    });
  });

  describe("token hygiene", () => {
    it("never includes the token in error messages", async () => {
      const fetchImpl = jest.fn(async () =>
        jsonResponse(403, { type: "forbidden", detail: "nope" }),
      );
      const adapter = new PolarAdapter(cfg, fetchImpl as never);
      let thrown: unknown;
      try {
        await adapter.getSubscription("sub_x");
      } catch (e) {
        thrown = e;
      }
      expect(thrown).toBeDefined();
      expect(String(thrown)).not.toContain("polar_oat_test");
    });
  });

  describe("customer_external_id is user.id [G]", () => {
    it("forwards customerExternalId verbatim into externalCustomerId", async () => {
      const fetchImpl = jest.fn(
        async () =>
          jsonResponse(201, {
            id: "co_user",
            url: "https://sandbox.polar.sh/checkout/co_user",
          }),
      );
      const adapter = new PolarAdapter(cfg, fetchImpl as never);

      await adapter.createCheckout({
        productId: "prod_1",
        customerEmail: "u@x.io",
        customerExternalId: "user_qa_01",
        successUrl: "https://app.example.com/payment/success",
      });

      const [, init] = fetchImpl.mock.calls[0]! as unknown as [string, RequestInit];
      const body = JSON.parse(init.body as string);
      expect(body.external_customer_id).toBe("user_qa_01");
    });
  });

  describe("updateSubscription", () => {
    it("PATCH /v1/subscriptions/{id} with snake_case body and proration_behavior", async () => {
      const fetchMock = jest.fn(async () =>
        jsonResponse(200, {
          id: "sub_xyz",
          customer_id: "cust_1",
          product_id: "prod_premium",
          status: "active",
          current_period_start: "2026-04-01T00:00:00Z",
          current_period_end: "2026-05-26T00:00:00Z",
          trial_end: null,
          cancel_at_period_end: false,
        }),
      );
      const adapter = new PolarAdapter(cfg, fetchMock as never);

      await adapter.updateSubscription("sub_xyz", {
        product_id: "prod_premium",
        proration_behavior: "invoice",
      });

      expect(fetchMock).toHaveBeenCalledTimes(1);
      const [url, init] = fetchMock.mock.calls[0]! as unknown as [string, RequestInit];
      expect(url).toBe("https://sandbox-api.polar.sh/v1/subscriptions/sub_xyz");
      expect(init.method).toBe("PATCH");
      const body = JSON.parse(init.body as string);
      expect(body).toEqual({
        product_id: "prod_premium",
        proration_behavior: "invoice",
      });
    });

    it("PATCH with cancel_at_period_end toggle (uncancel)", async () => {
      const fetchMock = jest.fn(async () =>
        jsonResponse(200, {
          id: "sub_xyz",
          customer_id: "cust_1",
          product_id: "prod_p",
          status: "active",
          current_period_start: "2026-04-01T00:00:00Z",
          current_period_end: "2026-05-01T00:00:00Z",
          trial_end: null,
          cancel_at_period_end: false,
        }),
      );
      const adapter = new PolarAdapter(cfg, fetchMock as never);

      await adapter.updateSubscription("sub_xyz", { cancel_at_period_end: false });

      const [, init] = fetchMock.mock.calls[0]! as unknown as [string, RequestInit];
      const body = JSON.parse(init.body as string);
      expect(body).toEqual({ cancel_at_period_end: false });
    });
  });

  describe("revokeSubscription", () => {
    it("POST /v1/subscriptions/{id}/cancel with revoke=true", async () => {
      const fetchMock = jest.fn(async () =>
        jsonResponse(200, {
          id: "sub_xyz",
          customer_id: "cust_1",
          product_id: "prod_p",
          status: "canceled",
          current_period_start: "2026-04-01T00:00:00Z",
          current_period_end: "2026-05-01T00:00:00Z",
          trial_end: null,
          cancel_at_period_end: false,
        }),
      );
      const adapter = new PolarAdapter(cfg, fetchMock as never);

      await adapter.revokeSubscription("sub_xyz");

      const [url, init] = fetchMock.mock.calls[0]! as unknown as [string, RequestInit];
      expect(url).toBe(
        "https://sandbox-api.polar.sh/v1/subscriptions/sub_xyz/cancel",
      );
      expect(init.method).toBe("POST");
      expect(JSON.parse(init.body as string)).toEqual({ revoke: true });
    });
  });

  describe("cancelSubscription (legacy wrapper)", () => {
    it("atPeriodEnd=true → PATCH cancel_at_period_end=true", async () => {
      const fetchMock = jest.fn(async () =>
        new Response(
          JSON.stringify({
            id: "sub_xyz",
            status: "active",
            current_period_start: "2026-04-01T00:00:00Z",
            current_period_end: "2026-05-01T00:00:00Z",
            customer_id: "cus_1",
            product_id: "prod_x",
            cancel_at_period_end: true,
          }),
          { status: 200, headers: { "Content-Type": "application/json" } },
        ),
      );
      const adapter = new PolarAdapter(
        {
          apiBaseUrl: "https://api.polar.sh",
          token: "tok",
          organizationId: "org_1",
          env: "production",
          webhookSecret: "",
        },
        fetchMock as unknown as typeof fetch,
      );

      await adapter.cancelSubscription("sub_xyz", true);

      const [url, init] = fetchMock.mock.calls[0]! as unknown as [string, RequestInit];
      expect(url).toBe("https://api.polar.sh/v1/subscriptions/sub_xyz");
      expect(init.method).toBe("PATCH");
      expect(JSON.parse(init.body as string)).toEqual({
        cancel_at_period_end: true,
      });
    });

    it("atPeriodEnd=false → POST /cancel revoke=true (delegates to revokeSubscription)", async () => {
      const fetchMock = jest.fn(async () =>
        new Response(
          JSON.stringify({
            id: "sub_xyz",
            status: "canceled",
            current_period_start: "2026-04-01T00:00:00Z",
            current_period_end: "2026-04-15T00:00:00Z",
            customer_id: "cus_1",
            product_id: "prod_x",
            cancel_at_period_end: false,
          }),
          { status: 200, headers: { "Content-Type": "application/json" } },
        ),
      );
      const adapter = new PolarAdapter(
        {
          apiBaseUrl: "https://api.polar.sh",
          token: "tok",
          organizationId: "org_1",
          env: "production",
          webhookSecret: "",
        },
        fetchMock as unknown as typeof fetch,
      );

      await adapter.cancelSubscription("sub_xyz", false);

      const [url, init] = fetchMock.mock.calls[0]! as unknown as [string, RequestInit];
      expect(url).toBe("https://api.polar.sh/v1/subscriptions/sub_xyz/cancel");
      expect(init.method).toBe("POST");
      expect(JSON.parse(init.body as string)).toEqual({ revoke: true });
    });
  });

  describe("idempotency-key forwarding [H verification]", () => {
    it("forwards Idempotency-Key header when provided", async () => {
      const fetchImpl = jest.fn(
        async () =>
          jsonResponse(201, {
            id: "co_idem",
            url: "https://sandbox.polar.sh/checkout/co_idem",
          }),
      );
      const adapter = new PolarAdapter(cfg, fetchImpl as never);

      await adapter.createCheckout({
        productId: "prod_p",
        customerEmail: "u@x.io",
        customerExternalId: "user_1",
        successUrl: "https://app.example.com/payment/success",
        idempotencyKey: "user_1:prod_p:12345",
      });

      const [, init] = fetchImpl.mock.calls[0]! as unknown as [string, RequestInit];
      const headers = init.headers as Record<string, string>;
      expect(headers["Idempotency-Key"]).toBe("user_1:prod_p:12345");
    });

    it("omits Idempotency-Key header when not provided", async () => {
      const fetchImpl = jest.fn(
        async () =>
          jsonResponse(201, {
            id: "co_no_idem",
            url: "https://sandbox.polar.sh/checkout/co_no_idem",
          }),
      );
      const adapter = new PolarAdapter(cfg, fetchImpl as never);

      await adapter.createCheckout({
        productId: "prod_p",
        customerEmail: "u@x.io",
        customerExternalId: "user_1",
        successUrl: "https://app.example.com/payment/success",
      });

      const [, init] = fetchImpl.mock.calls[0]! as unknown as [string, RequestInit];
      const headers = init.headers as Record<string, string>;
      expect(headers["Idempotency-Key"]).toBeUndefined();
    });
  });
});
