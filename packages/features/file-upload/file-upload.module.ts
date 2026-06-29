import { Module } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { DRIZZLE, type DrizzleDB } from "@repo/drizzle";
import { FileUploadController } from "./controller";
import { createBlobClientTokenIssuer, FileUploadService } from "./service";

/**
 * File upload feature module (PB-FILE-API-CREATE-001 / BBR-548).
 *
 * Wires the create/token controller + service. The client-token issuer is
 * backed by Vercel Blob (`BLOB_READ_WRITE_TOKEN`); when the token is unset the
 * service surfaces a friendly 503 rather than leaking SDK errors.
 *
 * `FILE_UPLOAD_PUBLIC_BASE_URL` is the public absolute URL of this server, used
 * to build the Blob completion callback (`/files/uploads/callback`, owned by
 * BBR-549). When unset, no callback is attached — the token still works; the
 * completion API can be wired independently.
 */
@Module({
  controllers: [FileUploadController],
  providers: [
    {
      provide: FileUploadService,
      useFactory: (db: DrizzleDB, configService: ConfigService) =>
        new FileUploadService({
          db,
          issueClientToken: createBlobClientTokenIssuer(
            configService.get<string>("BLOB_READ_WRITE_TOKEN"),
          ),
          callbackBaseUrl: configService.get<string>("FILE_UPLOAD_PUBLIC_BASE_URL"),
        }),
      inject: [DRIZZLE, ConfigService],
    },
  ],
  exports: [FileUploadService],
})
export class FileUploadModule {}
