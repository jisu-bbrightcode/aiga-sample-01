import {
  BadRequestException,
  ConflictException,
  NotFoundException,
  UnprocessableEntityException,
} from "@nestjs/common";
import { type DrizzleDB, type FileAsset, fileAssets } from "@repo/drizzle";
import { and, eq, ne, type SQL } from "drizzle-orm";
import type { UpdateAdminFileMetadata, UpdateOwnFileMetadata } from "../dto";
import {
  type FileMetadataChanges,
  type FileMetadataPatch,
  type FileMetadataPolicyViolation,
  resolveMetadataUpdate,
} from "../policy";
import { type FileMetadataView, toFileMetadataView } from "./file-metadata-mappers";

/**
 * Minimal audit dependency — the subset of `AdminAuditService.log` this service
 * needs. Keeping it as an interface lets the service be unit-tested without a
 * DB (the module injects the real `AdminAuditService`).
 */
export interface FileAuditLogger {
  log(entry: {
    actorUserId: string;
    action: string;
    targetType?: string;
    targetId?: string;
    payloadBefore?: unknown;
    payloadAfter?: unknown;
    reason?: string;
  }): Promise<void>;
}

/**
 * Audit actions — admin and owner edits write distinct action strings so they
 * are distinguishable in the audit trail (acceptance criteria §3).
 */
export const FileMetadataAuditAction = {
  ownerUpdated: "file.metadata_updated",
  adminUpdated: "file.metadata_updated_by_admin",
} as const;

/**
 * Write-side service for file METADATA (PB-FILE-API-UPDATE-001 / BBR-552).
 *
 * EXTEND of the file-upload capability: complements the create/complete/list
 * surfaces with `PATCH /files/:id` (owner) and `PATCH /admin/files/:id` (admin).
 * It only edits metadata — display name, alt text, target link, visibility,
 * sort order, and (admin) review status — and never the binary (AC §1).
 *
 * Every applied change is recorded via {@link FileAuditLogger} with an
 * action that distinguishes owner from admin edits (AC §3). An idempotent
 * (no-op) patch performs no write and emits no audit row.
 */
export class FileMetadataService {
  constructor(
    private readonly db: DrizzleDB,
    private readonly audit: FileAuditLogger,
  ) {}

  /**
   * Owner edits their own file's metadata. The row is scoped to the session
   * user and excludes soft-deleted rows, so another user's file (or a deleted
   * one) is indistinguishable from a missing one — 404, no information leak.
   */
  async updateOwnFile(
    ownerUserId: string,
    fileAssetId: string,
    patch: UpdateOwnFileMetadata,
  ): Promise<FileMetadataView> {
    const row = await this.findOne(
      and(
        eq(fileAssets.id, fileAssetId),
        eq(fileAssets.ownerUserId, ownerUserId),
        ne(fileAssets.status, "deleted"),
      ),
    );
    if (!row) throw new NotFoundException("파일을 찾을 수 없습니다.");

    return this.applyUpdate(row, patch, "owner", ownerUserId);
  }

  /**
   * Admin edits any file's metadata, and may additionally set the moderation
   * `reviewStatus`. Soft-deleted rows are visible to the admin lookup but remain
   * immutable (409 via policy), so the operator gets a clear error rather than a
   * silent no-op.
   */
  async updateFileAsAdmin(
    adminUserId: string,
    fileAssetId: string,
    patch: UpdateAdminFileMetadata,
  ): Promise<FileMetadataView> {
    const row = await this.findOne(eq(fileAssets.id, fileAssetId));
    if (!row) throw new NotFoundException("파일을 찾을 수 없습니다.");

    return this.applyUpdate(row, patch, "admin", adminUserId);
  }

  /** Shared: resolve policy → persist changed columns → audit. */
  private async applyUpdate(
    row: FileAsset,
    patch: UpdateOwnFileMetadata | UpdateAdminFileMetadata,
    role: "owner" | "admin",
    actorUserId: string,
  ): Promise<FileMetadataView> {
    const resolved = resolveMetadataUpdate(row, toPolicyPatch(patch), { role });
    if (!resolved.ok) throw policyException(resolved.violation);

    // Idempotent: nothing actually changed → no write, no audit row.
    if (Object.keys(resolved.changes).length === 0) {
      return toFileMetadataView(row);
    }

    const [updated] = await this.db
      .update(fileAssets)
      .set(resolved.changes)
      .where(eq(fileAssets.id, row.id))
      .returning();
    const next = updated ?? row;

    await this.audit.log({
      actorUserId,
      // AC §3: distinct action per actor so owner vs admin edits are
      // distinguishable in the shared audit trail.
      action:
        role === "admin"
          ? FileMetadataAuditAction.adminUpdated
          : FileMetadataAuditAction.ownerUpdated,
      targetType: "file_asset",
      targetId: row.id,
      payloadBefore: pickBefore(row, resolved.changes),
      payloadAfter: resolved.changes,
      reason: patch.reason,
    });

    return toFileMetadataView(next);
  }

  private async findOne(where: SQL | undefined): Promise<FileAsset | undefined> {
    const rows = await this.db.select().from(fileAssets).where(where).limit(1);
    return rows[0];
  }
}

/** Narrow the validated DTO to the policy's patch shape (`displayName`→`originalName`). */
function toPolicyPatch(patch: UpdateOwnFileMetadata | UpdateAdminFileMetadata): FileMetadataPatch {
  const out: FileMetadataPatch = {};
  if (patch.displayName !== undefined) out.originalName = patch.displayName;
  if (patch.altText !== undefined) out.altText = patch.altText;
  if (patch.targetType !== undefined) out.targetType = patch.targetType;
  if (patch.targetId !== undefined) out.targetId = patch.targetId;
  if (patch.visibility !== undefined) out.visibility = patch.visibility;
  if (patch.sortOrder !== undefined) out.sortOrder = patch.sortOrder;
  if ("reviewStatus" in patch && patch.reviewStatus !== undefined) {
    out.reviewStatus = patch.reviewStatus;
  }
  return out;
}

/** Snapshot the pre-update value of exactly the columns that changed. */
function pickBefore(row: FileAsset, changes: FileMetadataChanges): Record<string, unknown> {
  const before: Record<string, unknown> = {};
  for (const key of Object.keys(changes) as (keyof FileMetadataChanges)[]) {
    before[key] = row[key as keyof FileAsset];
  }
  return before;
}

function policyException(violation: FileMetadataPolicyViolation) {
  switch (violation.code) {
    case "file_deleted":
      return new ConflictException(violation.message);
    case "incomplete_target":
      return new BadRequestException(violation.message);
    default:
      // not_ready_for_public | review_blocks_public — semantically valid request
      // that the current resource state forbids.
      return new UnprocessableEntityException(violation.message);
  }
}
