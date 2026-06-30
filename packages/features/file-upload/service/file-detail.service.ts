import { NotFoundException } from "@nestjs/common";
import { type DrizzleDB, type FileAsset, fileAssets } from "@repo/drizzle";
import { eq } from "drizzle-orm";
import { type FileViewer, resolveFileDetailAccess } from "./file-access-policy";
import { type FileDetailView, toFileDetailView } from "./file-detail-mappers";
import { type AdminFileView, toAdminFileView } from "./file-list-mappers";

/**
 * Read-side service for a single file (PB-FILE-API-READ-001 / BBR-551).
 *
 * EXTEND of the file-upload capability: complements the owner/admin listings
 * with `GET /files/:id` (public + owner access) and `GET /admin/files/:id`
 * (operator full record). It only needs the DB, so it is constructed separately
 * from the Blob-backed {@link import("./file-upload.service").FileUploadService}.
 *
 * Existence is never leaked (acceptance criteria §2): every unauthorised or
 * missing lookup raises the same {@link NotFoundException}, so a private asset
 * cannot be distinguished from one that does not exist.
 */
export class FileDetailService {
  constructor(private readonly db: DrizzleDB) {}

  /**
   * Resolve a file for a public or owner caller (acceptance criteria §1, §2, §3).
   *
   * The access decision combines file-level and target-resource ownership; any
   * `denied` outcome — private asset, soft-deleted asset, or simply not found —
   * surfaces as an identical 404.
   */
  async getAccessibleById(id: string, viewer: FileViewer | undefined): Promise<FileDetailView> {
    const row = await this.findById(id);
    if (!row) throw new NotFoundException("파일을 찾을 수 없습니다.");

    const decision = resolveFileDetailAccess(row, viewer);
    if (decision === "denied") throw new NotFoundException("파일을 찾을 수 없습니다.");

    return toFileDetailView(row, decision);
  }

  /**
   * Resolve any file for an operator — the full record, including soft-deleted
   * rows. A genuinely missing id is the only 404 here.
   */
  async getAdminById(id: string): Promise<AdminFileView> {
    const row = await this.findById(id);
    if (!row) throw new NotFoundException("파일을 찾을 수 없습니다.");
    return toAdminFileView(row);
  }

  private async findById(id: string): Promise<FileAsset | undefined> {
    const [row] = await this.db.select().from(fileAssets).where(eq(fileAssets.id, id)).limit(1);
    return row;
  }
}
