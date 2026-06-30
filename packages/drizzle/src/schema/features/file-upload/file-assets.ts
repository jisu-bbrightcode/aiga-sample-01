import {
  index,
  integer,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  varchar,
} from "drizzle-orm/pg-core";
import { baseColumnsWithSoftDelete } from "../../../utils/columns";
import { users } from "../../core/better-auth";
import {
  fileReviewStatusEnum,
  fileScanStatusEnum,
  fileSourceEnum,
  fileStatusEnum,
  fileVisibilityEnum,
} from "./enums";

/**
 * file_assets — file metadata / permission model (PB-FILE-DATA-001 / BBR-547).
 *
 * EXTEND of the base file-upload capability. The base `files` table only kept
 * a Blob URL + uploader; this dedicated table adds everything the acceptance
 * criteria require so the platform never trusts a bare Blob URL:
 *   owner + target resource, server-verified content type/size/checksum,
 *   visibility, lifecycle status, scan/review state, and soft-delete audit.
 *
 * Trust boundary (acceptance criteria §3 — never trust client-sent values):
 *   - `declaredContentType` / `declaredSize` hold the UNTRUSTED values the
 *     client sent when requesting an upload token.
 *   - `contentType` / `size` / `checksum` hold the SERVER-VERIFIED values,
 *     populated on `onUploadCompleted`. Authorization and public exposure
 *     decisions must read the server-verified columns only.
 *
 * Ownership / target (PB-FILE-001 §5.3):
 *   - `ownerUserId` = uploader (nullable: system-generated files have no human
 *     owner; classified instead by `source`).
 *   - `targetType` / `targetId` = polymorphic link to the resource the file is
 *     attached to (e.g. "profile" / userId, "hospital" / hospitalId). Kept as
 *     a soft reference — no cross-feature FK — so any feature can attach files
 *     without coupling this table to its schema.
 *
 * Lifecycle (PB-FILE-001 §5.4):
 *   pending (token issued) → ready (bytes confirmed) | failed. Soft-delete
 *   sets status='deleted' + deletedAt + deletedBy for audit/cleanup. Orphaned
 *   `pending` rows past `expiresAt` are cleanup-job targets.
 */
export const fileAssets = pgTable(
  "file_assets",
  {
    ...baseColumnsWithSoftDelete(),

    // -- ownership / provenance ----------------------------------------------
    /** Uploader. Null for system-generated assets (see `source`). */
    ownerUserId: text("owner_user_id").references(() => users.id, { onDelete: "set null" }),
    /** user | admin | system — distinguishes user uploads from admin/system files. */
    source: fileSourceEnum("source").notNull().default("user"),

    // -- target resource (polymorphic, soft reference) -----------------------
    /** Resource kind the file is attached to, e.g. "profile", "hospital", "post". */
    targetType: varchar("target_type", { length: 64 }),
    /** Id of the attached resource (string to allow uuid or composite keys). */
    targetId: varchar("target_id", { length: 255 }),

    // -- blob storage --------------------------------------------------------
    /** Canonical Vercel Blob URL. */
    blobUrl: text("blob_url").notNull(),
    /** Blob pathname/key (unique storage location). */
    pathname: text("pathname").notNull(),
    /** Optional download URL variant (Blob `downloadUrl`). */
    downloadUrl: text("download_url"),
    /** Original client-provided filename (display only). */
    originalName: text("original_name").notNull(),

    // -- editable presentation metadata (PB-FILE-API-UPDATE-001 / BBR-552) ----
    /**
     * Accessibility alt text for image assets (operator/owner editable).
     * Distinct from the binary: never affects the stored bytes. Null = unset.
     */
    altText: text("alt_text"),
    /**
     * Display order within a target resource's file collection (owner/admin
     * editable). Lower sorts first; default 0. Pure presentation metadata.
     */
    sortOrder: integer("sort_order").notNull().default(0),

    // -- access / lifecycle --------------------------------------------------
    /** Access policy. Default private; public requires explicit whitelist. */
    visibility: fileVisibilityEnum("visibility").notNull().default("private"),
    /** Upload lifecycle. */
    status: fileStatusEnum("status").notNull().default("pending"),

    // -- server-verified metadata (authoritative) ----------------------------
    /** Server-verified MIME type (set on completion). Use this for decisions. */
    contentType: varchar("content_type", { length: 255 }),
    /** Server-verified byte size (set on completion). */
    size: integer("size"),
    /** Server-computed checksum (e.g. sha256 hex) for integrity/dedup. */
    checksum: varchar("checksum", { length: 128 }),
    /** Algorithm used for `checksum`, e.g. "sha256". */
    checksumAlgorithm: varchar("checksum_algorithm", { length: 16 }),

    // -- client-declared metadata (UNTRUSTED) --------------------------------
    /** MIME the client claimed at token request. Never trusted for decisions. */
    declaredContentType: varchar("declared_content_type", { length: 255 }),
    /** Size the client claimed at token request. Never trusted for decisions. */
    declaredSize: integer("declared_size"),

    // -- scan / review state -------------------------------------------------
    /** Malware/safety scan state. */
    scanStatus: fileScanStatusEnum("scan_status").notNull().default("pending"),
    scannedAt: timestamp("scanned_at", { withTimezone: true }),
    /** Content moderation state (UGC safety). */
    reviewStatus: fileReviewStatusEnum("review_status").notNull().default("not_required"),

    // -- timing / audit ------------------------------------------------------
    /** When the upload was confirmed (`onUploadCompleted`). */
    completedAt: timestamp("completed_at", { withTimezone: true }),
    /** Orphan TTL: pending rows past this are cleanup-job targets. */
    expiresAt: timestamp("expires_at", { withTimezone: true }),
    /** Who soft-deleted the asset (audit). */
    deletedBy: text("deleted_by").references(() => users.id, { onDelete: "set null" }),
  },
  (t) => [
    // unique blob storage location
    uniqueIndex("uq_file_assets_pathname").on(t.pathname),
    // list a user's files
    index("idx_file_assets_owner").on(t.ownerUserId),
    // list files attached to a resource
    index("idx_file_assets_target").on(t.targetType, t.targetId),
    // public delivery: published + public assets
    index("idx_file_assets_visibility_status").on(t.visibility, t.status),
    // orphan cleanup: expired pending rows
    index("idx_file_assets_status_expires").on(t.status, t.expiresAt),
    // scan/review work queues
    index("idx_file_assets_scan_status").on(t.scanStatus),
    index("idx_file_assets_review_status").on(t.reviewStatus),
    // admin console: most-recently-created first
    index("idx_file_assets_created_at").on(t.createdAt),
  ],
);

export type FileAsset = typeof fileAssets.$inferSelect;
export type NewFileAsset = typeof fileAssets.$inferInsert;
