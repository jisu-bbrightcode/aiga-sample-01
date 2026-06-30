import { Module } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { DRIZZLE, type DrizzleDB } from "@repo/drizzle";
import { AdminAuditService } from "../_common/service/admin-audit.service";
import {
  FileAdminController,
  FileListController,
  FileMetadataAdminController,
  FileMetadataController,
  FileUploadController,
} from "./controller";
import {
  createBlobClientTokenIssuer,
  createBlobDeleter,
  createBlobHeadReader,
  FileListService,
  FileMetadataService,
  FileUploadService,
} from "./service";

/**
 * File upload feature module.
 *
 * Wires the create/token + completion controller and service. The Vercel Blob
 * helpers (token issuer, `head` reader, `del`) are backed by
 * `BLOB_READ_WRITE_TOKEN`; when it is unset the service surfaces friendly
 * 503s rather than leaking SDK errors.
 *
 * `FILE_UPLOAD_PUBLIC_BASE_URL` is the public absolute URL of this server, used
 * to build the Blob completion callback (`/files/uploads/callback`). When unset,
 * no callback is attached — the client-driven `POST /files/uploads/complete`
 * endpoint (BBR-549) confirms uploads regardless.
 */
@Module({
  controllers: [
    FileUploadController,
    FileListController,
    FileAdminController,
    FileMetadataController,
    FileMetadataAdminController,
  ],
  providers: [
    {
      provide: FileUploadService,
      useFactory: (db: DrizzleDB, configService: ConfigService) => {
        const readWriteToken = configService.get<string>("BLOB_READ_WRITE_TOKEN");
        return new FileUploadService({
          db,
          issueClientToken: createBlobClientTokenIssuer(readWriteToken),
          readBlobHead: createBlobHeadReader(readWriteToken),
          deleteBlob: createBlobDeleter(readWriteToken),
          callbackBaseUrl: configService.get<string>("FILE_UPLOAD_PUBLIC_BASE_URL"),
        });
      },
      inject: [DRIZZLE, ConfigService],
    },
    {
      provide: FileListService,
      useFactory: (db: DrizzleDB) => new FileListService(db),
      inject: [DRIZZLE],
    },
    {
      // EXTEND (BBR-552): metadata update writes one row to the shared
      // admin_audit_log per applied change. The DrizzleModule is global, so the
      // audit writer is constructed inline (no module coupling), mirroring the
      // other audited write-paths (FR-001/FR-004).
      provide: FileMetadataService,
      useFactory: (db: DrizzleDB) => new FileMetadataService(db, new AdminAuditService(db)),
      inject: [DRIZZLE],
    },
  ],
  exports: [FileUploadService, FileListService, FileMetadataService],
})
export class FileUploadModule {}
