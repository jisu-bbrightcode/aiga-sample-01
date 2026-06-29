import { createZodDto } from "@repo/shared/zod-nestjs";
import { z } from "zod";

export const prepareActorSchema = z.object({
  projectId: z.string().uuid(),
  characterId: z.string().uuid(),
});

export class PrepareCharacterActorDto extends createZodDto(prepareActorSchema) {}

export const chatListHideSchema = z.object({
  projectId: z.string().uuid(),
  actorId: z.string().uuid(),
});

export class HideCharacterChatListItemDto extends createZodDto(chatListHideSchema) {}

export const chatListShowSchema = z.object({
  actorId: z.string().uuid(),
});

export class ShowCharacterChatListItemDto extends createZodDto(chatListShowSchema) {}

export const chatListSetLastOpenedSchema = z.object({
  projectId: z.string().uuid(),
  actorId: z.string().uuid(),
  threadId: z.string().uuid(),
});

export class SetCharacterChatLastOpenedDto extends createZodDto(chatListSetLastOpenedSchema) {}

export const createThreadSchema = z.object({
  projectId: z.string().uuid(),
  characterId: z.string().uuid(),
  actorId: z.string().uuid(),
  title: z.string().optional(),
});

export class CreateCharacterChatThreadDto extends createZodDto(createThreadSchema) {}

export const createChatSessionSchema = z.object({
  projectId: z.string().uuid(),
  characterId: z.string().uuid(),
  userMessage: z.string().min(1).max(4000),
});

export class CreateCharacterChatSessionDto extends createZodDto(createChatSessionSchema) {}

export const saveAssistantMessageSchema = z.object({
  threadId: z.string().uuid(),
  content: z.string(),
  status: z.enum(["completed", "failed", "interrupted"]),
  tokenUsage: z.record(z.unknown()).optional(),
  streamToken: z.string().optional(),
});

export class SaveAssistantMessageDto extends createZodDto(saveAssistantMessageSchema) {}

export const upsertAssistantMessageSchema = z.object({
  messageId: z.string().uuid().optional(),
  threadId: z.string().uuid(),
  content: z.string(),
  status: z.enum(["streaming", "completed", "failed", "interrupted"]),
  tokenUsage: z.record(z.unknown()).optional(),
  streamToken: z.string().optional(),
});

export class UpsertAssistantMessageDto extends createZodDto(upsertAssistantMessageSchema) {}

export const characterChatObjectOpenApiSchema = {
  type: "object",
  additionalProperties: true,
};

export const nullableCharacterChatObjectOpenApiSchema = {
  ...characterChatObjectOpenApiSchema,
  nullable: true,
};

export const characterChatObjectListOpenApiSchema = {
  type: "array",
  items: characterChatObjectOpenApiSchema,
};

export const hiddenActorIdsOpenApiSchema = {
  type: "object",
  required: ["actorIds"],
  properties: {
    actorIds: {
      type: "array",
      items: { type: "string", format: "uuid" },
    },
  },
};

export const lastOpenedThreadOpenApiSchema = {
  type: "object",
  required: ["threadId"],
  properties: {
    threadId: { type: "string", format: "uuid", nullable: true },
  },
};

export const chatSessionOpenApiSchema = {
  type: "object",
  required: ["threadId", "userMessageId", "streamToken", "actorSnapshotData"],
  properties: {
    threadId: { type: "string", format: "uuid" },
    userMessageId: { type: "string", format: "uuid" },
    streamToken: { type: "string" },
    actorSnapshotData: characterChatObjectOpenApiSchema,
  },
};

export const upsertAssistantMessageOpenApiSchema = {
  type: "object",
  required: ["id"],
  properties: {
    id: { type: "string", format: "uuid" },
  },
};
