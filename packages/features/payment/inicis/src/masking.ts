const SENSITIVE_KEYS =
  /card|CARD_Num|CARD_PRTC|regno|passwd|password|signKey|iniApiKey|hashData|resultMsg|P_RMESG/i;

export function maskEmail(value: string): string {
  const [name, domain] = value.split("@");
  if (!name || !domain) return "***";
  return `${name.slice(0, 2)}***@${domain}`;
}

export function maskName(value: string): string {
  if (value.length <= 1) return "*";
  return `${value.slice(0, 1)}*`;
}

export function maskProviderPayload<T extends Record<string, unknown>>(payload: T): T {
  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(payload)) {
    if (value === undefined) continue;
    if (SENSITIVE_KEYS.test(key)) {
      out[key] = "***";
    } else if (/email/i.test(key) && typeof value === "string") {
      out[key] = maskEmail(value);
    } else {
      out[key] = value;
    }
  }
  return out as T;
}
