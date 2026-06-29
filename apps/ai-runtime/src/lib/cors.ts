const DEFAULT_ALLOWED_ORIGINS = "http://localhost:3000";
const ALLOWED_METHODS = "POST, OPTIONS";
const ALLOWED_HEADERS = "Content-Type,Authorization";

function parseAllowedOrigins(value: string): string[] {
  return value
    .split(",")
    .map((origin) => origin.trim())
    .filter(Boolean);
}

export function resolveAllowedOrigin(
  origin: string | null,
  allowedOrigins = process.env.ALLOWED_ORIGINS ?? DEFAULT_ALLOWED_ORIGINS,
): string | null {
  if (!origin) return null;
  const allowed = parseAllowedOrigins(allowedOrigins);
  if (allowed.includes("*")) return "*";
  return allowed.includes(origin) ? origin : null;
}

function appendVaryOrigin(headers: Headers): void {
  const current = headers.get("Vary");
  if (!current) {
    headers.set("Vary", "Origin");
    return;
  }
  const values = current.split(",").map((value) => value.trim().toLowerCase());
  if (!values.includes("origin")) {
    headers.set("Vary", `${current}, Origin`);
  }
}

export function buildCorsHeaders(
  requestHeaders: Headers,
  allowedOrigins = process.env.ALLOWED_ORIGINS ?? DEFAULT_ALLOWED_ORIGINS,
  init?: HeadersInit,
): Headers {
  const headers = new Headers(init);
  const allowedOrigin = resolveAllowedOrigin(requestHeaders.get("Origin"), allowedOrigins);
  if (allowedOrigin) {
    headers.set("Access-Control-Allow-Origin", allowedOrigin);
  }
  headers.set("Access-Control-Allow-Methods", ALLOWED_METHODS);
  headers.set("Access-Control-Allow-Headers", ALLOWED_HEADERS);
  appendVaryOrigin(headers);
  return headers;
}

export function corsPreflightResponse(req: Request): Response {
  return new Response(null, {
    status: 204,
    headers: buildCorsHeaders(req.headers),
  });
}
