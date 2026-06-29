/**
 * PolarWebhookController — Fastify HMAC entry point.
 *
 * 5 base tests — Phase 5 G4:
 *  1. invalid signature → 401
 *  2. valid signature → 200, dispatcher called with parsed payload + webhook-id
 *  3. missing rawBody → 400
 *  4. dispatcher returns 'error' → 500 with the error message
 *  5. webhookSecret empty → 503 + clear hint (Phase 13 not yet configured)
 *
 * 6 edge cases — Task 12 [P1 A]:
 *  1. skew >  5min       → 401 timestamp_out_of_range
 *  2. skew < -5min       → 401 timestamp_out_of_range
 *  3. skew == 5min       → 200 (tolerance is inclusive, `>` is strict)
 *  4. invalid timestamp  → 401 invalid_timestamp
 *  5. multi v1 sig       → 200 (one decoy + one real)
 *  6. empty secret + valid headers → 503 (boot-tolerance, never reaches verify)
 *
 * Refactor — Task 12 [P1 Q]:
 *   makeRequest delegates HMAC construction to buildPolarRawHeaders fixture
 *   (packages/features/payment/__fixtures__/polar/headers.fixture.ts) so the
 *   spec + integration share one source of truth.
 */
import { PolarWebhookController } from "./polar-webhook.controller";
import { buildPolarRawHeaders } from "../../__fixtures__/polar/headers.fixture";
import type {
  PolarWebhookDispatcher,
  PolarWebhookPayload,
} from "../../webhooks/polar.webhook.dispatcher";

// Polar 의 raw format secret — full string 이 HMAC key.
const SECRET = "polar_whs_testRawHmacSecret123";

interface ReplyState {
  status: number | null;
  body: unknown;
}

function makeReply(): { reply: import("./polar-webhook.controller").WebhookReply; state: ReplyState } {
  const state: ReplyState = { status: null, body: null };
  const reply = {
    code(s: number) {
      state.status = s;
      return reply;
    },
    send(b: unknown) {
      state.body = b;
      return reply;
    },
  };
  return { reply, state };
}

function makeRequest(
  body: object,
  secret: string,
  opts: {
    skewSeconds?: number;
    tamperSig?: boolean;
    prependDecoySig?: boolean;
    webhookId?: string;
  } = {},
): import("./polar-webhook.controller").RawWebhookRequest {
  const raw = Buffer.from(JSON.stringify(body), "utf8");
  const headers = buildPolarRawHeaders({
    rawBody: raw.toString("utf8"),
    secret,
    webhookId: opts.webhookId ?? "msg_test_1",
    timestampSec: Math.floor(Date.now() / 1000) + (opts.skewSeconds ?? 0),
    tamperSig: opts.tamperSig,
    prependDecoySig: opts.prependDecoySig,
  });
  return { rawBody: raw, headers: { ...headers } };
}

function makeDispatcher(
  fn: jest.Mock,
): PolarWebhookDispatcher {
  return { dispatch: fn } as unknown as PolarWebhookDispatcher;
}

describe("PolarWebhookController", () => {
  it("invalid signature → 401", async () => {
    const dispatch = jest.fn();
    const ctrl = new PolarWebhookController(SECRET, makeDispatcher(dispatch));
    const req = makeRequest(
      { type: "subscription.created", data: { id: "polar_sub_1" } },
      SECRET,
      { tamperSig: true },
    );
    const { reply, state } = makeReply();
    await ctrl.handle(req, reply);
    expect(state.status).toBe(401);
    expect(dispatch).not.toHaveBeenCalled();
  });

  it("valid signature → 200 + dispatcher invoked with parsed payload", async () => {
    const dispatch = jest.fn().mockResolvedValue({ result: "ok" });
    const ctrl = new PolarWebhookController(SECRET, makeDispatcher(dispatch));
    const body = {
      type: "subscription.created",
      data: { id: "polar_sub_1", status: "active" },
    };
    const req = makeRequest(body, SECRET);
    const { reply, state } = makeReply();
    await ctrl.handle(req, reply);
    expect(state.status).toBe(200);
    expect(dispatch).toHaveBeenCalledTimes(1);
    const [payload, eventId] = dispatch.mock.calls[0]!;
    expect((payload as PolarWebhookPayload).type).toBe("subscription.created");
    expect(eventId).toBe("msg_test_1");
  });

  it("missing rawBody → 400", async () => {
    const ctrl = new PolarWebhookController(SECRET, makeDispatcher(jest.fn()));
    const { reply, state } = makeReply();
    await ctrl.handle({ headers: {} }, reply);
    expect(state.status).toBe(400);
  });

  it("dispatcher returns 'error' → 500", async () => {
    const dispatch = jest
      .fn()
      .mockResolvedValue({ result: "error", error: "boom" });
    const ctrl = new PolarWebhookController(SECRET, makeDispatcher(dispatch));
    const req = makeRequest(
      { type: "payment.succeeded", data: { subscription_id: "x" } },
      SECRET,
    );
    const { reply, state } = makeReply();
    await ctrl.handle(req, reply);
    expect(state.status).toBe(500);
    expect((state.body as { error: string }).error).toBe("boom");
  });

  it("empty webhookSecret → 503 webhook_not_configured", async () => {
    const ctrl = new PolarWebhookController("", makeDispatcher(jest.fn()));
    expect(ctrl.enabled).toBe(false);
    const { reply, state } = makeReply();
    // rawBody can be anything — we never reach verification.
    await ctrl.handle(
      { rawBody: Buffer.from("{}"), headers: {} },
      reply,
    );
    expect(state.status).toBe(503);
    expect((state.body as { error: string }).error).toBe(
      "webhook_not_configured",
    );
    expect((state.body as { hint: string }).hint).toMatch(
      /POLAR_WEBHOOK_SECRET/,
    );
  });
});

