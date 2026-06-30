import { Controller, Get, Param, ParseUUIDPipe, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from "@nestjs/swagger";
import type { User } from "@repo/core/nestjs/auth";
import { BetterAuthAdminGuard, BetterAuthGuard } from "@repo/core/nestjs/auth";
import { adminFileDetailOpenApiSchema, fileDetailOpenApiSchema } from "../dto";
import { FileDetailService } from "../service";
import { OptionalUser } from "./optional-user.decorator";

/**
 * `GET /files/:id` — single file detail with the public/private access policy
 * (PB-FILE-API-READ-001 / BBR-551).
 *
 * Unguarded + {@link OptionalUser}: public (`public` + `ready`) files are served
 * to anyone, including anonymous callers; private files are released only to the
 * file owner or the owner of the attached domain resource. Any other caller —
 * and any missing or soft-deleted id — receives an identical 404, so file
 * existence cannot be inferred (acceptance criteria §2).
 */
@ApiTags("File Upload")
@Controller("files")
export class FileDetailController {
  constructor(private readonly service: FileDetailService) {}

  @Get(":id")
  @ApiOperation({
    summary: "파일 상세/접근 URL (공개 파일은 비로그인 가능, private 파일은 권한 필요)",
  })
  @ApiResponse({ status: 200, schema: fileDetailOpenApiSchema })
  @ApiResponse({ status: 400, description: "잘못된 파일 ID 형식" })
  @ApiResponse({ status: 404, description: "파일을 찾을 수 없거나 접근 권한이 없음" })
  getFile(@Param("id", new ParseUUIDPipe()) id: string, @OptionalUser() user: User | undefined) {
    return this.service.getAccessibleById(id, user);
  }
}

/**
 * `GET /admin/files/:id` — operator file detail (PB-FILE-API-READ-001 / BBR-551).
 *
 * Guarded by {@link BetterAuthGuard} then {@link BetterAuthAdminGuard}. Returns
 * the full record for any file, including soft-deleted rows.
 */
@ApiTags("File Upload (Admin)")
@ApiBearerAuth()
@UseGuards(BetterAuthGuard, BetterAuthAdminGuard)
@Controller("admin/files")
export class FileAdminDetailController {
  constructor(private readonly service: FileDetailService) {}

  @Get(":id")
  @ApiOperation({ summary: "관리자 파일 상세 (내부/감사 필드 포함, soft-delete 포함)" })
  @ApiResponse({ status: 200, schema: adminFileDetailOpenApiSchema })
  @ApiResponse({ status: 400, description: "잘못된 파일 ID 형식" })
  @ApiResponse({ status: 401, description: "인증 필요" })
  @ApiResponse({ status: 403, description: "관리자 권한 필요" })
  @ApiResponse({ status: 404, description: "파일을 찾을 수 없음" })
  getAdminFile(@Param("id", new ParseUUIDPipe()) id: string) {
    return this.service.getAdminById(id);
  }
}
