/**
 * Capability registry entries for the file-upload feature.
 *
 * EXTEND of `product-builder-base:packages/features/file-upload`. Delivered so
 * far: the client-upload create/token endpoint (PB-FILE-API-CREATE-001 /
 * BBR-548) and the completion/activation endpoint (PB-FILE-API-COMPLETE-001 /
 * BBR-549); sibling capabilities (list, read, delete, admin) are separate issues.
 */
export const fileUploadCapabilityRegistry = [
  {
    capability: "file-upload.api.create",
    issue: "BBR-548",
    endpoint: "POST /files/uploads",
    description: "Vercel Blob client-upload token + pending metadata issuance",
  },
  {
    capability: "file-upload.api.complete",
    issue: "BBR-549",
    endpoint: "POST /files/uploads/complete",
    description:
      "Server-verified upload completion — re-validates the blob (head) and activates metadata (idempotent, orphan rollback)",
  },
] as const;
