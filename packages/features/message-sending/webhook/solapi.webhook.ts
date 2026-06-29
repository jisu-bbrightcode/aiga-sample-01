import crypto from "node:crypto";

export interface SolapiWebhookEvent {
  messageId?: string;
  groupId?: string;
  eventType?: string;
  type?: string;
  statusCode?: string;
  statusMessage?: string;
  customFields?: Record<string, unknown>;
  dateProcessed?: string;
  dateReported?: string;
  [key: string]: unknown;
}

export function verifySolapiWebhookSecret(input: {
  configuredSecret: string;
  headerSecret: string | string[] | undefined;
}): boolean {
  if (!input.configuredSecret) return false;
  const header = Array.isArray(input.headerSecret) ? input.headerSecret[0] : input.headerSecret;
  if (!header) return false;
  const expected = crypto.createHash("sha1").update(input.configuredSecret).digest("hex");
  return (
    timingSafeTextEqual(header, expected) || timingSafeTextEqual(header, input.configuredSecret)
  );
}

export function normalizeSolapiWebhookPayload(payload: unknown): SolapiWebhookEvent[] {
  if (Array.isArray(payload)) return payload.map(toEvent);
  if (
    payload &&
    typeof payload === "object" &&
    Array.isArray((payload as { data?: unknown }).data)
  ) {
    return (payload as { data: unknown[] }).data.map(toEvent);
  }
  if (payload && typeof payload === "object") return [toEvent(payload)];
  return [];
}

export function buildSolapiEventKey(event: SolapiWebhookEvent): string {
  const messageId = stringValue(event.messageId) ?? stringValue(event.message_id);
  const groupId = stringValue(event.groupId) ?? stringValue(event.group_id);
  const eventType = stringValue(event.eventType) ?? stringValue(event.type) ?? "message";
  const statusCode = stringValue(event.statusCode) ?? stringValue(event.status_code) ?? "";
  const eventDate =
    stringValue(event.dateProcessed) ??
    stringValue(event.dateReported) ??
    stringValue(event.date_processed) ??
    stringValue(event.date_reported) ??
    "";

  if (messageId) return [eventType, messageId, statusCode, eventDate].join(":");
  const stable = JSON.stringify({ eventType, groupId, statusCode, eventDate, payload: event });
  return `${eventType}:${crypto.createHash("sha256").update(stable).digest("hex")}`;
}

export function maskSolapiPayload(payload: unknown): unknown {
  if (Array.isArray(payload)) return payload.map(maskSolapiPayload);
  if (!payload || typeof payload !== "object") return payload;
  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(payload)) {
    const lower = key.toLowerCase();
    if (lower === "to" || lower === "from" || lower.includes("phone")) {
      out[key] = typeof value === "string" ? maskPhone(value) : value;
      continue;
    }
    out[key] = maskSolapiPayload(value);
  }
  return out;
}

export function maskPhone(phone: string): string {
  const digits = phone.replace(/\D/g, "");
  if (digits.length <= 4) return "****";
  return `${"*".repeat(Math.max(0, digits.length - 4))}${digits.slice(-4)}`;
}

function toEvent(value: unknown): SolapiWebhookEvent {
  return value && typeof value === "object" ? (value as SolapiWebhookEvent) : {};
}

function stringValue(value: unknown): string | undefined {
  return typeof value === "string" && value.length > 0 ? value : undefined;
}

function timingSafeTextEqual(a: string, b: string): boolean {
  const aBuf = Buffer.from(a);
  const bBuf = Buffer.from(b);
  return aBuf.length === bBuf.length && crypto.timingSafeEqual(aBuf, bBuf);
}
