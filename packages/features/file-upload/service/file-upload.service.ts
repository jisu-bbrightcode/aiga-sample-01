import {
  NotFoundException,
  ServiceUnavailableException,
  UnprocessableEntityException,
} from "@nestjs/common";
import { type DrizzleDB, type FileAsset, fileAssets } from "@repo/drizzle";
import { and, eq, ne } from "drizzle-orm";
import { ulid } from "ulid";
import type { CompleteUploadInput, CreateUploadInput } from "../dto";
import {
  buildBlobPathname,
  DEFAULT_MAX_UPLOAD_BYTES,
  UploadPolicyError,
  validateCompletedBlob,
  validateUploadRequest,
} from "../policy";

/** Path on THIS server that Vercel Blob calls when a client upload finishes. */
export const UPLOAD_CALLBACK_PATH = "/files/uploads/callback";

const DEFAULT_TOKEN_TTL_SECONDS = 60 * 30; // 30 min — generous for large client uploads
const DEFAULT_PENDING_TTL_HOURS = 24; // orphan cleanup window (PB-FILE-001 §5.4)

/**
 * Mints a Vercel Blob client-upload token bound to a server-chosen pathname.
 * Wraps `generateClientTokenFromReadWriteToken`; injected so the service stays
 * unit-testable without the SDK or a live Blob store.
 */
export type ClientTokenIssuer = (params: {
  pathname: string;
  allowedContentTypes: string[];
  maximumSizeInBytes: number;
  validUntil: number;
  callbackUrl?: string;
  tokenPayload?: string;
}) => Promise<string>;

/** Server-verified blob metadata read back from the store on completion. */
export interface BlobHeadInfo {
  url: string;
  downloadUrl: string;
  pathname: string;
  contentType: string;
  size: number;
}

/**
 * Reads authoritative metadata for an uploaded blob (wraps `@vercel/blob` head).
 * Returns `null` when the blob does not exist (an orphan — token issued but the
 * client never finished uploading); throws on transient errors. Injected so the
 * service stays unit-testable without a live Blob store.
 */
export type BlobHeadReader = (pathname: string) => Promise<BlobHeadInfo | null>;

/** Deletes a blob from the store (wraps `@vercel/blob` del) — used for rollback. */
export type BlobDeleter = (pathname: string) => Promise<void>;

export interface FileUploadServiceOptions {
  db: DrizzleDB;
  issueClientToken: ClientTokenIssuer;
  /** Reads server-verified blob metadata on completion (required for completeUpload). */
  readBlobHead?: BlobHeadReader;
  /** Deletes orphaned/invalid blobs on rollback (required for completeUpload). */
  deleteBlob?: BlobDeleter;
  /** Public absolute base URL of this server (for the Blob completion callback). */
  callbackBaseUrl?: string;
  tokenTtlSeconds?: number;
  pendingTtlHours?: number;
  maxBytes?: number;
  /** Injected for deterministic tests. */
  now?: () => Date;
  newId?: () => string;
}

export interface UploadDraft {
  fileAssetId: string;
  pathname: string;
  clientToken: string;
  contentType: string;
  maximumSizeInBytes: number;
  visibility: "public" | "private";
  expiresAt: string;
}

/** Activated asset returned by {@link FileUploadService.completeUpload}. */
export interface CompletedUpload {
  fileAssetId: string;
  status: "ready";
  pathname: string;
  url: string;
  downloadUrl: string | null;
  contentType: string;
  size: number;
  visibility: "public" | "private";
  targetType: string | null;
  targetId: string | null;
  completedAt: string;
}

/**
 * file-upload create/token + completion service.
 *
 * EXTEND of the base file-upload capability: the base only had a server-side
 * `put()` helper. This adds the *client upload* lifecycle —
 *   - create/token (PB-FILE-API-CREATE-001 / BBR-548): validate against policy,
 *     generate an unguessable server pathname, persist a `pending` row, and mint
 *     a short-lived token the browser uses to upload directly to Blob.
 *   - completion (PB-FILE-API-COMPLETE-001 / BBR-549): match the pending row,
 *     re-verify the uploaded blob against the store (never the client result),
 *     and flip it to `ready`. Idempotent; orphaned/invalid uploads are rolled
 *     back (failed + blob deleted).
 */
export class FileUploadService {
  private readonly db: DrizzleDB;
  private readonly issueClientToken: ClientTokenIssuer;
  private readonly readBlobHead?: BlobHeadReader;
  private readonly deleteBlob?: BlobDeleter;
  private readonly callbackBaseUrl?: string;
  private readonly tokenTtlSeconds: number;
  private readonly pendingTtlHours: number;
  private readonly maxBytes: number;
  private readonly now: () => Date;
  private readonly newId: () => string;

