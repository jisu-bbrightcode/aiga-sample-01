import { createHmac, timingSafeEqual } from "node:crypto";
import type { CloudflareStreamWebhookPayload } from "./types";

export interface ParsedWebhookSignature {
  time: number;
  sig1: string;
}

export function parseWebhookSignature(header: string): ParsedWebhookSignature | null {
  const parts = Object.fromEntries(
    header.split(",").map((part) => {
      const [key, value] = part.split("=");
      return [key?.trim(), value?.trim()];
    }),
  );
  const time = Number(parts.time);
  const sig1 = parts.sig1;
  if (!Number.isFinite(time) || !sig1) return null;
  return { time, sig1 };
}

export function verifyCloudflareStreamWebhookSignature(params: {
  rawBody: string | Buffer;
  signatureHeader: string;
  secret: string;
  nowSeconds?: number;
  toleranceSeconds?: number;
}): boolean {
  const parsed = parseWebhookSignature(params.signatureHeader);
  if (!parsed) return false;

  const now = params.nowSeconds ?? Math.floor(Date.now() / 1000);
  const tolerance = params.toleranceSeconds ?? 300;
  if (Math.abs(now - parsed.time) > tolerance) return false;

  const body = Buffer.isBuffer(params.rawBody) ? params.rawBody : Buffer.from(params.rawBody);
  const source = Buffer.concat([Buffer.from(`${parsed.time}.`), body]);
  const expected = createHmac("sha256", params.secret).update(source).digest("hex");
  const expectedBuffer = Buffer.from(expected, "hex");
  const actualBuffer = Buffer.from(parsed.sig1, "hex");

  if (expectedBuffer.length !== actualBuffer.length) return false;
  return timingSafeEqual(expectedBuffer, actualBuffer);
}

export function parseCloudflareStreamWebhookPayload(rawBody: string | Buffer) {
  return JSON.parse(
    Buffer.isBuffer(rawBody) ? rawBody.toString("utf8") : rawBody,
  ) as CloudflareStreamWebhookPayload;
}

export function deriveWebhookEventType(payload: CloudflareStreamWebhookPayload) {
  if (payload.status?.state === "error") return "webhook_failed";
  return payload.readyToStream === true ? "webhook_ready" : "webhook_processing";
}
