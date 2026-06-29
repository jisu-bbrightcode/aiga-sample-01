import {
  BetterAuthAdminGuard,
  BetterAuthGuard,
  CurrentUser,
  type User,
} from "@repo/core/nestjs/auth";
import {
  Body,
  Controller,
  DefaultValuePipe,
  Get,
  Headers,
  HttpCode,
  Inject,
  Param,
  ParseIntPipe,
  ParseUUIDPipe,
  Post,
  Query,
  UnauthorizedException,
  UseGuards,
} from "@nestjs/common";
import {
  ApiBearerAuth,
  ApiBody,
  ApiOperation,
  ApiParam,
  ApiQuery,
  ApiResponse,
  ApiTags,
} from "@nestjs/swagger";
import type { SolapiConfig } from "../config/solapi.config";
import {
  type ListMessageSendingRequestsQuery,
  listMessageSendingRequestsQuerySchema,
  SendSolapiMessagesDto,
  sendSolapiMessagesOpenApiSchema,
} from "../dto";
import { MessageSendingService } from "../service";
import { verifySolapiWebhookSecret } from "../webhook/solapi.webhook";

@ApiTags("Message Sending")
@Controller()
export class MessageSendingController {
  constructor(
    private readonly service: MessageSendingService,
    @Inject("SOLAPI_CONFIG")
    private readonly solapiConfig: SolapiConfig,
  ) {}

  @Post("message-sending/solapi/messages")
  @ApiBearerAuth()
  @UseGuards(BetterAuthGuard, BetterAuthAdminGuard)
  @ApiOperation({ summary: "[Admin] SOLAPI 메시지 발송" })
  @ApiBody({ schema: sendSolapiMessagesOpenApiSchema })
  @ApiResponse({ status: 201, description: "발송 요청 생성 및 SOLAPI 접수 결과 반환" })
  send(@Body() dto: SendSolapiMessagesDto, @CurrentUser() user: User) {
    return this.service.sendSolapiMessages(dto, user.id);
  }

  @Get("admin/message-sending/requests")
  @ApiBearerAuth()
  @UseGuards(BetterAuthGuard, BetterAuthAdminGuard)
  @ApiOperation({ summary: "[Admin] 메시지 발송 요청 목록 조회" })
  @ApiQuery({ name: "page", required: false, type: Number })
  @ApiQuery({ name: "limit", required: false, type: Number })
  @ApiQuery({ name: "status", required: false, type: String })
  @ApiResponse({ status: 200, description: "메시지 발송 요청 목록 반환" })
  listRequests(
    @Query("page", new DefaultValuePipe(1), ParseIntPipe) page: number,
    @Query("limit", new DefaultValuePipe(20), ParseIntPipe) limit: number,
    @Query("status") status?: string,
  ) {
    const query: ListMessageSendingRequestsQuery = listMessageSendingRequestsQuerySchema.parse({
      page,
      limit,
      status,
    });
    return this.service.listRequests(query);
  }

  @Get("admin/message-sending/requests/:requestId")
  @ApiBearerAuth()
  @UseGuards(BetterAuthGuard, BetterAuthAdminGuard)
  @ApiOperation({ summary: "[Admin] 메시지 발송 요청 상세 조회" })
  @ApiParam({ name: "requestId", description: "발송 요청 ID" })
  @ApiResponse({ status: 200, description: "메시지 발송 요청 상세 반환" })
  getRequest(@Param("requestId", ParseUUIDPipe) requestId: string) {
    return this.service.getRequest(requestId);
  }

  @Post("webhooks/solapi")
  @HttpCode(200)
  @ApiOperation({ summary: "SOLAPI 메시지 상태 웹훅 수신" })
  @ApiResponse({ status: 200, description: "웹훅 수신 처리 결과" })
  ingestWebhook(
    @Headers("x-solapi-secret") secret: string | string[] | undefined,
    @Body() body: unknown,
  ) {
    if (
      !verifySolapiWebhookSecret({
        configuredSecret: this.solapiConfig.webhookSecret,
        headerSecret: secret,
      })
    ) {
      throw new UnauthorizedException("Invalid SOLAPI webhook secret");
    }
    return this.service.ingestSolapiWebhook(body);
  }
}
