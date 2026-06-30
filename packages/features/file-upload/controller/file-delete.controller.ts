import { Body, Controller, Delete, HttpCode, Param, Post, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from "@nestjs/swagger";
import type { User } from "@repo/core/nestjs/auth";
import { BetterAuthAdminGuard, BetterAuthGuard, CurrentUser } from "@repo/core/nestjs/auth";
import { CleanupFilesBodyDto, cleanupResultOpenApiSchema, deletedFileOpenApiSchema } from "../dto";
import { FileDeleteService } from "../service";

/**
 * `DELETE /files/:id` — owner file deletion (PB-FILE-API-DELETE-001 / BBR-553).
 *
 * Guarded by {@link BetterAuthGuard}: the owner is taken from the session and
 * re-checked against the row, so a caller can only ever delete their own files.
 * An unknown id and another user's file both return 404 — no existence leak
 * (acceptance criteria §1).
 */
@ApiTags("File Upload")
@ApiBearerAuth()
@UseGuards(BetterAuthGuard)
@Controller("files")
export class FileDeleteController {
  constructor(private readonly service: FileDeleteService) {}

  @Delete(":id")
  @HttpCode(200)
  @ApiOperation({ summary: "내 파일 삭제 (soft delete + Blob 정리, 로그인 필요)" })
  @ApiResponse({ status: 200, schema: deletedFileOpenApiSchema })
  @ApiResponse({ status: 401, description: "인증 필요" })
  @ApiResponse({
    status: 404,
    description: "파일을 찾을 수 없음 (소유자 불일치 포함, 정보 비노출)",
  })
  deleteOwn(@CurrentUser() user: User, @Param("id") id: string) {
    return this.service.deleteOwn(user.id, id);
  }
}

/**
 * Operator deletion + cleanup (PB-FILE-API-DELETE-001 / BBR-553).
 *
 * Guarded by {@link BetterAuthGuard} then {@link BetterAuthAdminGuard}
 * (owner/admin role). Force delete records an `admin_audit_log` entry; the
 * cleanup sweep is the operational orphan/blob reclaim task (§3).
 */
@ApiTags("File Upload (Admin)")
@ApiBearerAuth()
@UseGuards(BetterAuthGuard, BetterAuthAdminGuard)
@Controller("admin/files")
export class FileDeleteAdminController {
  constructor(private readonly service: FileDeleteService) {}

  @Post("cleanup")
  @HttpCode(200)
  @ApiOperation({
    summary: "파일 정리 작업 실행 — orphan pending 회수 + 실패한 Blob 삭제 재시도",
  })
  @ApiResponse({ status: 200, schema: cleanupResultOpenApiSchema })
  @ApiResponse({ status: 401, description: "인증 필요" })
  @ApiResponse({ status: 403, description: "관리자 권한 필요" })
  runCleanup(@Body() body: CleanupFilesBodyDto) {
    return this.service.sweep({ limit: body.limit });
  }

  @Delete(":id")
  @HttpCode(200)
  @ApiOperation({ summary: "관리자 강제 파일 삭제 (soft delete + Blob 정리 + 감사 로그)" })
  @ApiResponse({ status: 200, schema: deletedFileOpenApiSchema })
  @ApiResponse({ status: 401, description: "인증 필요" })
  @ApiResponse({ status: 403, description: "관리자 권한 필요" })
  @ApiResponse({ status: 404, description: "파일을 찾을 수 없음" })
  forceDelete(@CurrentUser() user: User, @Param("id") id: string) {
    return this.service.forceDelete(user.id, id);
  }
}
