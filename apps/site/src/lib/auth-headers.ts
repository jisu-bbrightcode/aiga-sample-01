import { TOKEN_STORAGE_KEY } from "@repo/core/auth";

/** Public API base (inlined by Next at build). */
export const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "";

/**
 * Bearer header from the locally-stored better-auth token. Runs client-side
 * only; on the server it returns no auth header (RSC uses public endpoints).
 */
export function getAuthHeaders(): Record<string, string> {
  const headers: Record<string, string> = {};
  if (typeof window === "undefined") return headers;
  try {
    const raw = localStorage.getItem(TOKEN_STORAGE_KEY);
    const token = raw ? JSON.parse(raw) : null;
    if (token) headers.Authorization = `Bearer ${token}`;
  } catch {
    // ignore malformed token payloads
  }
  return headers;
}
