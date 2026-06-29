import { z } from "zod";

export const KCB_CAPABILITY_IDS = [
  "identity-verification.kcb.standard",
  "identity-verification.kcb.jar-bridge",
  "identity-verification.kcb.schema",
  "identity-verification.kcb.rest-api",
  "identity-verification.kcb.ui",
  "identity-verification.kcb.admin",
  "identity-verification.kcb.qa",
] as const;

export const identityVerificationModeSchema = z.enum(["standard", "custom"]);
export const identityVerificationStatusSchema = z.enum([
  "created",
  "redirected",
  "pending",
  "verified",
  "failed",
  "canceled",
  "expired",
]);

export const kcbBlockerCodeSchema = z.enum([
  "configuration_required",
  "official_documents_required",
  "jar_required",
  "license_required",
  "native_library_required",
  "site_code_required",
  "return_url_required",
  "popup_url_required",
  "custom_mode_not_enabled",
  "provider_rejected",
  "replay_detected",
  "session_not_found",
  "session_expired",
]);

export type IdentityVerificationMode = z.infer<typeof identityVerificationModeSchema>;
export type IdentityVerificationStatus = z.infer<typeof identityVerificationStatusSchema>;
export type KcbBlockerCode = z.infer<typeof kcbBlockerCodeSchema>;

export const kcbTargetActionSchema = z.object({
  action: z.string().min(1).max(120),
  resourceType: z.string().max(120).optional(),
  resourceId: z.string().max(200).optional(),
  returnUrl: z.string().url().optional(),
});
export type KcbTargetAction = z.infer<typeof kcbTargetActionSchema>;

export const createKcbSessionInputSchema = z.object({
  mode: identityVerificationModeSchema.default("standard"),
  target: kcbTargetActionSchema,
});
export type CreateKcbSessionInput = z.infer<typeof createKcbSessionInputSchema>;

// Linking an anonymous verification to a user requires proof of ownership: the
// `state` secret returned once in the create response (only the verifying browser
// holds it; the server stores only its hash). This prevents another authenticated
// user from claiming a verification by guessing/leaking its request id (IDOR).
export const linkKcbVerificationInputSchema = z.object({
  state: z.string().min(16),
});
export type LinkKcbVerificationInput = z.infer<typeof linkKcbVerificationInputSchema>;

export const kcbCallbackInputSchema = z.object({
  sessionId: z.string().uuid(),
  state: z.string().min(16),
  nonce: z.string().min(16),
  providerPayload: z.record(z.unknown()).default({}),
});
export type KcbCallbackInput = z.infer<typeof kcbCallbackInputSchema>;

export const kcbHealthSchema = z.object({
  ok: z.boolean(),
  mode: z.enum(["test", "production", "unset"]),
  adapterConfigured: z.boolean(),
  officialSourceMapped: z.boolean(),
  jar: z.object({
    configured: z.boolean(),
    readable: z.boolean(),
    checksum: z.string().nullable(),
  }),
  license: z.object({
    configured: z.boolean(),
    readable: z.boolean(),
  }),
  nativeLibrary: z.object({
    configured: z.boolean(),
    readable: z.boolean(),
  }),
  nativeLibraryRequired: z.boolean().default(false),
  officialModuleWired: z.boolean().default(false),
  customModeEnabled: z.boolean(),
  blockers: z.array(kcbBlockerCodeSchema),
});
export type KcbHealth = z.infer<typeof kcbHealthSchema>;

export const kcbAdapterStandardRequestSchema = z.object({
  requestId: z.string().min(1),
  sessionId: z.string().uuid(),
  state: z.string().min(16),
  nonce: z.string().min(16),
  returnUrl: z.string().url().optional(),
  callbackUrl: z.string().url().optional(),
  targetAction: z.string().min(1),
});
export type KcbAdapterStandardRequest = z.infer<typeof kcbAdapterStandardRequestSchema>;

export const kcbAdapterStandardResponseSchema = z.object({
  providerTransactionId: z.string().min(1).optional(),
  redirectUrl: z.string().url(),
  redirectMethod: z.enum(["GET", "POST"]).default("POST"),
  redirectForm: z.record(z.string()).optional(),
});
export type KcbAdapterStandardResponse = z.infer<typeof kcbAdapterStandardResponseSchema>;

export const kcbAdapterVerifyResponseSchema = z.object({
  // The Java bridge sends explicit JSON null (not undefined) for absent fields, so these
  // must accept null — `.optional()` alone rejects null and would turn a real result
  // (even a successful B000 with some null fields) into a parse error.
  providerTransactionId: z.string().min(1).nullish(),
  resultCode: z.string().min(1),
  resultMessage: z.string().min(1),
  verified: z.boolean(),
  ciHash: z.string().nullish(),
  diHash: z.string().nullish(),
  nameMasked: z.string().nullish(),
  birthYear: z.string().nullish(),
  birthDateMasked: z.string().nullish(),
  phoneMasked: z.string().nullish(),
});
export type KcbAdapterVerifyResponse = z.infer<typeof kcbAdapterVerifyResponseSchema>;

export const kcbCapabilityRegistry = KCB_CAPABILITY_IDS.map((id) => ({
  id,
  provider: "kcb" as const,
  source: `product-builder-base:${id.replace("identity-verification.kcb.", "")}`,
  officialDocumentsRequired: true,
}));
