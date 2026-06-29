import { createZodDto } from "@repo/shared/zod-nestjs";
import { z } from "zod";

const providerPayloadSchema = z.record(z.unknown()).optional();

export const solapiMessageSchema = z.object({
  to: z.string().min(1).max(32),
  from: z.string().min(1).max(32).optional(),
  text: z.string().min(1).max(2000),
  type: z.string().min(1).max(32).optional(),
  country: z.string().min(1).max(8).optional(),
  subject: z.string().max(120).optional(),
  payload: providerPayloadSchema,
});

export const sendSolapiMessagesSchema = z.object({
  from: z.string().min(1).max(32).optional(),
  messages: z.array(solapiMessageSchema).min(1).max(1000),
  allowDuplicates: z.boolean().optional(),
  scheduledDate: z.string().datetime().optional(),
  idempotencyKey: z.string().min(1).max(200).optional(),
  metadata: providerPayloadSchema,
});

export const listMessageSendingRequestsQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  status: z.enum(["pending", "sent", "partial", "failed"]).optional(),
});

export class SendSolapiMessagesDto extends createZodDto(sendSolapiMessagesSchema) {}

export type SendSolapiMessagesInput = z.infer<typeof sendSolapiMessagesSchema>;
export type SolapiMessageInput = z.infer<typeof solapiMessageSchema>;
export type ListMessageSendingRequestsQuery = z.infer<typeof listMessageSendingRequestsQuerySchema>;

export const sendSolapiMessagesOpenApiSchema = {
  type: "object",
  required: ["messages"],
  properties: {
    from: { type: "string", description: "기본 발신번호. 생략 시 SOLAPI_DEFAULT_SENDER 사용" },
    idempotencyKey: { type: "string", description: "중복 발송 방지 키" },
    allowDuplicates: { type: "boolean" },
    scheduledDate: { type: "string", format: "date-time" },
    metadata: { type: "object", additionalProperties: true },
    messages: {
      type: "array",
      minItems: 1,
      maxItems: 1000,
      items: {
        type: "object",
        required: ["to", "text"],
        properties: {
          to: { type: "string" },
          from: { type: "string" },
          text: { type: "string" },
          type: { type: "string", description: "SOLAPI message type" },
          country: { type: "string", default: "82" },
          subject: { type: "string" },
          payload: { type: "object", additionalProperties: true },
        },
      },
    },
  },
};
