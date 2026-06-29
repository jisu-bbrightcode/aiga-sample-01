import { Body, Controller, HttpCode, Post, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from "@nestjs/swagger";
import type { User } from "@repo/core/nestjs/auth";
import { BetterAuthGuard, CurrentUser } from "@repo/core/nestjs/auth";
import {
  CompleteUploadDto,
  CreateUploadDto,
  completedUploadOpenApiSchema,
  uploadDraftOpenApiSchema,
} from "../dto";
import { FileUploadService } from "../service";

/**
 * File upload API.
 *
 * - `POST /files/uploads` (PB-FILE-API-CREATE-001 / BBR-548) issues a
 *   short-lived Vercel Blob client-upload token.
 * - `POST /files/uploads/complete` (PB-FILE-API-COMPLETE-001 / BBR-549) confirms
 *   a finished upload and activates its metadata.
 *
 * Both routes are guarded by {@link BetterAuthGuard}: unauthenticated callers get
 * 401 and never receive a token or activate an asset (acceptance criteria §1).
 */
@ApiTags("File Upload")
@Controller("files/uploads")
export class FileUploadController {
  constructor(private readonly service: FileUploadService) {}

  @Post()
  @HttpCode(201)
  @UseGuards(BetterAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({
    summary: "파일 업로드 시작 — Vercel Blob client upload 토큰/메타 발급 (로그인 필요)",
  })
  @ApiResponse({
    status: 201,
    description: "업로드 draft (서버 생성 pathname + 단기 client token + pending metadata)",
    schema: uploadDraftOpenApiSchema,
  })
  @ApiResponse({ status: 401, description: "인증 필요" })
  @ApiResponse({
    status: 422,
    description: "허용되지 않은 MIME type / 확장자 / 크기 (정책 거부)",
  })
  createUpload(@CurrentUser() user: User, @Body() dto: CreateUploadDto) {
    return this.service.createUpload(user.id, dto);
  }

  @Post("complete")
  @HttpCode(200)
  @UseGuards(BetterAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({
    summary: "파일 업로드 완료 확정 — 서버에서 blob 재검증 후 metadata 활성화 (로그인 필요)",
  })
  @ApiResponse({
    status: 200,
    description: "활성화된 file asset (서버 검증 metadata). 중복 요청은 같은 asset으로 수렴.",
    schema: completedUploadOpenApiSchema,
  })
  @ApiResponse({ status: 401, description: "인증 필요" })
  @ApiResponse({ status: 404, description: "pending metadata를 찾을 수 없음 (소유자 불일치 포함)" })
  @ApiResponse({
    status: 422,
    description: "업로드 미완료(orphan) 또는 서버 검증 정책 위반 — 롤백됨",
  })
  completeUpload(@CurrentUser() user: User, @Body() dto: CompleteUploadDto) {
    return this.service.completeUpload(user.id, dto);
  }
}
