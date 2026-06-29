import type { User } from "./user";

/**
 * Authorization 헤더에서 JWT를 추출하고 파싱하여 User 객체를 반환.
 * 서명 검증 없이 페이로드만 디코딩 (Better Auth JWT 기준).
 */
export function parseJwtFromHeader(authHeader: string | undefined): User | undefined {
  if (!authHeader?.startsWith("Bearer ")) return undefined;

  const token = authHeader.slice(7);
  try {
    const parts = token.split(".");
    const payloadPart = parts[1];
    if (parts.length !== 3 || !payloadPart) return undefined;

    const payload = JSON.parse(Buffer.from(payloadPart, "base64url").toString("utf-8"));

    if (payload.sub && payload.exp && payload.exp > Date.now() / 1000) {
      const activeOrganizationId =
        typeof payload.activeOrganizationId === "string" ? payload.activeOrganizationId : undefined;
      return { id: payload.sub, email: payload.email, activeOrganizationId };
    }
  } catch {
    // Invalid token
  }

  return undefined;
}
