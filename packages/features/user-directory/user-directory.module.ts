import { Module } from "@nestjs/common";
import { UserDirectoryAdminController, UserDirectoryController } from "./controller";
import { UserDirectoryService } from "./service";

/**
 * User-directory REST API (FR-001 사용자 / BBR-526).
 *
 * Capability: `domain.feature.fr-001.api.list` — 사용자 목록/검색 API.
 * Public member directory + 본인(self) view share one service with the
 * admin user-management list; identity itself (social login / profiles) is
 * REUSED from core and grade tiers come from PB-DATA-FR001 (user-grade).
 */
@Module({
  controllers: [UserDirectoryController, UserDirectoryAdminController],
  providers: [UserDirectoryService],
  exports: [UserDirectoryService],
})
export class UserDirectoryModule {}
