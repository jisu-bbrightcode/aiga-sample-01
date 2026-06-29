import { Body, Controller, HttpCode, Post, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from "@nestjs/swagger";
import type { User } from "@repo/core/nestjs/auth";
import { BetterAuthGuard, CurrentUser } from "@repo/core/nestjs/auth";
import { CreateUploadDto, uploadDraftOpenApiSchema } from "../dto";
import { FileUploadService } from "../service";

/**
 * File upload create/token API (PB-FILE-API-CREATE-001 / BBR-548).
 *
 * `POST /files/uploads` issues a short-lived Vercel Blob client-upload token.
 * The route is guarded by {@link BetterAuthGuard}: unauthenticated callers get
 * 401 and never receive a token or upload info (acceptance criteria §1).
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
}
