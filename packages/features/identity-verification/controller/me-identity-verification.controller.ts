import type { User } from "@repo/core/nestjs/auth";
import { BetterAuthGuard, CurrentUser } from "@repo/core/nestjs/auth";
import { Controller, Get, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from "@nestjs/swagger";
import { identityVerificationUserStatusOpenApiSchema } from "../dto";
import { IdentityVerificationService } from "../service";

/**
 * Current user's identity-verification status (PB-IDV-KCB-API-STATUS-001).
 * Deliberately mounted at /me/identity-verification (not under the provider-specific
 * /identity-verifications/kcb prefix): this is the provider-agnostic, user-facing status
 * surface. It returns a coarse status + friendly message + protected-action resume
 * context, never raw provider/failure codes (those live on the admin controller).
 */
@ApiTags("Identity Verification")
@Controller("me/identity-verification")
@UseGuards(BetterAuthGuard)
@ApiBearerAuth()
export class MeIdentityVerificationController {
  constructor(private readonly service: IdentityVerificationService) {}

  @Get()
  @ApiOperation({
    summary: "현재 user의 본인확인 상태 (완료/필요/진행중/실패/만료) 및 재시도/복귀 컨텍스트",
  })
  @ApiResponse({
    status: 200,
    description: "사용자 본인확인 상태",
    schema: identityVerificationUserStatusOpenApiSchema,
  })
  getStatus(@CurrentUser() user: User) {
    return this.service.getUserStatus(user.id);
  }
}
