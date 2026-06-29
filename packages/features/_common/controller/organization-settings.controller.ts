import { BetterAuthGuard, CurrentUser, type User } from "@repo/core/nestjs/auth";
import { Body, Controller, Delete, Get, Param, Patch, Post, UseGuards } from "@nestjs/common";
import {
  ApiBearerAuth,
  ApiExtraModels,
  ApiOperation,
  ApiParam,
  ApiResponse,
  ApiTags,
  getSchemaPath,
} from "@nestjs/swagger";
import { OrganizationSettingsService } from "../service";
import {
  CommonSuccessResponseDto,
  ConfirmUploadDto,
  OrganizationMembershipResponseDto,
  OrganizationMembersResponseDto,
  OrganizationMetadataResponseDto,
  UpdateBillingEmailDto,
  UpdateOrganizationSettingsDto,
  UploadUrlRequestDto,
  UploadUrlResponseDto,
} from "../dto";

@ApiTags("Organization Settings")
@ApiExtraModels(OrganizationMembershipResponseDto)
@Controller("organization-settings")
@UseGuards(BetterAuthGuard)
@ApiBearerAuth()
export class OrganizationSettingsController {
  constructor(private readonly organizationSettingsService: OrganizationSettingsService) {}

  @Patch(":organizationId")
  @ApiOperation({ summary: "조직 설정 변경" })
  @ApiParam({ name: "organizationId", description: "조직 ID" })
  @ApiResponse({ status: 200, description: "변경 결과", type: CommonSuccessResponseDto })
  update(
    @CurrentUser() user: User,
    @Param("organizationId") organizationId: string,
    @Body() dto: UpdateOrganizationSettingsDto,
  ) {
    return this.organizationSettingsService.update(user.id, organizationId, dto);
  }

  @Post(":organizationId/logo/upload-url")
  @ApiOperation({ summary: "조직 로고 업로드 URL 발급" })
  @ApiParam({ name: "organizationId", description: "조직 ID" })
  @ApiResponse({ status: 201, description: "업로드 URL", type: UploadUrlResponseDto })
  getLogoUploadUrl(
    @CurrentUser() user: User,
    @Param("organizationId") organizationId: string,
    @Body() dto: UploadUrlRequestDto,
  ) {
    return this.organizationSettingsService.getLogoUploadUrl(user.id, organizationId, dto);
  }

  @Post(":organizationId/logo/confirm")
  @ApiOperation({ summary: "조직 로고 업로드 확정" })
  @ApiParam({ name: "organizationId", description: "조직 ID" })
  @ApiResponse({ status: 201, description: "확정 결과", type: CommonSuccessResponseDto })
  confirmLogoUpload(
    @CurrentUser() user: User,
    @Param("organizationId") organizationId: string,
    @Body() dto: ConfirmUploadDto,
  ) {
    return this.organizationSettingsService.confirmLogoUpload(
      user.id,
      organizationId,
      dto.publicUrl,
    );
  }

  @Get(":organizationId/metadata")
  @ApiOperation({ summary: "조직 메타데이터 조회" })
  @ApiParam({ name: "organizationId", description: "조직 ID" })
  @ApiResponse({
    status: 200,
    description: "조직 메타데이터",
    type: OrganizationMetadataResponseDto,
  })
  getMetadata(@CurrentUser() user: User, @Param("organizationId") organizationId: string) {
    return this.organizationSettingsService.getMetadata(user.id, organizationId);
  }

  @Patch(":organizationId/billing-email")
  @ApiOperation({ summary: "조직 청구 이메일 변경" })
  @ApiParam({ name: "organizationId", description: "조직 ID" })
  @ApiResponse({ status: 200, description: "변경 결과", type: CommonSuccessResponseDto })
  updateBillingEmail(
    @CurrentUser() user: User,
    @Param("organizationId") organizationId: string,
    @Body() dto: UpdateBillingEmailDto,
  ) {
    return this.organizationSettingsService.updateBillingEmail(
      user.id,
      organizationId,
      dto.billingEmail,
    );
  }

  @Delete(":organizationId")
  @ApiOperation({ summary: "조직 삭제 표시" })
  @ApiParam({ name: "organizationId", description: "조직 ID" })
  @ApiResponse({ status: 200, description: "삭제 표시 결과", type: CommonSuccessResponseDto })
  deleteOrganization(@CurrentUser() user: User, @Param("organizationId") organizationId: string) {
    return this.organizationSettingsService.deleteOrganization(user.id, organizationId);
  }

  @Get(":organizationId/membership")
  @ApiOperation({ summary: "내 조직 멤버십 조회" })
  @ApiParam({ name: "organizationId", description: "조직 ID" })
  @ApiResponse({
    status: 200,
    description: "멤버십. 멤버가 아니면 null",
    schema: {
      nullable: true,
      allOf: [{ $ref: getSchemaPath(OrganizationMembershipResponseDto) }],
    },
  })
  getMyMembership(@CurrentUser() user: User, @Param("organizationId") organizationId: string) {
    return this.organizationSettingsService.getMyMembership(user.id, organizationId);
  }

  @Get(":organizationId/members")
  @ApiOperation({ summary: "조직 멤버 목록 조회" })
  @ApiParam({ name: "organizationId", description: "조직 ID" })
  @ApiResponse({ status: 200, description: "조직 멤버 목록", type: OrganizationMembersResponseDto })
  listMembers(@CurrentUser() user: User, @Param("organizationId") organizationId: string) {
    return this.organizationSettingsService.listMembers(user.id, organizationId);
  }
}
