import { BetterAuthAdminGuard, BetterAuthGuard } from "@repo/core/nestjs/auth";
import { Controller, Get, Param, ParseUUIDPipe, Query, UseGuards } from "@nestjs/common";
import {
  ApiBearerAuth,
  ApiOperation,
  ApiParam,
  ApiQuery,
  ApiResponse,
  ApiTags,
} from "@nestjs/swagger";
import { identityVerificationSessionOpenApiSchema, kcbHealthOpenApiSchema } from "../dto";
import { IdentityVerificationService } from "../service";

@ApiTags("Admin Identity Verification")
@Controller("admin/identity-verifications")
@UseGuards(BetterAuthGuard, BetterAuthAdminGuard)
@ApiBearerAuth()
export class IdentityVerificationAdminController {
  constructor(private readonly service: IdentityVerificationService) {}

  @Get()
  @ApiOperation({ summary: "본인확인 요청 이력 목록 조회" })
  @ApiQuery({ name: "limit", required: false, type: Number })
  @ApiResponse({
    status: 200,
    description: "본인확인 요청 이력 목록",
    schema: { type: "array", items: identityVerificationSessionOpenApiSchema },
  })
  list(@Query("limit") limit?: string) {
    return this.service.listAdmin(limit ? Number.parseInt(limit, 10) : 50);
  }

  @Get("kcb/health")
  @ApiOperation({ summary: "KCB Java adapter/JAR/license/native 상태 조회" })
  @ApiResponse({
    status: 200,
    description: "KCB adapter health",
    schema: kcbHealthOpenApiSchema,
  })
  health() {
    return this.service.health();
  }

  @Get(":id")
  @ApiOperation({ summary: "본인확인 요청 상세 (검증 결과 포함)" })
  @ApiParam({ name: "id", description: "본인확인 요청 ID" })
  get(@Param("id", ParseUUIDPipe) id: string) {
    return this.service.getAdmin(id);
  }
}
