import { ServiceUnavailableException, UnprocessableEntityException } from "@nestjs/common";
import { type DrizzleDB, fileAssets } from "@repo/drizzle";
import { ulid } from "ulid";
import type { CreateUploadInput } from "../dto";
import {
  buildBlobPathname,
  DEFAULT_MAX_UPLOAD_BYTES,
  UploadPolicyError,
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

export interface FileUploadServiceOptions {
  db: DrizzleDB;
  issueClientToken: ClientTokenIssuer;
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

/**
 * file-upload create/token service (PB-FILE-API-CREATE-001 / BBR-548).
 *
 * EXTEND of the base file-upload capability: the base only had a server-side
 * `put()` helper. This adds the *client upload* token flow — validate the
 * request against policy, generate an unguessable server pathname, persist a
 * `pending` file_assets row, and mint a short-lived token the browser uses to
 * upload directly to Blob. Completion (`onUploadCompleted`) is BBR-549.
 */
export class FileUploadService {
  private readonly db: DrizzleDB;
  private readonly issueClientToken: ClientTokenIssuer;
  private readonly callbackBaseUrl?: string;
  private readonly tokenTtlSeconds: number;
  private readonly pendingTtlHours: number;
  private readonly maxBytes: number;
  private readonly now: () => Date;
  private readonly newId: () => string;

  constructor(options: FileUploadServiceOptions) {
    this.db = options.db;
    this.issueClientToken = options.issueClientToken;
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
