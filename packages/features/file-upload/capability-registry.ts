/**
 * Capability registry entries for the file-upload feature.
 *
 * EXTEND of `product-builder-base:packages/features/file-upload`. Delivered so
 * far: the client-upload create/token endpoint (PB-FILE-API-CREATE-001 /
 * BBR-548), the completion/activation endpoint (PB-FILE-API-COMPLETE-001 /
 * BBR-549), and the owner/admin listing endpoints (PB-FILE-API-LIST-001 /
 * BBR-550); sibling capabilities (read, delete) are separate issues.
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
  {
    capability: "file-upload.api.list",
    issue: "BBR-550",
    endpoint: "GET /files, GET /admin/files",
    description:
      "Owner-scoped + admin file listing with target/status/visibility/MIME filters, pagination, and consistent soft-delete exposure policy",
  },
] as const;
