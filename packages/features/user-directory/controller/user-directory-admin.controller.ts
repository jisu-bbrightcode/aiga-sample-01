import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Query,
  Req,
  UseGuards,
} from "@nestjs/common";
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from "@nestjs/swagger";
import {
  BetterAuthAdminGuard,
  BetterAuthGuard,
  CurrentUser,
  type User,
} from "@repo/core/nestjs/auth";
import { AdminUserDto, AdminUserListDto, ArchiveUserBodyDto, ListAdminUsersQueryDto } from "../dto";
import { UserDirectoryService } from "../service";

/** Minimal request shape for capturing audit metadata (ip / user-agent). */
interface RequestLike {
  ip?: string;
  headers?: Record<string, string | string[] | undefined>;
}

function headerValue(req: RequestLike, name: string): string | undefined {
  const raw = req.headers?.[name];
  if (Array.isArray(raw)) return raw[0];
  return typeof raw === "string" ? raw : undefined;
}

/**
 * 사용자 관리 API — 관리자 티어 (FR-001, BBR-526).
 *
 * Gated by BetterAuthGuard (authenticated) then BetterAuthAdminGuard
 * (owner/admin). Exposes the full user record incl. email/인증수단/활성여부/
 * 소프트삭제 부기 and the resolved grade (출처/일일한도/만료) plus operational
 * filters (활성여부·인증수단·삭제포함). Public surfaces never reach this controller.
 */
@ApiTags("Users (Admin)")
@ApiBearerAuth()
@UseGuards(BetterAuthGuard, BetterAuthAdminGuard)
@Controller("admin/users")
export class UserDirectoryAdminController {
  constructor(private readonly service: UserDirectoryService) {}

  @Get()
  @ApiOperation({ summary: "사용자 목록/검색 (관리자, 전체 필드/필터)" })
  @ApiResponse({ status: 200, type: AdminUserListDto })
  @ApiResponse({ status: 401, description: "인증 필요" })
  @ApiResponse({ status: 403, description: "관리자 권한 없음" })
  listUsers(@Query() query: ListAdminUsersQueryDto) {
    return this.service.listAdminUsers(query);
  }

  @Get(":id")
  @ApiOperation({ summary: "사용자 상세 (관리자, profile id 기준)" })
  @ApiResponse({ status: 200, type: AdminUserDto })
  @ApiResponse({ status: 401, description: "인증 필요" })
  @ApiResponse({ status: 403, description: "관리자 권한 없음" })
  @ApiResponse({ status: 404, description: "사용자를 찾을 수 없음" })
  getUser(@Param("id") id: string) {
    return this.service.getAdminUser(id);
  }

  @Delete(":id")
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary:
      "사용자 삭제/보관 (soft delete). 물리 삭제 없이 archive 처리하여 공개/앱 노출을 차단하고 연결 데이터는 보존합니다. 복구 가능.",
  })
  @ApiResponse({ status: 200, type: AdminUserDto, description: "보관된 사용자(관리자 뷰)" })
  @ApiResponse({ status: 401, description: "인증 필요" })
  @ApiResponse({ status: 403, description: "관리자 권한 없음" })
  @ApiResponse({ status: 404, description: "사용자를 찾을 수 없음" })
  archiveUser(
    @Param("id") id: string,
    @Body() body: ArchiveUserBodyDto,
    @CurrentUser() actor: User,
    @Req() req: RequestLike,
  ) {
    return this.service.archiveUser({
      id,
      actorUserId: actor.id,
      reason: body?.reason,
      ipAddress: req.ip,
      userAgent: headerValue(req, "user-agent"),
    });
  }

  @Post(":id/restore")
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: "보관된 사용자 복구 (deletedAt 해제 + 재활성화)" })
  @ApiResponse({ status: 200, type: AdminUserDto, description: "복구된 사용자(관리자 뷰)" })
  @ApiResponse({ status: 401, description: "인증 필요" })
  @ApiResponse({ status: 403, description: "관리자 권한 없음" })
  @ApiResponse({ status: 404, description: "사용자를 찾을 수 없음" })
  restoreUser(
    @Param("id") id: string,
    @Body() body: ArchiveUserBodyDto,
    @CurrentUser() actor: User,
    @Req() req: RequestLike,
  ) {
    return this.service.restoreUser({
      id,
      actorUserId: actor.id,
      reason: body?.reason,
      ipAddress: req.ip,
      userAgent: headerValue(req, "user-agent"),
    });
  }
}
