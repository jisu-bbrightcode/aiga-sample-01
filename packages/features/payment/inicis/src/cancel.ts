import { createTimestamp, inicisV2Hash } from "./hash";
import type { InicisApiResult, InicisCancelInput, InicisConfig } from "./types";

type FetchLike = (input: string, init?: RequestInit) => Promise<Response>;

const FULL_REFUND_URL = "https://iniapi.inicis.com/v2/pg/refund";
const PARTIAL_REFUND_URL = "https://iniapi.inicis.com/v2/pg/partialRefund";

export function buildCancelRequest(cfg: InicisConfig, input: InicisCancelInput, date = new Date()) {
  const partial = input.amount !== undefined;
  const type = partial ? "partialRefund" : "refund";
  const timestamp = createTimestamp(date);
  const data = partial
    ? { tid: input.tid, price: input.amount, confirmPrice: input.confirmPrice, msg: input.reason }
    : { tid: input.tid, msg: input.reason };
  const dataJson = JSON.stringify(data);
  return {
    url: partial ? PARTIAL_REFUND_URL : FULL_REFUND_URL,
    body: {
      mid: cfg.mid,
      type,
      timestamp,
      clientIp: cfg.clientIp,
      data,
      hashData: inicisV2Hash({
        iniApiKey: cfg.iniApiKey,
        mid: cfg.mid,
        type,
        timestamp,
        data: dataJson,
      }),
    },
  };
}

export async function requestCancel(
  cfg: InicisConfig,
  input: InicisCancelInput,
  fetchImpl: FetchLike = globalThis.fetch,
): Promise<InicisApiResult> {
  const req = buildCancelRequest(cfg, input);
  const res = await fetchImpl(req.url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(req.body),
  });
  if (!res.ok) throw new Error("inicis_cancel_transport_failed");
  return (await res.json()) as InicisApiResult;
}
