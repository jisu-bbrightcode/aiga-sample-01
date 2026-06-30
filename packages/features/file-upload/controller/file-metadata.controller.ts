import { Body, Controller, Param, ParseUUIDPipe, Patch, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from "@nestjs/swagger";
import type { User } from "@repo/core/nestjs/auth";
import { BetterAuthAdminGuard, BetterAuthGuard, CurrentUser } from "@repo/core/nestjs/auth";
import {
  UpdateAdminFileMetadataDto,
  UpdateOwnFileMetadataDto,
  fileMetadataOpenApiSchema,
} from "../dto";
import { FileMetadataService } from "../service";

/**
 * `PATCH /files/:id` — the owner edits their own file's metadata
 * (PB-FILE-API-UPDATE-001 / BBR-552).
 *
 * Guarded by {@link BetterAuthGuard}: the owner scope is taken from the session
 * user, never the body, so a caller can only ever edit their own file. Editing
 * never replaces the binary (AC §1); making a file public must pass the
 * visibility policy (AC §2); the change is audited as an owner edit (AC §3).
 */
@ApiTags("File Upload")
@ApiBearerAuth()
@UseGuards(BetterAuthGuard)
@Controller("files")
export class FileMetadataController {
  constructor(private readonly service: FileMetadataService) {}

  @Patch(":id")
  @ApiOperation({
    summary: "내 파일 metadata 수정 (표시명/alt text/대상 연결/공개여부/정렬, 로그인 필요)",
  })
  @ApiResponse({ status: 200, schema: fileMetadataOpenApiSchema })
  @ApiResponse({ status: 400, description: "잘못된 요청 (빈 patch / 대상 연결 불완전)" })
  @ApiResponse({ status: 401, description: "인증 필요" })
  @ApiResponse({ status: 404, description: "파일 없음 (소유자 불일치/삭제 포함)" })
  @ApiResponse({ status: 422, description: "공개 전환 정책 위반 (미확정/검수 미통과)" })
  updateOwnFile(
    @CurrentUser() user: User,
    @Param("id", ParseUUIDPipe) id: string,
    @Body() dto: UpdateOwnFileMetadataDto,
  ) {
    return this.service.updateOwnFile(user.id, id, dto);
  }
}

/**
 * `PATCH /admin/files/:id` — an operator edits any file's metadata, and may
 * additionally set the moderation `reviewStatus`
 * (PB-FILE-API-UPDATE-001 / BBR-552).
 *
 * Guarded by {@link BetterAuthGuard} then {@link BetterAuthAdminGuard}. The
 * change is audited as an admin edit (distinct action from owner edits — AC §3).
 */
@ApiTags("File Upload (Admin)")
@ApiBearerAuth()
@UseGuards(BetterAuthGuard, BetterAuthAdminGuard)
@Controller("admin/files")
export class FileMetadataAdminController {
  constructor(private readonly service: FileMetadataService) {}

  @Patch(":id")
  @ApiOperation({
    summary: "관리자 파일 metadata 수정 (+ review status, 관리자 권한 필요)",
  })
  @ApiResponse({ status: 200, schema: fileMetadataOpenApiSchema })
  @ApiResponse({ status: 400, description: "잘못된 요청 (빈 patch / 대상 연결 불완전)" })
  @ApiResponse({ status: 401, description: "인증 필요" })
  @ApiResponse({ status: 403, description: "관리자 권한 필요" })
  @ApiResponse({ status: 404, description: "파일 없음" })
  @ApiResponse({ status: 409, description: "삭제된 파일은 수정 불가" })
  @ApiResponse({ status: 422, description: "공개 전환 정책 위반" })
  updateFileAsAdmin(
    @CurrentUser() user: User,
    @Param("id", ParseUUIDPipe) id: string,
    @Body() dto: UpdateAdminFileMetadataDto,
  ) {
    return this.service.updateFileAsAdmin(user.id, id, dto);
  }
}
