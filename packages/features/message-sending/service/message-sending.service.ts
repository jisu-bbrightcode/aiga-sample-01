import crypto from "node:crypto";
import { DRIZZLE, type DrizzleDB } from "@repo/drizzle";
import {
  type MessageSendingMessageStatus,
  messageSendingMessages,
  messageSendingProviderEvents,
  messageSendingRequests,
} from "@repo/drizzle/schema";
import {
  ConflictException,
  Inject,
  Injectable,
  InternalServerErrorException,
  NotFoundException,
} from "@nestjs/common";
import { and, desc, eq, type SQL } from "drizzle-orm";
import type { SolapiConfig } from "../config/solapi.config";
import type { SendSolapiMessagesInput, SolapiMessageInput } from "../dto";
import {
  SolapiClient,
  SolapiClientError,
  type SolapiMessagePayload,
  type SolapiMessageResult,
  type SolapiSendManyDetailResponse,
} from "../provider/solapi.client";
import {
  buildSolapiEventKey,
  maskPhone,
  maskSolapiPayload,
  normalizeSolapiWebhookPayload,
  type SolapiWebhookEvent,
} from "../webhook/solapi.webhook";

export interface MessageSendingRequestSummary {
  id: string;
  status: string;
  providerGroupId: string | null;
  totalCount: number;
  acceptedCount: number;
  failedCount: number;
}

@Injectable()
export class MessageSendingService {
  constructor(
    @Inject(DRIZZLE) private readonly db: DrizzleDB,
    private readonly solapiClient: SolapiClient,
    private readonly solapiConfig: SolapiConfig,
  ) {}

  async sendSolapiMessages(
    input: SendSolapiMessagesInput,
    actorId?: string,
  ): Promise<MessageSendingRequestSummary> {
    if (input.idempotencyKey) {
      const existing = await this.findRequestByIdempotencyKey(input.idempotencyKey);
      if (existing) return summarizeRequest(existing);
    }

    const sender = input.from ?? this.solapiConfig.defaultSender;
    const pending = await this.createPendingRequestOrFindExisting(input, sender, actorId);
    if ("existing" in pending) return summarizeRequest(pending.existing);

    const { request, messages } = pending;
    const payload = {
      messages: input.messages.map((message, index) =>
        toSolapiPayload(message, sender, messages[index]?.id),
      ),
      allowDuplicates: input.allowDuplicates,
      scheduledDate: input.scheduledDate,
      showMessageList: true,
    };

    try {
      const response = await this.solapiClient.sendManyDetail(payload);
      const providerGroupId = extractGroupId(response);
      const counts = extractCounts(response, input.messages.length);
      await this.markRequestSent(request.id, response, providerGroupId, counts);
      await this.markMessagesAccepted(request.id, response, providerGroupId);
      return {
        id: request.id,
        status: counts.failedCount > 0 ? "partial" : "sent",
        providerGroupId,
        ...counts,
      };
    } catch (error) {
      await this.markRequestFailed(request.id, error, input.messages.length);
      if (error instanceof SolapiClientError) {
        throw new InternalServerErrorException({
          code: "SOLAPI_SEND_FAILED",
          message: "Message send failed. Please try again later.",
        });
      }
      throw error;
    }
  }

  private async createPendingRequestOrFindExisting(
    input: SendSolapiMessagesInput,
    sender: string,
    actorId?: string,
  ) {
    try {
      return await this.createPendingRequest(input, sender, actorId);
    } catch (error) {
      if (!input.idempotencyKey || !isUniqueConstraintViolation(error)) throw error;
      const existing = await this.findRequestByIdempotencyKey(input.idempotencyKey);
      if (existing) return { existing };
      throw error;
    }
  }

  async listRequests(input: { page: number; limit: number; status?: string }) {
    const where: SQL[] = [];
    if (input.status) where.push(eq(messageSendingRequests.status, input.status as never));
    const rows = await this.db
      .select()
      .from(messageSendingRequests)
      .where(where.length > 0 ? and(...where) : undefined)
      .orderBy(desc(messageSendingRequests.createdAt))
      .limit(input.limit)
      .offset((input.page - 1) * input.limit);
    return rows.map(summarizeRequest);
  }

