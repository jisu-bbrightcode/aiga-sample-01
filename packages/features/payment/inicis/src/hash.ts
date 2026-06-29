import { createHash } from "node:crypto";

export function sha256Hex(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

export function sha512Hex(value: string): string {
  return createHash("sha512").update(value).digest("hex");
}

export function inicisSignature(params: Record<string, string>): string {
  return sha256Hex(
    Object.entries(params)
      .map(([key, value]) => `${key}=${value}`)
      .join("&"),
  );
}

export function inicisMKey(signKey: string): string {
  return sha256Hex(signKey);
}

export function inicisV2Hash(input: {
  iniApiKey: string;
  mid: string;
  type: string;
  timestamp: string;
  data: string;
}): string {
  return sha512Hex(`${input.iniApiKey}${input.mid}${input.type}${input.timestamp}${input.data}`);
}

export function createTimestamp(date = new Date()): string {
  const pad = (n: number) => n.toString().padStart(2, "0");
  return [
    date.getFullYear(),
    pad(date.getMonth() + 1),
    pad(date.getDate()),
    pad(date.getHours()),
    pad(date.getMinutes()),
    pad(date.getSeconds()),
  ].join("");
}

export function createMillisTimestamp(now = Date.now()): string {
  return String(now);
}
