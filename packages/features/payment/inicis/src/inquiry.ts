import { createTimestamp, inicisV2Hash } from "./hash";
import type { InicisApiResult, InicisConfig, InicisInquiryInput } from "./types";

type FetchLike = (input: string, init?: RequestInit) => Promise<Response>;

const INQUIRY_URL = "https://iniapi.inicis.com/v2/pg/inquiry";

export function buildInquiryRequest(
  cfg: InicisConfig,
  input: InicisInquiryInput,
  date = new Date(),
) {
  const type = "inquiry";
  const timestamp = createTimestamp(date);
  const data = {
    ...(input.tid ? { tid: input.tid } : {}),
    ...(input.oid ? { oid: input.oid } : {}),
  };
  const dataJson = JSON.stringify(data);
  return {
    url: INQUIRY_URL,
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

export async function requestInquiry(
  cfg: InicisConfig,
  input: InicisInquiryInput,
  fetchImpl: FetchLike = globalThis.fetch,
): Promise<InicisApiResult> {
  const req = buildInquiryRequest(cfg, input);
  const res = await fetchImpl(req.url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(req.body),
  });
  if (!res.ok) throw new Error("inicis_inquiry_transport_failed");
  return (await res.json()) as InicisApiResult;
}
