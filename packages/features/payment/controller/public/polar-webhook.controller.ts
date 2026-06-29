/**
 * PolarWebhookController — Fastify entry point for Polar HMAC-signed webhooks.
 *
 * Spec §4.3 (webhook flow), §8.B (signature/replay/order/flood), §8.A
 * (idempotency — handled by downstream services). This is the **G4 security
 * gate**: nothing reaches the dispatcher unless the standardwebhooks
 * signature verifies AND the signed timestamp is within the 5-minute
 * tolerance window.
 *
 * Production wiring (Phase 9):
 *   - The route is registered with Fastify's `@fastify/raw-body` plugin (or
 *     equivalent) so `req.rawBody: Buffer` is populated. We MUST verify the
 *     bytes Polar signed, not a JSON-parse-then-stringify roundtrip — that
 *     would change whitespace and bust HMAC.
 *
 * Empty-secret behavior (Phase 13 not yet configured):
 *   At construction we accept an empty `webhookSecret` without throwing —
 *   the standardwebhooks `Webhook` constructor would otherwise reject "" and
 *   prevent the server from booting. When `enabled === false` the handler
 *   replies 503 with a clear hint so the operator can wire `POLAR_WEBHOOK_SECRET`.
 *
 * Logging (§8.H1):
 *   Log webhook-id + payload.type on every accepted event for observability.
 *   Never log payload bodies (PII risk) or signature material.
 */
import crypto from "node:crypto";
import type { PolarWebhookDispatcher } from "../../webhooks/polar.webhook.dispatcher";

// Polar 의 webhook format='raw' 는 standardwebhooks 헤더 형태 (webhook-id /
// webhook-timestamp / webhook-signature: "v1,<base64>") 를 사용하지만,
// 서명 키는 secret 의 raw UTF-8 바이트 (polar_whs_ prefix 포함). 즉 표준
// standardwebhooks 의 base64-decoded key 가 아니다. 검증 절차는:
//   expected = base64(HMAC-SHA256(secret, `${id}.${ts}.${body}`))
//   header.signature 의 "v1," 이후 토큰과 timing-safe 비교
// 5-min replay window 도 직접 enforce.
const REPLAY_TOLERANCE_SEC = 5 * 60;

/** Minimal Fastify request shape we depend on. */
export interface RawWebhookRequest {
  rawBody?: Buffer;
  headers: Record<string, string | string[] | undefined>;
}

/** Minimal Fastify reply shape we depend on. */
export interface WebhookReply {
  code: (status: number) => WebhookReply;
  send: (body: unknown) => unknown;
}

export class PolarWebhookController {
  private readonly secret: string;

  constructor(
    webhookSecret: string,
    private readonly dispatcher: PolarWebhookDispatcher,
    private readonly logger: { info: (m: object) => void } = { info: () => {} },
  ) {
    // Polar webhook secret format: `polar_whs_<random>`. The full string is
    // the HMAC key (raw UTF-8 bytes). Empty secret = controller disabled,
    // returns 503 until POLAR_WEBHOOK_SECRET is wired.
    this.secret = webhookSecret;
  }

  get enabled(): boolean {
    return this.secret !== "";
  }

  async handle(req: RawWebhookRequest, reply: WebhookReply): Promise<unknown> {
    if (!this.enabled) {
      return reply.code(503).send({
        error: "webhook_not_configured",
        hint: "Set POLAR_WEBHOOK_SECRET",
      });
    }
    if (!req.rawBody) {
      return reply.code(400).send({ error: "raw_body_missing" });
    }

    const headers = headersToRecord(req.headers);
    const webhookId = headers["webhook-id"];
    const webhookTimestamp = headers["webhook-timestamp"];
    const webhookSignature = headers["webhook-signature"];
    if (!webhookId || !webhookTimestamp || !webhookSignature) {
      return reply.code(401).send({ error: "missing_webhook_headers" });
    }

    // Replay protection: timestamp must be within 5 min of now.
    const tsNum = Number.parseInt(webhookTimestamp, 10);
    if (!Number.isFinite(tsNum)) {
      return reply.code(401).send({ error: "invalid_timestamp" });
    }
    const skew = Math.abs(Math.floor(Date.now() / 1000) - tsNum);
    if (skew > REPLAY_TOLERANCE_SEC) {
      return reply.code(401).send({ error: "timestamp_out_of_range" });
    }

    // HMAC verify. Polar 'raw' format uses the secret string as the HMAC key.
    const body = req.rawBody.toString("utf8");
    const signedPayload = `${webhookId}.${webhookTimestamp}.${body}`;
    const expected = crypto
      .createHmac("sha256", this.secret)
      .update(signedPayload)
      .digest("base64");

    // header value can be space-separated: "v1,<sig> v1,<sig2>"
    const sigs = webhookSignature
      .split(" ")
      .map((s) => s.trim())
      .filter((s) => s.startsWith("v1,"))
      .map((s) => s.slice(3));
    const expectedBuf = Buffer.from(expected, "base64");
    const valid = sigs.some((s) => {
      try {
        const got = Buffer.from(s, "base64");
        return got.length === expectedBuf.length && crypto.timingSafeEqual(got, expectedBuf);
      } catch {
        return false;
      }
    });
    if (!valid) {
      return reply.code(401).send({ error: "invalid_signature" });
    }

    let payload: { type: string; data: Record<string, unknown> };
    try {
      payload = JSON.parse(body) as { type: string; data: Record<string, unknown> };
    } catch {
      return reply.code(400).send({ error: "invalid_json" });
    }

    this.logger.info({ msg: "polar.webhook", webhookId, type: payload.type });

    const out = await this.dispatcher.dispatch(payload, webhookId);
    if (out.result === "error") {
      return reply.code(500).send({ error: out.error });
    }
    // 'ok' and 'deferred' both reply 200 — Polar shouldn't retry deferred
    // (the Phase 6 reconcile cron handles retry for deferred).
    return reply.code(200).send({ received: true, result: out.result });
  }
}

function headersToRecord(
  h: Record<string, string | string[] | undefined>,
): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(h)) {
    const lk = k.toLowerCase();
    if (typeof v === "string") out[lk] = v;
    else if (Array.isArray(v) && v.length > 0) out[lk] = String(v[0]);
  }
  return out;
}