  async getRequest(requestId: string) {
    const [request] = await this.db
      .select()
      .from(messageSendingRequests)
      .where(eq(messageSendingRequests.id, requestId))
      .limit(1);
    if (!request) throw new NotFoundException("Message request not found");
    const messages = await this.db
      .select()
      .from(messageSendingMessages)
      .where(eq(messageSendingMessages.requestId, requestId))
      .orderBy(desc(messageSendingMessages.createdAt));
    return { ...request, messages };
  }

  async ingestSolapiWebhook(payload: unknown) {
    const events = normalizeSolapiWebhookPayload(payload);
    const results: Array<{ eventKey: string; status: "processed" | "ignored" | "failed" }> = [];
    for (const event of events) {
      const eventKey = buildSolapiEventKey(event);
      try {
        const inserted = await this.insertProviderEvent(eventKey, event);
        if (!inserted) {
          results.push({ eventKey, status: "ignored" });
          continue;
        }
        await this.applyProviderEvent(event);
        await this.markProviderEventProcessed(eventKey);
        results.push({ eventKey, status: "processed" });
      } catch (error) {
        await this.markProviderEventFailed(eventKey, error);
        results.push({ eventKey, status: "failed" });
      }
    }
    return {
      received: true,
      processed: results.filter((r) => r.status === "processed").length,
      results,
    };
  }

  private async findRequestByIdempotencyKey(idempotencyKey: string) {
    const [row] = await this.db
      .select()
      .from(messageSendingRequests)
      .where(eq(messageSendingRequests.idempotencyKey, idempotencyKey))
      .limit(1);
    return row;
  }

  private createPendingRequest(input: SendSolapiMessagesInput, sender: string, actorId?: string) {
    return this.db.transaction(async (tx) => {
      const [request] = await tx
        .insert(messageSendingRequests)
        .values({
          actorId,
          idempotencyKey: input.idempotencyKey,
          senderPhone: maskPhone(sender),
          totalCount: input.messages.length,
          metadata: input.metadata,
        })
        .returning();
      if (!request) throw new ConflictException("Message request could not be created");

      const messages = input.messages.map((message) => ({
        id: crypto.randomUUID(),
        requestId: request.id,
        recipientPhone: maskPhone(message.to),
        senderPhone: maskPhone(message.from ?? sender),
        messageType: message.type,
        country: message.country ?? "82",
        subject: message.subject,
        textPreview: previewText(message.text),
        providerPayload: maskSolapiPayload(message.payload ?? {}),
      }));

      await tx.insert(messageSendingMessages).values(messages);
      return { request, messages };
    });
  }

  private async markRequestSent(
    requestId: string,
    response: SolapiSendManyDetailResponse,
    providerGroupId: string | null,
    counts: { totalCount: number; acceptedCount: number; failedCount: number },
  ) {
    await this.db
      .update(messageSendingRequests)
      .set({
        status: counts.failedCount > 0 ? "partial" : "sent",
        providerGroupId,
        totalCount: counts.totalCount,
        acceptedCount: counts.acceptedCount,
        failedCount: counts.failedCount,
        providerResponse: maskSolapiPayload(response),
        sentAt: new Date(),
      })
      .where(eq(messageSendingRequests.id, requestId));
  }

