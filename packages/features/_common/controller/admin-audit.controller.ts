import { Controller, Get, Query, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiOperation, ApiQuery, ApiResponse, ApiTags } from "@nestjs/swagger";
import { BetterAuthAdminGuard, BetterAuthGuard } from "@repo/core/nestjs/auth";
import { AdminAuditListResponseDto } from "../dto";
import { AdminAuditService } from "../service";

/**
 * Admin audit log viewer endpoint (read-only).
 *
 * Surfaces the general `admin_audit_log` trail for the admin shell so
 * operators can review privileged changes (PB-ADMIN-001 / AC: "관리자 변경
 * 작업이 감사 로그에 남는다"). Append-only — there is no write endpoint here;
 * rows are written by the services that perform the underlying mutations.
 */
@ApiTags("Admin Audit")
@Controller("admin/audit-logs")
@UseGuards(BetterAuthGuard, BetterAuthAdminGuard)
@ApiBearerAuth()
export class AdminAuditController {
  constructor(private readonly adminAuditService: AdminAuditService) {}

  @Get()
  @ApiOperation({ summary: "관리자 감사 로그 조회 (cursor 페이지네이션)" })
  @ApiQuery({ name: "action", required: false, type: String })
  @ApiQuery({ name: "actorUserId", required: false, type: String })
  @ApiQuery({ name: "targetType", required: false, type: String })
  @ApiQuery({ name: "targetId", required: false, type: String })
  @ApiQuery({ name: "cursor", required: false, type: String })
  @ApiQuery({ name: "limit", required: false, type: Number })
  @ApiResponse({ status: 200, type: AdminAuditListResponseDto })
  list(
    @Query("action") action?: string,
    @Query("actorUserId") actorUserId?: string,
    @Query("targetType") targetType?: string,
    @Query("targetId") targetId?: string,
    @Query("cursor") cursor?: string,
    @Query("limit") limit?: string,
  ): Promise<AdminAuditListResponseDto> {
    const parsedLimit = limit ? Number.parseInt(limit, 10) : undefined;
    return this.adminAuditService.list({
      action: action || undefined,
      actorUserId: actorUserId || undefined,
      targetType: targetType || undefined,
      targetId: targetId || undefined,
      cursor: cursor || undefined,
      limit: Number.isFinite(parsedLimit) ? parsedLimit : undefined,
    });
  }
}
