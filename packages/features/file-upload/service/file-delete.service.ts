import { NotFoundException } from "@nestjs/common";
import { type DrizzleDB, type FileAsset, fileAssets } from "@repo/drizzle";
import { and, eq, isNotNull, lt } from "drizzle-orm";
import type { BlobDeleter } from "./file-upload.service";

/** Audit actions emitted by the delete service. */
export const FileDeleteAction = {
  /** Owner removed their own file. */
  owner_deleted: "file.deleted",
  /** Operator force-removed someone else's file. */
  force_deleted: "file.force_deleted",
} as const;
export type FileDeleteAction = (typeof FileDeleteAction)[keyof typeof FileDeleteAction];

/**
 * Append-only audit sink for privileged file mutations. Injected (rather than a
 * hard dependency on `AdminAuditService`) so the service stays unit-testable
 * without a DB or the admin module — mirrors the blob-helper injection style.
 */
export type FileAuditLogger = (entry: {
  actorUserId: string;
  action: FileDeleteAction;
  targetType: "file";
  targetId: string;
  payloadBefore?: unknown;
  payloadAfter?: unknown;
}) => Promise<void>;

/** Result of a (soft) delete. */
export interface DeletedFile {
  fileAssetId: string;
  status: "deleted";
  deletedAt: string;
}

/** Outcome of one cleanup sweep (operations task — PB-FILE-001 §5.4). */
export interface CleanupResult {
  /** Orphan `pending` rows past their TTL that were reaped (→ `failed`). */
  orphanPendingReaped: number;
  /** Soft-deleted rows whose blob bytes were successfully purged this pass. */
  deletedBlobsPurged: number;
  /** Soft-deleted rows whose blob purge failed again (left for the next pass). */
  blobDeleteFailures: number;
}

export interface FileDeleteServiceOptions {
  db: DrizzleDB;
  /** Deletes blob bytes from the store. Absent → DB-only soft delete. */
  deleteBlob?: BlobDeleter;
  /** Append-only audit sink (admin_audit_log). Absent → column audit only. */
  audit?: FileAuditLogger;
  /** Injected for deterministic tests. */
  now?: () => Date;
}

const DEFAULT_SWEEP_LIMIT = 100;
const MAX_SWEEP_LIMIT = 1000;

/**
 * File deletion + Blob cleanup service (PB-FILE-API-DELETE-001 / BBR-553).
 *
 * EXTEND of the file-upload capability: complements create/complete/list with
 * the delete + storage-reclaim lifecycle.
 *
 * Compensation policy (acceptance criteria §2 — there must be a recovery path
 * between DB-metadata removal and Blob-object deletion):
 *   1. The DB row is soft-deleted FIRST (status=`deleted` + audit columns). The
 *      metadata is authoritative, so every read (list/detail/domain reference)
 *      stops returning the file immediately — no dangling reference can survive
 *      a half-finished delete (§4).
 *   2. `expiresAt` is set as a "blob still needs purging" marker, then the bytes
 *      are deleted best-effort. On success the marker is cleared; on failure it
 *      is left set so {@link sweep} retries later. The store is never the source
 *      of truth, so a failed blob delete only ever leaks bytes (reclaimable),
 *      never a live reference.
 *
 * Soft-delete is keyed on `status='deleted'` (what the read paths filter on) and
 * also stamps the shared soft-delete columns (`isDeleted`, `deletedAt`) plus
 * `deletedBy` for audit.
 */
export class FileDeleteService {
  private readonly db: DrizzleDB;
  private readonly deleteBlob?: BlobDeleter;
  private readonly audit?: FileAuditLogger;
  private readonly now: () => Date;

  constructor(options: FileDeleteServiceOptions) {
    this.db = options.db;
    this.deleteBlob = options.deleteBlob;
    this.audit = options.audit;
    this.now = options.now ?? (() => new Date());
  }

  /**
   * Owner deletes their own file (acceptance criteria §1).
   *
   * Ownership is taken from the authenticated session and re-checked against the
   * row: an unknown id and someone else's file both resolve to the same 404, so
   * a caller can neither delete nor probe for files outside their scope.
   */
  async deleteOwn(ownerUserId: string, fileAssetId: string): Promise<DeletedFile> {
    const row = await this.loadAsset(fileAssetId);
    if (!row || row.ownerUserId !== ownerUserId) throw this.notFound();
    return this.softDelete(row, ownerUserId, FileDeleteAction.owner_deleted);
  }

  /**
   * Operator force-deletes any file. Records an `admin_audit_log` entry in
   * addition to the row's soft-delete columns (privileged cross-owner action).
   */
  async forceDelete(adminUserId: string, fileAssetId: string): Promise<DeletedFile> {
    const row = await this.loadAsset(fileAssetId);
    if (!row) throw this.notFound();
    return this.softDelete(row, adminUserId, FileDeleteAction.force_deleted);
  }

