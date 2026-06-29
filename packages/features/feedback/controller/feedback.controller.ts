import { BetterAuthGuard, CurrentUser, type User } from "@repo/core/nestjs/auth";
import { Body, Controller, Post, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from "@nestjs/swagger";
import { submitFeedbackToFeaturebase } from "../service";
import { SubmitFeedbackDto, SubmitFeedbackResponseDto } from "../dto";

@ApiTags("Feedback")
@Controller("feedback")
@UseGuards(BetterAuthGuard)
@ApiBearerAuth()
export class FeedbackController {
  @Post()
  @ApiOperation({ summary: "제품 피드백 제출" })
  @ApiResponse({
    status: 201,
    description: "피드백 제출 결과",
    type: SubmitFeedbackResponseDto,
  })
  submit(@CurrentUser() user: User, @Body() dto: SubmitFeedbackDto) {
    return submitFeedbackToFeaturebase({
      ...dto,
      user: {
        id: user.id,
        email: user.email,
      },
    });
  }
}
