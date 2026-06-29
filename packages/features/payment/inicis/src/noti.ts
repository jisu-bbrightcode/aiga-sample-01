import { sha256Hex } from "./hash";
import type { InicisNotiPayload } from "./types";

export const INICIS_NOTI_SUCCESS_RESPONSE = "OK";
export const INICIS_NOTI_FAILURE_RESPONSE = "FAIL";

export function parseNotiPayload(input: Record<string, unknown>): InicisNotiPayload {
  const out: InicisNotiPayload = {};
  for (const [key, value] of Object.entries(input)) {
    if (typeof value === "string") out[key] = value;
  }
  return out;
}

export function normalizeNoti(payload: InicisNotiPayload) {
  const isMobile = Boolean(payload.P_STATUS || payload.P_TID || payload.P_OID);
  const orderId = isMobile ? payload.P_OID : payload.no_oid;
  const tid = isMobile ? payload.P_TID : payload.no_tid;
  const amount = Number(isMobile ? payload.P_AMT : payload.amt_input);
  const providerResultCode = isMobile ? payload.P_STATUS : payload.result_code;
  return {
    kind: isMobile ? "mobile_vbank_noti" : "pc_vbank_noti",
    orderId: orderId ?? "",
    tid: tid ?? "",
    amount: Number.isFinite(amount) ? amount : 0,
    providerResultCode: providerResultCode ?? "",
    paymentCompleted: isMobile
      ? payload.P_STATUS === "02"
      : Boolean(payload.no_tid && payload.no_oid && payload.amt_input) &&
        (payload.result_code === undefined || payload.result_code === "0000"),
  };
}

export function createNotiIdempotencyKey(payload: InicisNotiPayload): string {
  const normalized = normalizeNoti(payload);
  return sha256Hex(
    [
      "inicis:noti",
      normalized.kind,
      normalized.orderId,
      normalized.tid,
      normalized.amount,
      normalized.providerResultCode,
    ].join(":"),
  );
}
