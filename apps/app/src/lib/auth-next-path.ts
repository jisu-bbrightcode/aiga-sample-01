const DEFAULT_NEXT_PATH = "/";

export function sanitizeAuthNextPath(
  value: string | null | undefined,
  fallback = DEFAULT_NEXT_PATH,
) {
  const trimmed = value?.trim();
  if (!trimmed) return fallback;
  if (!trimmed.startsWith("/") || trimmed.startsWith("//")) return fallback;
  return trimmed;
}

export function getAuthNextPath(fallback = DEFAULT_NEXT_PATH) {
  if (typeof window === "undefined") return fallback;
  return sanitizeAuthNextPath(new URLSearchParams(window.location.search).get("next"), fallback);
}

export function getCurrentAuthPath() {
  if (typeof window === "undefined") return DEFAULT_NEXT_PATH;
  return `${window.location.pathname}${window.location.search}`;
}

export function authPathWithNext(path: string, nextPath: string) {
  if (nextPath === DEFAULT_NEXT_PATH) return path;
  return `${path}?next=${encodeURIComponent(nextPath)}`;
}
