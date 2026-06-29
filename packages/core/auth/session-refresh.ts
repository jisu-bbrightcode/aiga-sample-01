/**
 * Session Refresh Utility
 *
 * 401 에러 발생 시 토큰 갱신.
 */
import { TOKEN_STORAGE_KEY } from "./store";

let refreshPromise: Promise<boolean> | null = null;
let apiUrl = "";

/**
 * API URL 등록 (앱 초기화 시 1회 호출)
 */
export function setAuthApiUrl(url: string) {
  apiUrl = url;
}

/**
 * 세션 갱신 시도 (중복 호출 방지, 동시 요청은 하나의 Promise 공유)
 * @returns 갱신 성공 여부
 */
export function refreshSessionToken(): Promise<boolean> {
  // 이미 갱신 중이면 기존 Promise 공유
  if (refreshPromise) return refreshPromise;

  refreshPromise = (async () => {
    try {
      const token = localStorage.getItem(TOKEN_STORAGE_KEY);
      if (!token) return false;

      const res = await fetch(`${apiUrl}/api/auth/refresh`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${JSON.parse(token)}`,
        },
        body: "{}",
        credentials: "include",
      });

      if (!res.ok) return false;

      const data = await res.json();
      if (data.token) {
        localStorage.setItem(TOKEN_STORAGE_KEY, JSON.stringify(data.token));
        return true;
      }

      return false;
    } catch {
      return false;
    } finally {
      refreshPromise = null;
    }
  })();

  return refreshPromise;
}

/**
 * tRPC/TanStack Query 에러가 401(UNAUTHORIZED)인지 판별
 */
export function isUnauthorizedError(error: unknown): boolean {
  if (!error || typeof error !== "object") return false;

  // TRPCClientError
  const trpcError = error as { data?: { code?: string }; shape?: { data?: { code?: string } } };
  if (trpcError.data?.code === "UNAUTHORIZED") return true;
  if (trpcError.shape?.data?.code === "UNAUTHORIZED") return true;

  // HTTP status 기반
  const httpError = error as { status?: number; statusCode?: number };
  if (httpError.status === 401 || httpError.statusCode === 401) return true;

  // message 기반 fallback
  const msgError = error as { message?: string };
  if (msgError.message?.includes("UNAUTHORIZED")) return true;

  return false;
}