  constructor(options: FileUploadServiceOptions) {
    this.db = options.db;
    this.issueClientToken = options.issueClientToken;
    this.readBlobHead = options.readBlobHead;
    this.deleteBlob = options.deleteBlob;
    this.callbackBaseUrl = options.callbackBaseUrl;
    this.tokenTtlSeconds = options.tokenTtlSeconds ?? DEFAULT_TOKEN_TTL_SECONDS;
    this.pendingTtlHours = options.pendingTtlHours ?? DEFAULT_PENDING_TTL_HOURS;
    this.maxBytes = options.maxBytes ?? DEFAULT_MAX_UPLOAD_BYTES;
    this.now = options.now ?? (() => new Date());
    this.newId = options.newId ?? (() => ulid());
  }

  /**
   * Validate, persist a pending asset, and mint a client upload token.
   *
   * @param ownerUserId authenticated uploader (the controller's BetterAuthGuard
   *        guarantees this is never anonymous — acceptance criteria §1).
   */
  async createUpload(ownerUserId: string, input: CreateUploadInput): Promise<UploadDraft> {
    const normalized = this.validate(input);

    const now = this.now();
    const id = this.newId();
    const visibility = input.visibility ?? "private";
    const pathname = buildBlobPathname({
      visibility,
      extension: normalized.extension,
      id,
      now,
    });
    const expiresAt = new Date(now.getTime() + this.pendingTtlHours * 60 * 60 * 1000);

    // Persist the pending row first so the token's payload references a real
    // asset id. `blobUrl` is provisional (holds the pathname) until completion
    // overwrites it with the canonical Blob URL — a `pending` asset is never
    // served publicly, so the provisional value is never exposed.
    const [row] = await this.db
      .insert(fileAssets)
      .values({
        id,
        ownerUserId,
        source: "user",
        targetType: input.targetType ?? null,
        targetId: input.targetId ?? null,
        blobUrl: pathname,
        pathname,
        originalName: input.filename,
        visibility,
        status: "pending",
        declaredContentType: normalized.contentType,
        declaredSize: normalized.size,
        expiresAt,
      })
      .returning();

    if (!row) {
      throw new ServiceUnavailableException(
        "파일 업로드를 시작하지 못했습니다. 잠시 후 다시 시도해 주세요.",
      );
    }

    const clientToken = await this.mintToken({
      pathname,
      contentType: normalized.contentType,
      maximumSizeInBytes: normalized.size,
      validUntilMs: now.getTime() + this.tokenTtlSeconds * 1000,
      fileAssetId: id,
    });

    return {
      fileAssetId: id,
      pathname,
      clientToken,
      contentType: normalized.contentType,
      maximumSizeInBytes: normalized.size,
      visibility,
      expiresAt: expiresAt.toISOString(),
    };
  }

  /**
   * Confirm a finished client upload and activate its metadata
   * (PB-FILE-API-COMPLETE-001 / BBR-549).
   *
   * The client sends only the `fileAssetId`; the server matches the pending row
   * it owns, reads the blob's authoritative metadata from the store via the
   * server-stored pathname (so an arbitrary Blob URL can never be injected —
   * AC§1), re-validates that metadata against policy (the client's upload result
   * is never trusted — AC§4), and flips the row to `ready`.
   *
   * Idempotent: a row that is already `ready` returns as-is, so duplicate
   * completion/callback requests converge on the same asset (AC§2). Orphaned or
   * policy-violating uploads are rolled back — marked `failed` and their bytes
   * deleted from the store (AC§3).
   *
   * @param ownerUserId authenticated caller (BetterAuthGuard); re-checked against
   *        the row's owner so completion also re-verifies authorization (AC§4).
   */
  async completeUpload(ownerUserId: string, input: CompleteUploadInput): Promise<CompletedUpload> {
    const row = await this.loadOwnedAsset(ownerUserId, input.fileAssetId);

    // Idempotent convergence: already activated → return the same asset (AC§2).
    if (row.status === "ready") return this.toCompleted(row);
    // A soft-deleted asset can never be (re)activated.
    if (row.status === "deleted") throw this.notFound();
    // status is `pending` or `failed` → (re)verify against the store and activate.

    const head = await this.readServerTruth(row.pathname);
    if (!head || head.pathname !== row.pathname) {
      // Token was issued but the bytes never landed (or landed elsewhere) →
      // orphan. Mark failed so the cleanup policy can reap it (AC§3).
      await this.markFailed(row.id);
      throw new UnprocessableEntityException({
        code: "upload_not_found",
        message: "업로드가 완료되지 않았습니다. 파일을 다시 업로드해 주세요.",
      });
    }

    // AC§4: never trust the client's upload result — re-validate the store's own
    // report against policy. A violation means the uploaded bytes are not
    // acceptable, so roll the upload back (delete bytes + mark failed).
    const policyError = this.checkBlobPolicy(head);
    if (policyError) {
      await this.rollback(row.id, row.pathname);
      throw new UnprocessableEntityException(policyError);
    }

    const activated = await this.activate(row, head);
    return this.toCompleted(activated);
  }

