/**
 * Response contracts for the file-detail endpoints
 * (PB-FILE-API-READ-001 / BBR-551).
 *
 * - `GET /files/:id`       — public (anyone) or owner (authorised) access.
 * - `GET /admin/files/:id` — operator full record.
 *
 * The owner/public access policy lives in the service + pure policy function;
 * these schemas only describe the wire shapes for OpenAPI.
 */

/** `GET /files/:id` — owner-safe detail with the public/owner access marker. */
export const fileDetailOpenApiSchema = {
  type: "object",
  required: ["fileAssetId", "access", "originalName", "visibility", "status", "createdAt"],
  properties: {
    fileAssetId: { type: "string", format: "uuid" },
    access: {
      type: "string",
      enum: ["public", "owner"],
      description: "공개 파일(public) 또는 권한 보유자(owner) 응답 여부",
    },
    originalName: { type: "string" },
    contentType: { type: "string", nullable: true, description: "Server-verified MIME type" },
    size: { type: "integer", nullable: true },
    visibility: { type: "string", enum: ["public", "private"] },
    status: { type: "string", enum: ["pending", "ready", "failed"] },
    targetType: { type: "string", nullable: true },
    targetId: { type: "string", nullable: true },
    url: {
      type: "string",
      nullable: true,
      description: "공개 파일이거나 권한 보유자에게만, 그리고 ready 상태일 때만 노출되는 접근 URL",
    },
    downloadUrl: { type: "string", nullable: true },
    createdAt: { type: "string", format: "date-time" },
    completedAt: { type: "string", format: "date-time", nullable: true },
  },
} as const;

/** `GET /admin/files/:id` — the full record incl. internal/audit fields. */
export const adminFileDetailOpenApiSchema = {
  type: "object",
  required: ["fileAssetId", "originalName", "visibility", "status", "source", "createdAt"],
  properties: {
    fileAssetId: { type: "string", format: "uuid" },
    ownerUserId: { type: "string", nullable: true },
    source: { type: "string", enum: ["user", "admin", "system"] },
    originalName: { type: "string" },
    pathname: { type: "string" },
    url: { type: "string" },
    downloadUrl: { type: "string", nullable: true },
    contentType: { type: "string", nullable: true },
    size: { type: "integer", nullable: true },
    declaredContentType: { type: "string", nullable: true },
    declaredSize: { type: "integer", nullable: true },
    visibility: { type: "string", enum: ["public", "private"] },
    status: { type: "string", enum: ["pending", "ready", "failed", "deleted"] },
    scanStatus: { type: "string" },
    reviewStatus: { type: "string" },
    targetType: { type: "string", nullable: true },
    targetId: { type: "string", nullable: true },
    createdAt: { type: "string", format: "date-time" },
    completedAt: { type: "string", format: "date-time", nullable: true },
    deletedAt: { type: "string", format: "date-time", nullable: true },
    deletedBy: { type: "string", nullable: true },
  },
} as const;
