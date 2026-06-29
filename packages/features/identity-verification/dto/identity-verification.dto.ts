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
      enum: ["created", "redirected", "verified", "failed", "expired"],
    },
    providerTransactionId: { type: "string", nullable: true },
    resultCode: { type: "string", nullable: true },
    failureCode: { type: "string", nullable: true },
    redirectUrl: { type: "string", nullable: true },
    redirectMethod: { type: "string", nullable: true },
    redirectForm: { type: "object", additionalProperties: { type: "string" }, nullable: true },
    expiresAt: { type: "string", format: "date-time" },
    createdAt: { type: "string", format: "date-time" },
    updatedAt: { type: "string", format: "date-time" },
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
