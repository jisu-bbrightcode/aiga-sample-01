import { API_URL, getAuthHeaders } from "@/lib/api";

export const identityVerificationQueryKeys = {
  list: () => ["admin", "identity-verification", "list"] as const,
  health: () => ["admin", "identity-verification", "health"] as const,
  detail: (id: string) => ["admin", "identity-verification", "detail", id] as const,
};

export interface IdentityVerificationSession {
  id: string;
  provider: "kcb";
  mode: "standard" | "custom";
  userId: string | null;
  targetAction: string;
  status: "created" | "redirected" | "verified" | "failed" | "expired";
  providerTransactionId: string | null;
  resultCode: string | null;
  failureCode: string | null;
  expiresAt: string;
  createdAt: string;
  updatedAt: string;
}

export interface IdentityVerificationResult {
  id: string;
  requestId: string;
  userId: string | null;
  provider: "kcb";
  ciHashPresent: boolean;
  diHashPresent: boolean;
  nameMasked: string | null;
  phoneMasked: string | null;
  birthYear: string | null;
  verifiedAt: string;
  retainedUntil: string | null;
  deletedAt: string | null;
  createdAt: string;
}

export interface IdentityVerificationDetail extends IdentityVerificationSession {
  verifications: IdentityVerificationResult[];
}

export interface IdentityVerificationHealth {
  ok: boolean;
  mode: "test" | "production" | "unset";
  adapterConfigured: boolean;
  officialSourceMapped: boolean;
  jar: { configured: boolean; readable: boolean; checksum: string | null };
  license: { configured: boolean; readable: boolean };
  nativeLibrary: { configured: boolean; readable: boolean };
  nativeLibraryRequired: boolean;
  officialModuleWired: boolean;
  customModeEnabled: boolean;
  blockers: string[];
}

async function request<T>(path: string): Promise<T> {
  const response = await fetch(`${API_URL}${path}`, {
    headers: getAuthHeaders(),
  });
  if (!response.ok) {
    throw new Error("identity_verification_admin_request_failed");
  }
  return response.json() as Promise<T>;
}

export const identityVerificationAdminApi = {
  list: () => request<IdentityVerificationSession[]>("/api/admin/identity-verifications"),
  health: () => request<IdentityVerificationHealth>("/api/admin/identity-verifications/kcb/health"),
  detail: (id: string) =>
    request<IdentityVerificationDetail | null>(`/api/admin/identity-verifications/${id}`),
};