  /**
   * Cleanup sweep — the operations task (acceptance criteria §3). Two passes,
   * both bounded by `limit`:
   *   (a) orphan `pending` rows past `expiresAt` (token issued, upload never
   *       completed) → best-effort purge bytes, mark `failed`.
   *   (b) soft-deleted rows whose inline blob purge failed (`expiresAt` still
   *       set) → retry the purge; clear the marker on success.
   *
   * Idempotent and safe to run on a schedule (cron / queue worker).
   */
  async sweep(options: { limit?: number; now?: Date } = {}): Promise<CleanupResult> {
    const now = options.now ?? this.now();
    const limit = Math.min(Math.max(options.limit ?? DEFAULT_SWEEP_LIMIT, 1), MAX_SWEEP_LIMIT);

    const orphanPendingReaped = await this.reapOrphanPending(now, limit);
    const { purged, failures } = await this.retryDeletedPurge(now, limit);

    return {
      orphanPendingReaped,
      deletedBlobsPurged: purged,
      blobDeleteFailures: failures,
    };
  }

  // -- internals --------------------------------------------------------------

  private async loadAsset(fileAssetId: string): Promise<FileAsset | null> {
    const [row] = await this.db
      .select()
      .from(fileAssets)
      .where(eq(fileAssets.id, fileAssetId))
      .limit(1);
    return row ?? null;
  }

  private async softDelete(
    row: FileAsset,
    actorUserId: string,
    action: FileDeleteAction,
  ): Promise<DeletedFile> {
    // Idempotent: an already-deleted row converges without re-touching the blob
    // or re-auditing — duplicate deletes return the original deletion time.
    if (row.status === "deleted") {
      return {
        fileAssetId: row.id,
        status: "deleted",
        deletedAt: (row.deletedAt ?? this.now()).toISOString(),
      };
    }

    const now = this.now();
    // §2 step 1: authoritative DB soft-delete first. The status guard makes this
    // a no-op if a concurrent delete won the race (→ idempotent convergence).
    const [updated] = await this.db
      .update(fileAssets)
      .set({
        status: "deleted",
        isDeleted: true,
        deletedAt: now,
        deletedBy: actorUserId,
        // "blob still needs purging" marker — cleared once the bytes are gone.
        expiresAt: now,
      })
      .where(and(eq(fileAssets.id, row.id), eq(fileAssets.status, row.status)))
      .returning();

    if (!updated) {
      return { fileAssetId: row.id, status: "deleted", deletedAt: now.toISOString() };
    }

    // §2 step 2: best-effort byte reclaim. A failure leaves the marker set so
    // the sweep retries — it never blocks or reverses the metadata delete.
    await this.purgeBlob(updated);

    await this.audit?.({
      actorUserId,
      action,
      targetType: "file",
      targetId: row.id,
      payloadBefore: { status: row.status, ownerUserId: row.ownerUserId },
      payloadAfter: { status: "deleted" },
    });

    return { fileAssetId: row.id, status: "deleted", deletedAt: now.toISOString() };
  }

  /** Delete the blob; on success clear the cleanup marker. Best-effort. */
  private async purgeBlob(row: FileAsset): Promise<boolean> {
    const ok = await this.tryDeleteBlob(row.pathname);
    if (ok) {
      await this.db.update(fileAssets).set({ expiresAt: null }).where(eq(fileAssets.id, row.id));
    }
    return ok;
  }

  /** Swallow store/SDK errors — the sweep is the retry path. Never leaks detail. */
  private async tryDeleteBlob(pathname: string): Promise<boolean> {
    if (!this.deleteBlob) return false;
    try {
      await this.deleteBlob(pathname);
      return true;
    } catch {
      return false;
    }
  }

  private async reapOrphanPending(now: Date, limit: number): Promise<number> {
    const orphans = await this.db
      .select()
      .from(fileAssets)
      .where(
        and(
          eq(fileAssets.status, "pending"),
          isNotNull(fileAssets.expiresAt),
          lt(fileAssets.expiresAt, now),
        ),
      )
      .limit(limit);

    let reaped = 0;
    for (const row of orphans) {
      // The blob may not exist (the upload never finished) — best-effort.
      await this.tryDeleteBlob(row.pathname);
      const [done] = await this.db
        .update(fileAssets)
        .set({ status: "failed", expiresAt: null })
        .where(and(eq(fileAssets.id, row.id), eq(fileAssets.status, "pending")))
        .returning();
      if (done) reaped++;
    }
    return reaped;
  }

  private async retryDeletedPurge(
    now: Date,
    limit: number,
  ): Promise<{ purged: number; failures: number }> {
    const stuck = await this.db
      .select()
      .from(fileAssets)
      .where(
        and(
          eq(fileAssets.status, "deleted"),
          isNotNull(fileAssets.expiresAt),
          lt(fileAssets.expiresAt, now),
        ),
      )
      .limit(limit);

    let purged = 0;
    let failures = 0;
    for (const row of stuck) {
      if (await this.purgeBlob(row)) purged++;
      else failures++;
    }
    return { purged, failures };
  }

  private notFound(): NotFoundException {
    return new NotFoundException("파일을 찾을 수 없습니다. 다시 시도해 주세요.");
  }
}
