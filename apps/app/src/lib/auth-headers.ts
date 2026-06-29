import { TOKEN_STORAGE_KEY } from "@repo/core/auth";
import { getSessionHeaders } from "@repo/core/logger/client";
import { env } from "./env";

// dev: "" -> Vite proxy, prod: configured API host.
export const API_URL = env.VITE_API_URL ?? "";

export function getAuthHeaders(): Record<string, string> {
  const headers: Record<string, string> = {};

  try {
    const raw = localStorage.getItem(TOKEN_STORAGE_KEY);
    const token = raw ? JSON.parse(raw) : null;
    if (token) {
      headers.Authorization = `Bearer ${token}`;
    }
  } catch {
    // Ignore invalid local token payloads; session refresh paths handle auth recovery.
  }

  Object.assign(headers, getSessionHeaders());

  return headers;
}
