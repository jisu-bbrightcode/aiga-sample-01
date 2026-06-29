export const DEFAULT_TRUSTED_ORIGINS = [
  "http://localhost:3000",
  "http://localhost:3001",
  "http://localhost:3002",
  "https://product-builder-app.vercel.app",
  "https://product-builder-api.vercel.app",
  "https://product-builder-admin.vercel.app",
  "https://product-builder-app-*.vercel.app",
  "https://product-builder-*.vercel.app",
  "https://product-builder-admin-*.vercel.app",
] as const;

interface OriginEnv {
  CORS_ORIGINS?: string;
  APP_URL?: string;
}

function splitOrigins(value: string | undefined): string[] {
  if (!value?.trim()) return [];
  return value
    .split(",")
    .map((origin) => origin.trim())
    .filter(Boolean);
}

function unique(values: string[]): string[] {
  return Array.from(new Set(values));
}

export function resolveTrustedOrigins(env: OriginEnv = process.env): string[] {
  const configuredOrigins = splitOrigins(env.CORS_ORIGINS);
  if (configuredOrigins.length > 0) {
    return unique(configuredOrigins);
  }

  return unique([...DEFAULT_TRUSTED_ORIGINS, ...splitOrigins(env.APP_URL)]);
}