  private async markMessagesAccepted(
    requestId: string,
    response: SolapiSendManyDetailResponse,
    providerGroupId: string | null,
  ) {
    const providerMessages = collectProviderMessageResults(response);
    if (providerMessages.length === 0) {
      await this.db
        .update(messageSendingMessages)
        .set({ status: "accepted", providerGroupId, sentAt: new Date() })
        .where(eq(messageSendingMessages.requestId, requestId));
      return;
    }

    let matchedCount = 0;
    for (const result of providerMessages) {
      const localMessageId = extractProductBuilderMessageId(result.message);
      if (!localMessageId) continue;
      matchedCount += 1;
      const status = mapSolapiMessageStatusCode(result.message.statusCode) ?? result.fallbackStatus;
      const acceptedAt = new Date();
      await this.db
        .update(messageSendingMessages)
        .set({
          status: status ?? "accepted",
          providerGroupId,
          providerMessageId: result.message.messageId,
          resultCode: result.message.statusCode,
          resultMessage: result.message.statusMessage,
          sentAt: status === "failed" ? undefined : acceptedAt,
          deliveredAt: status === "delivered" ? acceptedAt : undefined,
          failedAt: status === "failed" ? acceptedAt : undefined,
          providerPayload: maskSolapiPayload(result.message),
        })
        .where(
          and(
            eq(messageSendingMessages.requestId, requestId),
            eq(messageSendingMessages.id, localMessageId),
          ),
        );
    }

    if (
      matchedCount === 0 &&
      providerMessages.every((result) => isExplicitSuccess(result.message))
    ) {
      await this.db
        .update(messageSendingMessages)
        .set({ status: "accepted", providerGroupId, sentAt: new Date() })
        .where(eq(messageSendingMessages.requestId, requestId));
    }
  }

  private async markRequestFailed(requestId: string, error: unknown, totalCount: number) {
    await this.db.transaction(async (tx) => {
      await tx
        .update(messageSendingRequests)
        .set({
          status: "failed",
          failedCount: totalCount,
          errorCode: error instanceof SolapiClientError ? error.providerCode : "UNKNOWN",
          errorMessage: error instanceof Error ? error.message : "Unknown error",
        })
        .where(eq(messageSendingRequests.id, requestId));

      await tx
        .update(messageSendingMessages)
        .set({ status: "failed", failedAt: new Date() })
        .where(eq(messageSendingMessages.requestId, requestId));
    });
  }

  private async insertProviderEvent(eventKey: string, event: SolapiWebhookEvent): Promise<boolean> {
    const [row] = await this.db
      .insert(messageSendingProviderEvents)
      .values({
        eventKey,
        eventType: String(event.eventType ?? event.type ?? "message"),
        providerMessageId: stringField(event.messageId ?? event.message_id),
        providerGroupId: stringField(event.groupId ?? event.group_id),
        resultCode: stringField(event.statusCode ?? event.status_code),
        resultMessage: stringField(event.statusMessage ?? event.status_message),
        payload: maskSolapiPayload(event),
      })
      .onConflictDoNothing()
      .returning({ id: messageSendingProviderEvents.id });
    return Boolean(row);
  }

  private async applyProviderEvent(event: SolapiWebhookEvent) {
    const providerMessageId = stringField(event.messageId ?? event.message_id);
    const localMessageId = extractProductBuilderMessageId(event);
    if (!providerMessageId && !localMessageId) return;
    const status = mapSolapiMessageStatusCode(stringField(event.statusCode ?? event.status_code));
    if (!status) return;
    await this.db
      .update(messageSendingMessages)
      .set({
        status,
        providerMessageId,
        resultCode: stringField(event.statusCode ?? event.status_code),
        resultMessage: stringField(event.statusMessage ?? event.status_message),
        deliveredAt: status === "delivered" ? new Date() : undefined,
        failedAt: status === "failed" ? new Date() : undefined,
      })
      .where(
        localMessageId
          ? eq(messageSendingMessages.id, localMessageId)
          : eq(messageSendingMessages.providerMessageId, providerMessageId as string),
      );
  }

  private async markProviderEventProcessed(eventKey: string) {
    await this.db
      .update(messageSendingProviderEvents)
      .set({ status: "processed", processedAt: new Date() })
      .where(eq(messageSendingProviderEvents.eventKey, eventKey));
  }

  private async markProviderEventFailed(eventKey: string, error: unknown) {
    await this.db
      .update(messageSendingProviderEvents)
      .set({
        status: "failed",
        failureReason: error instanceof Error ? error.message : "Unknown error",
      })
      .where(eq(messageSendingProviderEvents.eventKey, eventKey));
  }
}

function toSolapiPayload(
  message: SolapiMessageInput,
  defaultSender: string,
  localMessageId?: string,
): SolapiMessagePayload {
  const payload = Object.fromEntries(
    Object.entries(message.payload ?? {}).filter(([key]) => !["to", "from", "text"].includes(key)),
  );
  const providerCustomFields = recordField(payload.customFields);

  return {
    ...payload,
    to: message.to,
    from: message.from ?? defaultSender,
    text: message.text,
    customFields: localMessageId
      ? { ...providerCustomFields, productBuilderMessageId: localMessageId }
      : providerCustomFields,
    ...(message.type ? { type: message.type } : {}),
    ...(message.country ? { country: message.country } : {}),
    ...(message.subject ? { subject: message.subject } : {}),
  };
}

