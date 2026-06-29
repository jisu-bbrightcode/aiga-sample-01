import { Module } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { DRIZZLE, type DrizzleDB } from "@repo/drizzle";
import { FileAdminController, FileListController, FileUploadController } from "./controller";
import {
  createBlobClientTokenIssuer,
  createBlobDeleter,
  createBlobHeadReader,
  FileListService,
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
  controllers: [FileUploadController, FileListController, FileAdminController],
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
  ],
  exports: [FileUploadService, FileListService],
})
export class FileUploadModule {}
