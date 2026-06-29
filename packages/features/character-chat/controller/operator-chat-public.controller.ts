import { Body, Controller, Post, Put } from "@nestjs/common";
import { ApiOperation, ApiResponse, ApiTags } from "@nestjs/swagger";
import { ThreadService } from "../service/thread.service";
import {
  SaveAssistantMessageDto,
  UpsertAssistantMessageDto,
  upsertAssistantMessageOpenApiSchema,
} from "./character-chat.dto";

@ApiTags("Operator Chat")
@Controller("operator-chat")
export class OperatorChatPublicController {
  constructor(private readonly threadService: ThreadService) {}

  @Post("chat-sessions/assistant/save")
  @ApiOperation({ summary: "AI Runtime 오퍼레이터 최종 메시지 저장" })
  @ApiResponse({ status: 201, description: "assistant 메시지 저장 완료" })
  saveAssistant(@Body() dto: SaveAssistantMessageDto) {
    const { streamToken: _streamToken, ...input } = dto;
    return this.threadService.saveAssistantMessage(input);
  }

  @Put("chat-sessions/assistant/upsert")
  @ApiOperation({ summary: "AI Runtime 오퍼레이터 streaming 메시지 upsert" })
  @ApiResponse({
    status: 200,
    description: "assistant 메시지 upsert 결과",
    schema: upsertAssistantMessageOpenApiSchema,
  })
  upsertAssistant(@Body() dto: UpsertAssistantMessageDto) {
    const { streamToken: _streamToken, ...input } = dto;
    return this.threadService.upsertAssistantMessage(input);
  }
}
