import { Body, Controller, Get, HttpCode, Post, Put, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags, getSchemaPath } from "@nestjs/swagger";
import type { User } from "@repo/core/nestjs/auth";
import { BetterAuthGuard, CurrentUser } from "@repo/core/nestjs/auth";
import { OnboardingService } from "../service/onboarding.service";
import { OnboardingResponseDto, UpdateStepDto } from "../dto";

@ApiTags("Onboarding")
@Controller("onboarding")
export class OnboardingController {
  constructor(private readonly onboardingService: OnboardingService) {}

  @Get("status")
  @UseGuards(BetterAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: "온보딩 상태 조회" })
  @ApiResponse({
    status: 200,
    description: "온보딩 상태 반환 (온보딩 행 없으면 null)",
    schema: { nullable: true, allOf: [{ $ref: getSchemaPath(OnboardingResponseDto) }] },
  })
  async getStatus(@CurrentUser() user: User) {
    return this.onboardingService.getStatus(user.id);
  }

  @Put("step")
  @UseGuards(BetterAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: "온보딩 스텝 업데이트" })
  @ApiResponse({ status: 200, description: "업데이트된 온보딩 상태", type: OnboardingResponseDto })
  async updateStep(@CurrentUser() user: User, @Body() dto: UpdateStepDto) {
    return this.onboardingService.updateStep(user.id, dto);
  }

  @Post("complete")
  @HttpCode(200)
  @UseGuards(BetterAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: "온보딩 완료" })
  @ApiResponse({ status: 200, description: "완료된 온보딩 상태", type: OnboardingResponseDto })
  async complete(@CurrentUser() user: User) {
    return this.onboardingService.complete(user.id);
  }
}
