export interface AuthJwtPayloadSource {
  user?: Record<string, unknown> | null;
  session?: {
    activeOrganizationId?: unknown;
  } | null;
}

export function buildAuthJwtPayload(source: AuthJwtPayloadSource): Record<string, unknown> {
  const user = source.user && typeof source.user === "object" ? { ...source.user } : {};
  const activeOrganizationId = source.session?.activeOrganizationId;

  if (typeof activeOrganizationId === "string" && activeOrganizationId.length > 0) {
    return { ...user, activeOrganizationId };
  }

  return user;
}
