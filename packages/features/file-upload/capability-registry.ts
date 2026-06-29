/**
 * Capability registry entries for the file-upload feature.
 *
 * EXTEND of `product-builder-base:packages/features/file-upload`. This issue
 * (PB-FILE-API-CREATE-001 / BBR-548) delivers the client-upload create/token
 * endpoint; sibling capabilities (complete, list, read, delete, admin) are
 * separate issues.
 */
export const fileUploadCapabilityRegistry = [
  {
    capability: "file-upload.api.create",
    issue: "BBR-548",
    endpoint: "POST /files/uploads",
    description: "Vercel Blob client-upload token + pending metadata issuance",
  },
] as const;
