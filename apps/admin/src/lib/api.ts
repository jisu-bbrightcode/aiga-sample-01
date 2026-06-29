import { createProductBuilderApi } from "@repo/api-client";
import { TOKEN_STORAGE_KEY } from "@repo/core/auth";
import { getSessionHeaders } from "@repo/core/logger/client";

import { env } from "./env";

export const API_URL = env.VITE_API_URL ?? "http://localhost:3002";

export function getAuthHeaders(): Record<string, string> {
  const headers: Record<string, string> = {};

  try {
    const raw = localStorage.getItem(TOKEN_STORAGE_KEY);
    const token = raw ? JSON.parse(raw) : null;
    if (token) {
      headers.Authorization = `Bearer ${token}`;
    }
  } catch {
    // ignore parse errors
  }

  Object.assign(headers, getSessionHeaders());

  return headers;
}

export const { client: apiClient, $api } = createProductBuilderApi({
  baseUrl: API_URL,
  getHeaders: getAuthHeaders,
});
