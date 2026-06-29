const SENSITIVE = /token|password|secret|apikey|api_key|authorization|cookie/i;
const SENSITIVE_QUERY_PARAM =
  /token|password|secret|apikey|api_key|authorization|cookie|^code$|^state$|access_token|id_token|refresh_token|session/i;
const MAX_DEPTH = 3;
const MAX_NODES = 200;

function redactKey(key: string): boolean {
  return SENSITIVE.test(key);
}

function isPlainRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/**
 * URL 의 민감 query param 값을 마스킹. 파싱 실패 시 원본 반환 (best-effort).
 * sanitize() 는 객체 키만 redact 하므로 URL 문자열은 별도 처리가 필요하다.
 * relative URL 도 dummy base 로 파싱하여 민감 param 을 redact 한 뒤 relative 로 반환한다.
 */
export function sanitizeUrl(url: string): string {
  try {
    // dummy base 로 relative URL 도 파싱 — 절대 URL 은 base 무시됨
    const u = new URL(url, "http://_");
    let changed = false;
    for (const key of [...u.searchParams.keys()]) {
      if (SENSITIVE_QUERY_PARAM.test(key)) {
        u.searchParams.set(key, "[REDACTED]");
        changed = true;
      }
    }
    if (!changed) return url;
    // 입력이 absolute 였으면 absolute, relative 였으면 relative 로 반환
    const isAbsolute = /^[a-z][a-z0-9+.-]*:\/\//i.test(url);
    return isAbsolute ? u.toString() : `${u.pathname}${u.search}${u.hash}`;
  } catch {
    return url; // 파싱 실패 — best-effort
  }
}

export function sanitize(props?: Record<string, unknown>): Record<string, unknown> | undefined {
  if (props === undefined) return undefined;
  let visited = 0;

  function walk(value: unknown, depth: number): unknown {
    visited += 1;
    if (visited > MAX_NODES) return "[TRUNCATED]";
    if (depth > MAX_DEPTH) return "[TRUNCATED]";

    if (Array.isArray(value)) {
      return value.map((v) => walk(v, depth + 1));
    }
    if (isPlainRecord(value)) {
      const out: Record<string, unknown> = {};
      for (const [k, v] of Object.entries(value)) {
        out[k] = redactKey(k) ? "[REDACTED]" : walk(v, depth + 1);
      }
      return out;
    }
    return value;
  }

  return walk(props, 0) as Record<string, unknown>;
}