describe("PolarWebhookController — signature edge cases [A]", () => {
  it("skew > 5min → 401 timestamp_out_of_range", async () => {
    const ctrl = new PolarWebhookController(SECRET, makeDispatcher(jest.fn()));
    const req = makeRequest(
      { type: "subscription.created", data: { id: "x" } },
      SECRET,
      { skewSeconds: 6 * 60 },
    );
    const { reply, state } = makeReply();
    await ctrl.handle(req, reply);
    expect(state.status).toBe(401);
    expect((state.body as { error: string }).error).toBe(
      "timestamp_out_of_range",
    );
  });

  it("skew < -5min → 401 timestamp_out_of_range", async () => {
    const ctrl = new PolarWebhookController(SECRET, makeDispatcher(jest.fn()));
    const req = makeRequest(
      { type: "subscription.created", data: { id: "x" } },
      SECRET,
      { skewSeconds: -6 * 60 },
    );
    const { reply, state } = makeReply();
    await ctrl.handle(req, reply);
    expect(state.status).toBe(401);
    expect((state.body as { error: string }).error).toBe(
      "timestamp_out_of_range",
    );
  });

  it("skew at exact 5min boundary → 200 (tolerance is inclusive)", async () => {
    const dispatch = jest.fn().mockResolvedValue({ result: "ok" });
    const ctrl = new PolarWebhookController(SECRET, makeDispatcher(dispatch));
    const req = makeRequest(
      { type: "subscription.created", data: { id: "x" } },
      SECRET,
      { skewSeconds: 5 * 60 },
    );
    const { reply, state } = makeReply();
    await ctrl.handle(req, reply);
    expect(state.status).toBe(200);
  });

  it("invalid timestamp format (non-numeric) → 401 invalid_timestamp", async () => {
    const ctrl = new PolarWebhookController(SECRET, makeDispatcher(jest.fn()));
    const raw = Buffer.from(
      JSON.stringify({ type: "subscription.created", data: { id: "x" } }),
    );
    const req = {
      rawBody: raw,
      headers: {
        "webhook-id": "msg_1",
        "webhook-timestamp": "not-a-number",
        "webhook-signature": "v1,xxx",
      },
    };
    const { reply, state } = makeReply();
    await ctrl.handle(req, reply);
    expect(state.status).toBe(401);
    expect((state.body as { error: string }).error).toBe("invalid_timestamp");
  });

  it("multi v1 sig (one valid, one decoy) → 200", async () => {
    const dispatch = jest.fn().mockResolvedValue({ result: "ok" });
    const ctrl = new PolarWebhookController(SECRET, makeDispatcher(dispatch));
    const req = makeRequest(
      { type: "subscription.created", data: { id: "x" } },
      SECRET,
      { prependDecoySig: true },
    );
    const { reply, state } = makeReply();
    await ctrl.handle(req, reply);
    expect(state.status).toBe(200);
  });

  it("empty webhookSecret + valid headers still 503 (constructor accepts empty for boot)", async () => {
    const ctrl = new PolarWebhookController("", makeDispatcher(jest.fn()));
    const req = makeRequest(
      { type: "subscription.created", data: { id: "x" } },
      "anything",
    );
    const { reply, state } = makeReply();
    await ctrl.handle(req, reply);
    expect(state.status).toBe(503);
  });
});