  private async loadOwnedAsset(ownerUserId: string, fileAssetId: string): Promise<FileAsset> {
    const [row] = await this.db
      .select()
      .from(fileAssets)
      .where(eq(fileAssets.id, fileAssetId))
      .limit(1);

    // Unknown id OR not the caller's asset → 404 (re-verify authorization
    // without leaking whether the id exists, AC§4).
    if (!row || row.ownerUserId !== ownerUserId) throw this.notFound();
    return row;
  }

  /** Read authoritative blob metadata; `null` = orphan, throw = transient 503. */
  private async readServerTruth(pathname: string): Promise<BlobHeadInfo | null> {
    if (!this.readBlobHead) {
      throw new ServiceUnavailableException(
        "파일 업로드를 일시적으로 사용할 수 없습니다. 잠시 후 다시 시도해 주세요.",
      );
    }
    try {
      return await this.readBlobHead(pathname);
    } catch {
      // Transient store/SDK failure — keep the row pending and let the caller
      // retry. Never leak the underlying error.
      throw new ServiceUnavailableException(
        "업로드 확인에 실패했습니다. 잠시 후 다시 시도해 주세요.",
      );
    }
  }

  private checkBlobPolicy(head: BlobHeadInfo): { code: string; message: string } | null {
    try {
      validateCompletedBlob(
        { pathname: head.pathname, contentType: head.contentType, size: head.size },
        this.maxBytes,
      );
      return null;
    } catch (error) {
      if (error instanceof UploadPolicyError) return { code: error.code, message: error.message };
      throw error;
    }
  }

  private async activate(row: FileAsset, head: BlobHeadInfo): Promise<FileAsset> {
    const now = this.now();
    // Guard on a non-deleted row so a concurrent soft-delete can't be revived.
    const [updated] = await this.db
      .update(fileAssets)
      .set({
        status: "ready",
        blobUrl: head.url,
        downloadUrl: head.downloadUrl,
        contentType: head.contentType,
        size: head.size,
        completedAt: now,
        // No longer an orphan candidate once confirmed.
        expiresAt: null,
      })
      .where(and(eq(fileAssets.id, row.id), ne(fileAssets.status, "deleted")))
      .returning();

    if (!updated) {
      // Lost a race to a soft-delete between load and update.
      throw this.notFound();
    }
    return updated;
  }

  private async markFailed(id: string): Promise<void> {
    await this.db
      .update(fileAssets)
      .set({ status: "failed" })
      .where(and(eq(fileAssets.id, id), ne(fileAssets.status, "deleted")));
  }

  /** Roll back a rejected upload: best-effort delete the bytes, then mark failed. */
  private async rollback(id: string, pathname: string): Promise<void> {
    if (this.deleteBlob) {
      try {
        await this.deleteBlob(pathname);
      } catch {
        // Best effort — the bytes are also reaped by the pending-TTL sweep.
      }
    }
    await this.markFailed(id);
  }

  private toCompleted(row: FileAsset): CompletedUpload {
    return {
      fileAssetId: row.id,
      status: "ready",
      pathname: row.pathname,
      url: row.blobUrl,
      downloadUrl: row.downloadUrl ?? null,
      contentType: row.contentType ?? "",
      size: row.size ?? 0,
      visibility: row.visibility,
      targetType: row.targetType ?? null,
      targetId: row.targetId ?? null,
      completedAt: (row.completedAt ?? this.now()).toISOString(),
    };
  }

  private notFound(): NotFoundException {
    return new NotFoundException("업로드를 찾을 수 없습니다. 다시 시도해 주세요.");
  }

  private validate(input: CreateUploadInput) {
    try {
      return validateUploadRequest(
        { filename: input.filename, contentType: input.contentType, size: input.size },
        this.maxBytes,
      );
    } catch (error) {
      if (error instanceof UploadPolicyError) {
        // 422 — disallowed type/extension/size is a policy rejection, not a
        // malformed request. Message is user-safe (no internal detail).
        throw new UnprocessableEntityException({ code: error.code, message: error.message });
      }
      throw error;
    }
  }

  private async mintToken(params: {
    pathname: string;
    contentType: string;
    maximumSizeInBytes: number;
    validUntilMs: number;
    fileAssetId: string;
  }): Promise<string> {
    const callbackUrl = this.callbackBaseUrl
      ? `${this.callbackBaseUrl.replace(/\/+$/, "")}${UPLOAD_CALLBACK_PATH}`
      : undefined;
    try {
      return await this.issueClientToken({
        pathname: params.pathname,
        allowedContentTypes: [params.contentType],
        maximumSizeInBytes: params.maximumSizeInBytes,
        validUntil: params.validUntilMs,
        callbackUrl,
        tokenPayload: JSON.stringify({ fileAssetId: params.fileAssetId }),
      });
    } catch {
      // Missing/invalid BLOB_READ_WRITE_TOKEN or SDK failure — never leak detail.
      throw new ServiceUnavailableException(
        "파일 업로드를 일시적으로 사용할 수 없습니다. 잠시 후 다시 시도해 주세요.",
      );
    }
  }
}
