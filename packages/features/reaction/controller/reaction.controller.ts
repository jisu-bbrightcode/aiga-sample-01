/**
 * Reaction Feature - REST Controller
 *
 * REST endpoints matching tRPC procedures 1:1.
 * - Public: getCounts, getCountsBatch
 * - Auth: toggle, remove, getUserStatus, getUserStatusBatch
 */

import {
  Body,
  Controller,
  Delete,
  Get,
  ParseUUIDPipe,
  Post,
  Query,
  UseGuards,
} from "@nestjs/common";
import {
  ApiBearerAuth,
  ApiBody,
  ApiExtraModels,
  ApiOperation,
  ApiQuery,
  ApiResponse,
  ApiTags,
  getSchemaPath,
} from "@nestjs/swagger";
import type { User } from "@repo/core/nestjs/auth";
import { BetterAuthGuard, CurrentUser } from "@repo/core/nestjs/auth";
import type { ReactionType } from "../../common/types";
import {
  ReactionCountsDto,
  RemoveReactionResponseDto,
  ToggleReactionResponseDto,
  UserReactionStatusDto,
} from "../dto";
import { ReactionService } from "../service/reaction.service";

@ApiTags("Reaction")
@ApiExtraModels(
  ReactionCountsDto,
  RemoveReactionResponseDto,
  ToggleReactionResponseDto,
  UserReactionStatusDto,
)
@Controller("reaction")
export class ReactionController {
  constructor(private readonly reactionService: ReactionService) {}

  // ============================================================================
  // Public Endpoints
  // ============================================================================

  @Get("counts")
  @ApiOperation({ summary: "Get reaction counts" })
  @ApiQuery({
    name: "targetType",
    required: true,
    description: "Target entity type (e.g., board_post, product)",
  })
  @ApiQuery({ name: "targetId", required: true, description: "Target entity ID (UUID)" })
  @ApiResponse({
    status: 200,
    description: "Returns reaction counts by type",
    type: ReactionCountsDto,
  })
  async getCounts(
    @Query("targetType") targetType: string,
    @Query("targetId", ParseUUIDPipe) targetId: string,
  ) {
    return this.reactionService.getReactionCounts(targetType, targetId);
  }

  @Post("counts/batch")
  @ApiOperation({ summary: "Get reaction counts for multiple targets" })
  @ApiBody({
    schema: {
      type: "object",
      properties: {
        targetType: { type: "string", description: "Target entity type" },
        targetIds: {
          type: "array",
          items: { type: "string", format: "uuid" },
          description: "Target entity IDs",
        },
      },
      required: ["targetType", "targetIds"],
    },
  })
  @ApiResponse({
    status: 200,
    description: "Returns reaction counts map by target",
    schema: {
      type: "object",
      additionalProperties: { $ref: getSchemaPath(ReactionCountsDto) },
    },
  })
  async getCountsBatch(@Body() body: { targetType: string; targetIds: string[] }) {
    const result = await this.reactionService.getReactionCountsBatch(
      body.targetType,
      body.targetIds,
    );
    return Object.fromEntries(result);
  }

  // ============================================================================
  // Auth Endpoints
  // ============================================================================

  @Post("toggle")
  @UseGuards(BetterAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: "Toggle reaction (add/remove)" })
  @ApiBody({
    schema: {
      type: "object",
      properties: {
        targetType: { type: "string", description: "Target entity type" },
        targetId: { type: "string", format: "uuid", description: "Target entity ID" },
        type: {
          type: "string",
          enum: ["like", "love", "haha", "wow", "sad", "angry"],
          description: "Reaction type (default: like)",
        },
      },
      required: ["targetType", "targetId"],
    },
  })
  @ApiResponse({
    status: 200,
    description: "Toggle result (added: true/false)",
    type: ToggleReactionResponseDto,
  })
  @ApiResponse({ status: 401, description: "Authentication required" })
  async toggle(
    @CurrentUser() user: User,
    @Body() body: { targetType: string; targetId: string; type?: ReactionType },
  ) {
    return this.reactionService.toggle(
      body.targetType,
      body.targetId,
      user.id,
      body.type || "like",
    );
  }

  @Delete()
  @UseGuards(BetterAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({
    summary: "Remove (cancel) the current user's reaction — idempotent",
    description:
      "Deletes the authenticated user's reaction on a target. Scoped to the " +
      "caller, so it can never affect another user's reaction. Safe to call " +
      "repeatedly: a no-op delete returns removed=false with unchanged counts.",
  })
  @ApiQuery({ name: "targetType", required: true, description: "Target entity type" })
  @ApiQuery({ name: "targetId", required: true, description: "Target entity ID (UUID)" })
  @ApiQuery({
    name: "type",
    required: false,
    enum: ["like", "love", "haha", "wow", "sad", "angry"],
    description:
      "Reaction type to remove. Omit to remove all of the user's reactions on the target.",
  })
  @ApiResponse({
    status: 200,
    description: "Idempotent removal result with fresh derived counts",
    type: RemoveReactionResponseDto,
  })
  @ApiResponse({ status: 401, description: "Authentication required" })
  async remove(
    @CurrentUser() user: User,
    @Query("targetType") targetType: string,
    @Query("targetId", ParseUUIDPipe) targetId: string,
    @Query("type") type?: ReactionType,
  ) {
    return this.reactionService.remove(targetType, targetId, user.id, type);
  }

  @Get("user-status")
  @UseGuards(BetterAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: "Get user reaction status" })
  @ApiQuery({ name: "targetType", required: true, description: "Target entity type" })
  @ApiQuery({ name: "targetId", required: true, description: "Target entity ID (UUID)" })
  @ApiResponse({
    status: 200,
    description: "Returns user reaction status",
    type: UserReactionStatusDto,
  })
  @ApiResponse({ status: 401, description: "Authentication required" })
  async getUserStatus(
    @CurrentUser() user: User,
    @Query("targetType") targetType: string,
    @Query("targetId", ParseUUIDPipe) targetId: string,
  ) {
    return this.reactionService.getUserReactionStatus(targetType, targetId, user.id);
  }

  @Post("user-status/batch")
  @UseGuards(BetterAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: "Get user reaction status for multiple targets" })
  @ApiBody({
    schema: {
      type: "object",
      properties: {
        targetType: { type: "string", description: "Target entity type" },
        targetIds: {
          type: "array",
          items: { type: "string", format: "uuid" },
          description: "Target entity IDs",
        },
      },
      required: ["targetType", "targetIds"],
    },
  })
  @ApiResponse({
    status: 200,
    description: "Returns user reaction status map by target",
    schema: {
      type: "object",
      additionalProperties: { $ref: getSchemaPath(UserReactionStatusDto) },
    },
  })
  @ApiResponse({ status: 401, description: "Authentication required" })
  async getUserStatusBatch(
    @CurrentUser() user: User,
    @Body() body: { targetType: string; targetIds: string[] },
  ) {
    const result = await this.reactionService.getUserReactionStatusBatch(
      body.targetType,
      body.targetIds,
      user.id,
    );
    return Object.fromEntries(result);
  }
}
