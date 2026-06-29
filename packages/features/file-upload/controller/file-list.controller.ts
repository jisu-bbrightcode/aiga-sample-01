import { Controller, Get, Query, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from "@nestjs/swagger";
import type { User } from "@repo/core/nestjs/auth";
import { BetterAuthAdminGuard, BetterAuthGuard, CurrentUser } from "@repo/core/nestjs/auth";
import {
  adminFileOpenApiSchema,
  ListAdminFilesQueryDto,
  ListOwnFilesQueryDto,
  ownerFileOpenApiSchema,
} from "../dto";
import { FileListService } from "../service";

/**
 * `GET /files` — the authenticated owner's own files
 * (PB-FILE-API-LIST-001 / BBR-550).
 *
 * Guarded by {@link BetterAuthGuard}: the owner scope is taken from the session
 * user id, never from a query param, so a caller can only ever see their own
 * files (acceptance criteria §1). Soft-deleted files are excluded by the service.
 */
@ApiTags("File Upload")
@ApiBearerAuth()
@UseGuards(BetterAuthGuard)
@Controller("files")
export class FileListController {
  constructor(private readonly service: FileListService) {}

  @Get()
  @ApiOperation({ summary: "내 파일 목록 (소유자 전용, 필터 + 페이지네이션, 로그인 필요)" })
  @ApiResponse({ status: 200, schema: ownerFileOpenApiSchema })
  @ApiResponse({ status: 401, description: "인증 필요" })
  listOwnFiles(@CurrentUser() user: User, @Query() query: ListOwnFilesQueryDto) {
    return this.service.listOwnFiles(user.id, query);
  }
}

/**
 * `GET /admin/files` — operator file console (PB-FILE-API-LIST-001 / BBR-550).
 *
 * Guarded by {@link BetterAuthGuard} then {@link BetterAuthAdminGuard}
 * (owner/admin role). Exposes the full record and every filter — owner, target,
 * status, visibility, MIME type, source — plus `includeDeleted` (§2, §3).
 */
@ApiTags("File Upload (Admin)")
@ApiBearerAuth()
@UseGuards(BetterAuthGuard, BetterAuthAdminGuard)
@Controller("admin/files")
export class FileAdminController {
  constructor(private readonly service: FileListService) {}

  @Get()
  @ApiOperation({
    summary: "관리자 파일 목록 (owner/target/status/visibility/MIME 필터 + 페이지네이션)",
  })
  @ApiResponse({ status: 200, schema: adminFileOpenApiSchema })
  @ApiResponse({ status: 401, description: "인증 필요" })
  @ApiResponse({ status: 403, description: "관리자 권한 필요" })
  listAdminFiles(@Query() query: ListAdminFilesQueryDto) {
    return this.service.listAdminFiles(query);
  }
}
