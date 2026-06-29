import { type DrizzleDB, type FileAsset, fileAssets } from "@repo/drizzle";
import { and, count, desc, eq, ne, type SQL } from "drizzle-orm";
import type { ListAdminFilesQuery, ListOwnFilesQuery } from "../dto";
import {
  type AdminFileView,
  type OwnerFileView,
  toAdminFileView,
  toOwnerFileView,
} from "./file-list-mappers";

/** Paginated result envelope. */
export interface PagedFiles<T> {
  items: T[];
  total: number;
  page: number;
  limit: number;
}

/**
 * Read-side service for file listings (PB-FILE-API-LIST-001 / BBR-550).
 *
 * EXTEND of the file-upload capability: complements the create/complete
 * write-path with owner-scoped (`GET /files`) and operator (`GET /admin/files`)
 * browse endpoints. It only needs the DB, so it is constructed separately from
 * the Blob-backed {@link import("./file-upload.service").FileUploadService}.
 *
 * Exposure policy (acceptance criteria §3) lives here so it is consistent across
 * both surfaces: soft-deleted rows are never returned to owners, and are hidden
 * from operators unless `includeDeleted` is set.
 */
export class FileListService {
  constructor(private readonly db: DrizzleDB) {}

  /**
   * List the authenticated owner's own files (acceptance criteria §1).
   *
   * Ownership is enforced server-side from the session user id — the caller
   * cannot widen the scope. `deleted` rows are always excluded.
   */
  listOwnFiles(ownerUserId: string, query: ListOwnFilesQuery): Promise<PagedFiles<OwnerFileView>> {
    const filters: SQL[] = [
      eq(fileAssets.ownerUserId, ownerUserId),
      // §3: a soft-deleted asset is never exposed to its owner.
      ne(fileAssets.status, "deleted"),
    ];
    if (query.status) filters.push(eq(fileAssets.status, query.status));
    if (query.visibility) filters.push(eq(fileAssets.visibility, query.visibility));
    if (query.targetType) filters.push(eq(fileAssets.targetType, query.targetType));
    if (query.targetId) filters.push(eq(fileAssets.targetId, query.targetId));
    if (query.contentType) filters.push(eq(fileAssets.contentType, query.contentType));

    return this.page(filters, query.page, query.limit, toOwnerFileView);
  }

  /**
   * List every file for an operator with full filters (acceptance criteria §2):
   * owner, target, status, visibility, MIME type, source.
   *
   * §3: `deleted` rows stay hidden unless `includeDeleted` is requested, keeping
   * the deletion-exposure policy consistent with the owner listing by default.
   */
  listAdminFiles(query: ListAdminFilesQuery): Promise<PagedFiles<AdminFileView>> {
    const filters: SQL[] = [];
    if (!query.includeDeleted && !query.status) {
      filters.push(ne(fileAssets.status, "deleted"));
    }
    if (query.ownerUserId) filters.push(eq(fileAssets.ownerUserId, query.ownerUserId));
    if (query.source) filters.push(eq(fileAssets.source, query.source));
    if (query.status) filters.push(eq(fileAssets.status, query.status));
    if (query.visibility) filters.push(eq(fileAssets.visibility, query.visibility));
    if (query.targetType) filters.push(eq(fileAssets.targetType, query.targetType));
    if (query.targetId) filters.push(eq(fileAssets.targetId, query.targetId));
    if (query.contentType) filters.push(eq(fileAssets.contentType, query.contentType));

    return this.page(filters, query.page, query.limit, toAdminFileView);
  }

  /**
   * Shared paginate: count + windowed page, newest first. The count and rows
   * share the same predicate so `total` always matches the filtered set.
   */
  private async page<T>(
    filters: SQL[],
    page: number,
    limit: number,
    map: (row: FileAsset) => T,
  ): Promise<PagedFiles<T>> {
    const where = filters.length ? and(...filters) : undefined;
    const offset = (page - 1) * limit;

    const [rows, totalRows] = await Promise.all([
      this.db
        .select()
        .from(fileAssets)
        .where(where)
        .orderBy(desc(fileAssets.createdAt), desc(fileAssets.id))
        .limit(limit)
        .offset(offset),
      this.db.select({ value: count() }).from(fileAssets).where(where),
    ]);

    return {
      items: rows.map(map),
      total: Number(totalRows[0]?.value ?? 0),
      page,
      limit,
    };
  }
}
