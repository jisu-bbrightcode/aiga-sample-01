import { Module } from "@nestjs/common";
import { AdminAuditService } from "../_common/service/admin-audit.service";
import { SessionRevocationService } from "../_common/service/session-revocation.service";
import { UserDirectoryAdminController, UserDirectoryController } from "./controller";
import { UserDirectoryService } from "./service";

/**
 * User-directory REST API (FR-001 사용자 / BBR-526).
 *
 * Capability: `domain.feature.fr-001.api.list` — 사용자 목록/검색 API.
 * Public member directory + 본인(self) view share one service with the
 * admin user-management list; identity itself (social login / profiles) is
 * REUSED from core and grade tiers come from PB-DATA-FR001 (user-grade).
 *
 * Admin soft-delete (archive) / restore (BBR-530) writes an attributable row
 * to `admin_audit_log`, so `AdminAuditService` is provided here as a
 * self-contained append-only writer (no `_common` module coupling needed).
 * Archiving also revokes the user's sessions via `SessionRevocationService`
 * (BBR-690) so an archived account is signed out everywhere.
 */
@Module({
  controllers: [UserDirectoryController, UserDirectoryAdminController],
  providers: [UserDirectoryService, AdminAuditService, SessionRevocationService],
  exports: [UserDirectoryService],
})
export class UserDirectoryModule {}
