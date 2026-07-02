import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Param,
  Post,
  Query,
  Req,
  UseGuards,
} from "@nestjs/common";
import { ApiBearerAuth, ApiOperation, ApiQuery, ApiResponse, ApiTags } from "@nestjs/swagger";
import {
  BetterAuthAdminGuard,
  BetterAuthGuard,
  CurrentUser,
  type User,
} from "@repo/core/nestjs/auth";
import { z } from "zod";
import {
  InvitationListResponseDto,
  InvitationResponseDto,
  InviteUserBodyDto,
  ResendInvitationBodyDto,
} from "../dto";
import { AdminUserInviteService } from "../service";

interface RequestLike {
  ip?: string;
  headers?: Record<string, string | string[] | undefined>;
}

function headerValue(req: RequestLike, name: string): string | undefined {
  const raw = req.headers?.[name];
  if (Array.isArray(raw)) return raw[0];
  return typeof raw === "string" ? raw : undefined;
}

const inviteSchema = z.object({
  email: z.string().trim().min(1),
  role: z.enum(["admin", "member"]),
  reason: z.string().trim().max(500).optional(),
});

const resendSchema = z.object({
  reason: z.string().trim().max(500).optional(),
});

/**
 * 운영자 초대 API — 관리자 티어 (PB-ADMIN-USERS-CREATE-001 / BBR-687).
 *
 * Exposed as a sibling resource to `admin/users` so the literal `invitations`
 * path never shadows the `admin/users/:id` detail route. Gated by
 * BetterAuthGuard then BetterAuthAdminGuard (owner/admin). Duplicate email and
 * invalid role are rejected before persistence; every invite/resend is audited.
 */
@ApiTags("Admin Users")
@Controller("admin/user-invitations")
@UseGuards(BetterAuthGuard, BetterAuthAdminGuard)
@ApiBearerAuth()
export class AdminUserInviteController {
  constructor(private readonly inviteService: AdminUserInviteService) {}

  @Post()
  @ApiOperation({
    summary:
      "운영자 초대 생성. 중복 이메일/잘못된 role은 차단되고 초대 작업은 감사 로그에 남습니다.",
  })
  @ApiResponse({ status: 201, type: InvitationResponseDto })
  @ApiResponse({ status: 400, description: "잘못된 이메일 또는 role" })
  @ApiResponse({ status: 409, description: "이미 가입/초대된 이메일" })
  invite(
    @Body() body: InviteUserBodyDto,
    @CurrentUser() actor: User,
    @Req() req: RequestLike,
  ): Promise<InvitationResponseDto> {
    const parsed = inviteSchema.safeParse(body ?? {});
    if (!parsed.success) {
      throw new BadRequestException("요청 값이 올바르지 않습니다.");
    }
    return this.inviteService.invite({
      actorUserId: actor.id,
      email: parsed.data.email,
      role: parsed.data.role,
      reason: parsed.data.reason,
      ipAddress: req.ip,
      userAgent: headerValue(req, "user-agent"),
    });
  }

  @Get()
  @ApiOperation({ summary: "초대 목록 조회 (조직 범위)" })
  @ApiQuery({
    name: "status",
    required: false,
    description: "상태 필터 (예: pending). 생략 시 전체",
  })
  @ApiResponse({ status: 200, type: InvitationListResponseDto })
  async list(
    @CurrentUser() actor: User,
    @Query("status") status?: string,
  ): Promise<InvitationListResponseDto> {
    const invitations = await this.inviteService.listInvitations({
      actorUserId: actor.id,
      status: status?.trim() || undefined,
    });
    return { invitations };
  }

  @Post(":id/resend")
  @ApiOperation({ summary: "대기 중인 초대 재발송 (만료 연장 + 메일 재발송, 감사 기록)" })
  @ApiResponse({ status: 201, type: InvitationResponseDto })
  @ApiResponse({ status: 404, description: "초대를 찾을 수 없음" })
  @ApiResponse({ status: 409, description: "대기 중이 아닌 초대" })
  resend(
    @Param("id") invitationId: string,
    @Body() body: ResendInvitationBodyDto,
    @CurrentUser() actor: User,
    @Req() req: RequestLike,
  ): Promise<InvitationResponseDto> {
    const parsed = resendSchema.safeParse(body ?? {});
    if (!parsed.success) {
      throw new BadRequestException("요청 값이 올바르지 않습니다.");
    }
    return this.inviteService.resend({
      actorUserId: actor.id,
      invitationId,
      reason: parsed.data.reason,
      ipAddress: req.ip,
      userAgent: headerValue(req, "user-agent"),
    });
  }
}
