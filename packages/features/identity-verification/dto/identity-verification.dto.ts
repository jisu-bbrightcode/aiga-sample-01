import { createZodDto } from "@repo/shared/zod-nestjs";
import {
  createKcbSessionInputSchema,
  kcbCallbackInputSchema,
  linkKcbVerificationInputSchema,
} from "../kcb";

export class CreateKcbIdentitySessionDto extends createZodDto(createKcbSessionInputSchema) {}

export class KcbProviderResultDto extends createZodDto(kcbCallbackInputSchema) {}

export class LinkKcbVerificationDto extends createZodDto(linkKcbVerificationInputSchema) {}

// Verification request (one row per transaction). The create response additionally
// carries redirectUrl/redirectMethod/redirectForm + state/nonce + blocked (declared
// inline on the controller @ApiResponse).
export const identityVerificationSessionOpenApiSchema = {
  type: "object",
  required: [
    "id",
    "provider",
    "mode",
    "targetAction",
    "status",
    "expiresAt",
    "createdAt",
    "updatedAt",
  ],
  properties: {
    id: { type: "string", format: "uuid" },
    provider: { type: "string", enum: ["kcb"] },
    mode: { type: "string", enum: ["standard", "custom"] },
    userId: { type: "string", nullable: true },
    targetAction: { type: "string" },
    status: {
      type: "string",
      enum: ["created", "redirected", "pending", "verified", "failed", "canceled", "expired"],
    },
    providerTransactionId: { type: "string", nullable: true },
    resultCode: { type: "string", nullable: true },
    failureCode: { type: "string", nullable: true },
    consentVersion: { type: "string", nullable: true },
    consentScope: { type: "string", nullable: true },
    consentedAt: { type: "string", format: "date-time", nullable: true },
    redirectUrl: { type: "string", nullable: true },
    redirectMethod: { type: "string", nullable: true },
    redirectForm: { type: "object", additionalProperties: { type: "string" }, nullable: true },
    expiresAt: { type: "string", format: "date-time" },
    createdAt: { type: "string", format: "date-time" },
    updatedAt: { type: "string", format: "date-time" },
  },
};

// Verified identity result (one row in identity_verifications). Exposes only
// masked/coarse fields — never CI/DI hashes, RRN, or raw payload. The status/result
// API (PB-IDV-KCB-API-STATUS-001) returns this shape.
export const identityVerificationResultOpenApiSchema = {
  type: "object",
  required: ["id", "requestId", "provider", "verifiedAt", "createdAt"],
  properties: {
    id: { type: "string", format: "uuid" },
    requestId: { type: "string", format: "uuid" },
    userId: { type: "string", nullable: true },
    provider: { type: "string", enum: ["kcb"] },
    nameMasked: { type: "string", nullable: true },
    phoneMasked: { type: "string", nullable: true },
    birthYear: { type: "string", nullable: true },
    birthDateMasked: { type: "string", nullable: true },
    gender: { type: "string", enum: ["male", "female"], nullable: true },
    isForeigner: { type: "boolean", nullable: true },
    verifiedAt: { type: "string", format: "date-time" },
    retainedUntil: { type: "string", format: "date-time", nullable: true },
    anonymizedAt: { type: "string", format: "date-time", nullable: true },
    createdAt: { type: "string", format: "date-time" },
  },
};

// One immutable attempt audit record (identity_verification_attempts). Non-sensitive
// codes only; used by the status/retry API to surface retry history.
export const identityVerificationAttemptOpenApiSchema = {
  type: "object",
  required: ["id", "attemptNo", "outcome", "createdAt"],
  properties: {
    id: { type: "string", format: "uuid" },
    attemptNo: { type: "integer" },
    outcome: {
      type: "string",
      enum: ["redirected", "verified", "failed", "canceled", "expired"],
    },
    resultCode: { type: "string", nullable: true },
    failureCode: { type: "string", nullable: true },
    createdAt: { type: "string", format: "date-time" },
  },
};

export const kcbHealthOpenApiSchema = {
  type: "object",
  required: [
    "ok",
    "mode",
    "adapterConfigured",
    "officialSourceMapped",
    "jar",
    "license",
    "nativeLibrary",
    "customModeEnabled",
    "blockers",
  ],
  properties: {
    ok: { type: "boolean" },
    mode: { type: "string", enum: ["test", "production", "unset"] },
    adapterConfigured: { type: "boolean" },
    officialSourceMapped: { type: "boolean" },
    jar: { type: "object", additionalProperties: true },
    license: { type: "object", additionalProperties: true },
    nativeLibrary: { type: "object", additionalProperties: true },
    nativeLibraryRequired: { type: "boolean" },
    officialModuleWired: { type: "boolean" },
    customModeEnabled: { type: "boolean" },
    blockers: { type: "array", items: { type: "string" } },
  },
};
