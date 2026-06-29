import { createMillisTimestamp, inicisSignature } from "./hash";
import type { InicisApprovalResult, InicisAuthResult, InicisConfig } from "./types";

type FetchLike = (input: string, init?: RequestInit) => Promise<Response>;

export function parseAuthResult(input: Record<string, unknown>): InicisAuthResult {
  return {
    resultCode: stringValue(input.resultCode),
    resultMsg: optionalString(input.resultMsg),
    mid: optionalString(input.mid),
    orderNumber: optionalString(input.orderNumber),
    authToken: optionalString(input.authToken),
    authUrl: optionalString(input.authUrl),
    netCancelUrl: optionalString(input.netCancelUrl),
    idc_name: optionalString(input.idc_name),
    merchantData: optionalString(input.merchantData),
  };
}

export function assertValidAuthUrl(authUrl: string, idcName?: string): void {
  const parsed = new URL(authUrl);
  if (parsed.protocol !== "https:" || !isInicisHost(parsed.hostname)) {
    throw new Error("inicis_auth_url_not_allowed");
  }
  if (idcName && !parsed.hostname.includes(idcName)) {
    throw new Error("inicis_idc_mismatch");
  }
}

export async function requestApproval(
  cfg: InicisConfig,
  auth: InicisAuthResult,
  fetchImpl: FetchLike = globalThis.fetch,
  now = Date.now(),
): Promise<InicisApprovalResult> {
  if (!auth.authUrl || !auth.authToken) throw new Error("inicis_auth_missing");
  assertValidAuthUrl(auth.authUrl, auth.idc_name);
  const timestamp = createMillisTimestamp(now);
  const body = new URLSearchParams({
    mid: cfg.mid,
    authToken: auth.authToken,
    timestamp,
    signature: inicisSignature({ authToken: auth.authToken, timestamp }),
    verification: inicisSignature({ authToken: auth.authToken, signKey: cfg.signKey, timestamp }),
    charset: "UTF-8",
    format: "JSON",
  });
  const res = await fetchImpl(auth.authUrl, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: body.toString(),
  });
  if (!res.ok) throw new Error("inicis_approval_transport_failed");
  return (await res.json()) as InicisApprovalResult;
}

export async function requestNetCancel(
  cfg: InicisConfig,
  auth: InicisAuthResult,
  fetchImpl: FetchLike = globalThis.fetch,
  now = Date.now(),
): Promise<void> {
  if (!auth.netCancelUrl || !auth.authToken) return;
  assertValidAuthUrl(auth.netCancelUrl, auth.idc_name);
  const timestamp = createMillisTimestamp(now);
  const body = new URLSearchParams({
    mid: cfg.mid,
    authToken: auth.authToken,
    timestamp,
    signature: inicisSignature({ authToken: auth.authToken, timestamp }),
    verification: inicisSignature({ authToken: auth.authToken, signKey: cfg.signKey, timestamp }),
    charset: "UTF-8",
    format: "JSON",
  });
  await fetchImpl(auth.netCancelUrl, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: body.toString(),
  });
}

function stringValue(value: unknown): string {
  return typeof value === "string" ? value : "";
}

function optionalString(value: unknown): string | undefined {
  return typeof value === "string" ? value : undefined;
}

function isInicisHost(hostname: string): boolean {
  return hostname === "inicis.com" || hostname.endsWith(".inicis.com");
}