function extractGroupId(response: SolapiSendManyDetailResponse): string | null {
  const id = response.groupInfo?._id ?? response.groupInfo?.groupId;
  return typeof id === "string" ? id : null;
}

export function extractCounts(response: SolapiSendManyDetailResponse, fallbackTotal: number) {
  const count = response.groupInfo?.count;
  const totalCount = numberField(count?.total) ?? fallbackTotal;
  const registeredFailed = numberField(count?.registeredFailed) ?? 0;
  const sentFailed = numberField(count?.sentFailed) ?? 0;
  const failedCount = registeredFailed + sentFailed;
  const sentTotal = numberField(count?.sentTotal);
  const acceptedCount =
    numberField(count?.registeredSuccess) ??
    numberField(count?.sentSuccess) ??
    (sentTotal === undefined ? undefined : Math.max(0, sentTotal - sentFailed)) ??
    Math.max(0, totalCount - failedCount);
  return { totalCount, acceptedCount, failedCount };
}

function summarizeRequest(
  row: typeof messageSendingRequests.$inferSelect,
): MessageSendingRequestSummary {
  return {
    id: row.id,
    status: row.status,
    providerGroupId: row.providerGroupId,
    totalCount: row.totalCount,
    acceptedCount: row.acceptedCount,
    failedCount: row.failedCount,
  };
}

function previewText(text: string): string {
  return text.length > 160 ? `${text.slice(0, 157)}...` : text;
}

function numberField(value: unknown): number | undefined {
  return typeof value === "number" && Number.isFinite(value) ? value : undefined;
}

function stringField(value: unknown): string | undefined {
  return typeof value === "string" && value.length > 0 ? value : undefined;
}

interface ProviderMessageResult {
  message: SolapiMessageResult;
  fallbackStatus?: MessageSendingMessageStatus;
}

export function collectProviderMessageResults(
  response: SolapiSendManyDetailResponse,
): ProviderMessageResult[] {
  const acceptedMessages = Array.isArray(response.messageList)
    ? response.messageList.map((message) => ({ message }))
    : [];
  const failedMessages = Array.isArray(response.failedMessageList)
    ? response.failedMessageList.map((message) => ({
        message,
        fallbackStatus: "failed" as const,
      }))
    : [];
  return [...acceptedMessages, ...failedMessages];
}

export function extractProductBuilderMessageId(value: unknown): string | undefined {
  if (!value || typeof value !== "object") return undefined;
  const record = value as Record<string, unknown>;
  const customFields = recordField(record.customFields ?? record.custom_fields);
  const id = customFields.productBuilderMessageId ?? customFields.product_builder_message_id;
  return stringField(id);
}

export function mapSolapiMessageStatusCode(
  statusCode: unknown,
): MessageSendingMessageStatus | undefined {
  const code = stringField(statusCode)?.toUpperCase();
  if (!code) return undefined;
  if (code === "FAILED" || code === "5000") return "failed";
  if (code === "4000") return "delivered";
  if (code === "3000") return "sent";
  if (code === "2000") return "accepted";
  if (/^[123]\d{3}$/.test(code)) return "failed";
  return undefined;
}

function isExplicitSuccess(value: unknown): boolean {
  if (!value || typeof value !== "object") return false;
  const record = value as Record<string, unknown>;
  const status = mapSolapiMessageStatusCode(record.statusCode ?? record.status_code);
  return status === "accepted" || status === "sent" || status === "delivered";
}

function recordField(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

export function isUniqueConstraintViolation(error: unknown): boolean {
  if (!error || typeof error !== "object") return false;
  const record = error as Record<string, unknown>;
  return (
    record.code === "23505" ||
    record.constraint === "idx_msg_send_requests_idempotency" ||
    isUniqueConstraintViolation(record.cause)
  );
}
