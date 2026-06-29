import { BetterAuthGuard, CurrentUser, type User } from "@repo/core/nestjs/auth";
import { Body, Controller, Get, Param, Patch, Post, UseGuards } from "@nestjs/common";
import {
  ApiBearerAuth,
  ApiExtraModels,
  ApiOperation,
  ApiParam,
  ApiResponse,
  ApiTags,
  getSchemaPath,
} from "@nestjs/swagger";
import { UserProfileService } from "../service";
import {
  CommonSuccessResponseDto,
  ConfirmUploadDto,
  HandleAvailabilityResponseDto,
  UpdateBioDto,
  UpdateHandleDto,
  UpdateProfileNameDto,
  UploadUrlRequestDto,
  UploadUrlResponseDto,
  UserProfileResponseDto,
} from "../dto";

@ApiTags("User Profile")
@ApiExtraModels(UserProfileResponseDto)
@Controller("user-profile")
@UseGuards(BetterAuthGuard)
@ApiBearerAuth()
export class UserProfileController {
  constructor(private readonly userProfileService: UserProfileService) {}

  @Get("me")
  @ApiOperation({ summary: "내 프로필 조회" })
  @ApiResponse({
    status: 200,
    description: "내 프로필. 프로필 행이 없으면 null",
    schema: { nullable: true, allOf: [{ $ref: getSchemaPath(UserProfileResponseDto) }] },
  })
  me(@CurrentUser() user: User) {
    return this.userProfileService.me(user.id);
  }

  @Patch("name")
  @ApiOperation({ summary: "내 이름 변경" })
  @ApiResponse({ status: 200, description: "변경 결과", type: CommonSuccessResponseDto })
  updateName(@CurrentUser() user: User, @Body() dto: UpdateProfileNameDto) {
    return this.userProfileService.updateName(user.id, dto.name);
  }

  @Post("avatar/upload-url")
  @ApiOperation({ summary: "아바타 업로드 URL 발급" })
  @ApiResponse({ status: 201, description: "업로드 URL", type: UploadUrlResponseDto })
  getAvatarUploadUrl(@CurrentUser() user: User, @Body() dto: UploadUrlRequestDto) {
    return this.userProfileService.getAvatarUploadUrl(user.id, dto);
  }

  @Post("avatar/confirm")
  @ApiOperation({ summary: "아바타 업로드 확정" })
  @ApiResponse({ status: 201, description: "확정 결과", type: CommonSuccessResponseDto })
  confirmAvatarUpload(@CurrentUser() user: User, @Body() dto: ConfirmUploadDto) {
    return this.userProfileService.confirmAvatarUpload(user.id, dto.publicUrl);
  }

  @Get("handles/:handle/availability")
  @ApiOperation({ summary: "핸들 사용 가능 여부 조회" })
  @ApiParam({ name: "handle", description: "핸들" })
  @ApiResponse({
    status: 200,
    description: "핸들 사용 가능 여부",
    type: HandleAvailabilityResponseDto,
  })
  checkHandle(@CurrentUser() user: User, @Param("handle") handle: string) {
    return this.userProfileService.checkHandle(user.id, handle);
  }

  @Patch("handle")
  @ApiOperation({ summary: "핸들 변경" })
  @ApiResponse({ status: 200, description: "변경 결과", type: CommonSuccessResponseDto })
  updateHandle(@CurrentUser() user: User, @Body() dto: UpdateHandleDto) {
    return this.userProfileService.updateHandle(user.id, dto.handle);
  }

  @Patch("bio")
  @ApiOperation({ summary: "소개 변경" })
  @ApiResponse({ status: 200, description: "변경 결과", type: CommonSuccessResponseDto })
  updateBio(@CurrentUser() user: User, @Body() dto: UpdateBioDto) {
    return this.userProfileService.updateBio(user.id, dto.bio);
  }
}
