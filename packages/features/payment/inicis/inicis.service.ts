import {
  type DrizzleDB,
  type NewPaymentInicisEvent,
  type NewPaymentInicisOrder,
  type PaymentInicisEvent,
  type PaymentInicisOrder,
  paymentInicisEvents,
  paymentInicisOrders,
} from "@repo/drizzle";
import { AppError, ErrorCode, ResourceError, ValidationError } from "@repo/shared/errors";
import { and, desc, eq, gte, ilike, lt, lte, or, type SQL } from "drizzle-orm";
import { z } from "zod";
import { parseAuthResult, requestApproval, requestNetCancel } from "./src/approval";
import { INICIS_BILLING_BLOCKER } from "./src/billing";
import { requestCancel } from "./src/cancel";
import { buildPcStdpayCheckout } from "./src/checkout";
import { getInicisConfig, getInicisConfigStatus } from "./src/config";
import { requestInquiry } from "./src/inquiry";
import { maskEmail, maskName, maskProviderPayload } from "./src/masking";
import {
  createNotiIdempotencyKey,
  INICIS_NOTI_FAILURE_RESPONSE,
  INICIS_NOTI_SUCCESS_RESPONSE,
  normalizeNoti,
  parseNotiPayload,
} from "./src/noti";
import type { InicisConfig } from "./src/types";

const USER_SAFE_PAYMENT_ERROR = "결제 요청을 처리하지 못했습니다. 잠시 후 다시 시도해 주세요.";
const USER_SAFE_VALIDATION_ERROR = "결제 요청 정보를 확인해 주세요.";

type InicisDb = Pick<DrizzleDB, "insert" | "select" | "update">;

const checkoutInput = z.object({
  orderId: z.string().min(1).max(40),
  amount: z.number().int().positive(),
  goodsName: z.string().min(1).max(200),
  buyerName: z.string().min(1).max(80),
  buyerTel: z.string().min(1).max(40),
  buyerEmail: z.string().email(),
  payMethod: z.string().max(50).optional(),
  returnUrl: z.string().url().optional(),
  closeUrl: z.string().url().optional(),
  merchantData: z.record(z.string()).optional(),
});

const listInput = z.object({
  search: z.string().max(200).optional(),
  status: z.string().max(80).optional(),
  from: z.coerce.date().optional(),
  to: z.coerce.date().optional(),
  cursor: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(100).optional(),
});

const cancelInput = z
  .object({
    reason: z.string().min(1).max(500),
    amount: z.number().int().positive().optional(),
    confirmPrice: z.number().int().nonnegative().optional(),
  })
  .superRefine((value, ctx) => {
    if ((value.amount === undefined) !== (value.confirmPrice === undefined)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "amount and confirmPrice must be provided together",
        path: value.amount === undefined ? ["amount"] : ["confirmPrice"],
      });
    }
  });

export class InicisPaymentService {
  constructor(
    private readonly db: DrizzleDB,
    private readonly cfg: InicisConfig | null = getInicisConfig(),
  ) {}

  configStatus() {
    return {
      ...getInicisConfigStatus(),
      billingBlocker: INICIS_BILLING_BLOCKER,
    };
  }

  async createCheckout(input: unknown, userId: string) {
    const cfg = this.requireConfig();
    const parsed = parseInput(checkoutInput, input);
    const existing = await this.getOrderByOrderId(parsed.orderId);
    if (existing) {
      this.assertCheckoutReuse(existing, parsed, userId);
      return buildPcStdpayCheckout(cfg, parsed);
    }
    const form = buildPcStdpayCheckout(cfg, parsed);
    const rawMasked = maskProviderPayload({
      ...form.fields,
      buyername: parsed.buyerName,
      buyeremail: parsed.buyerEmail,
    });
    const [inserted] = await this.db
      .insert(paymentInicisOrders)
      .values({
        orderId: parsed.orderId,
        userId,
        amount: parsed.amount,
        payMethod: parsed.payMethod ?? "all",
        goodsName: parsed.goodsName,
        buyerNameMasked: maskName(parsed.buyerName),
        buyerEmailMasked: maskEmail(parsed.buyerEmail),
        status: "pending_auth",
        rawMasked,
        normalized: { checkoutEndpoint: form.endpoint },
      })
      .onConflictDoNothing({ target: paymentInicisOrders.orderId })
      .returning();
    if (!inserted) {
      const existingAfterConflict = await this.getOrderByOrderId(parsed.orderId);
      if (!existingAfterConflict) throw paymentProviderError("inicis_checkout_conflict_unreadable");
      this.assertCheckoutReuse(existingAfterConflict, parsed, userId);
      return form;
    }
    await this.recordEventOnce({
      eventType: "checkout_created",
      orderId: parsed.orderId,
      idempotencyKey: `inicis:checkout:${parsed.orderId}`,
      rawMasked,
      normalized: { amount: parsed.amount, payMethod: parsed.payMethod ?? "all" },
      status: "processed",
    });
    return form;
  }

  async handleReturn(input: Record<string, unknown>, sourceIp?: string) {
    const cfg = this.requireConfig();
    const auth = parseAuthResult(input);
    const orderId = auth.orderNumber ?? "";
    const eventIdempotencyKey = `inicis:return:${orderId}:${auth.authToken ?? auth.resultCode}`;
    const rawMasked = maskProviderPayload(input);
    if (auth.resultCode !== "0000") {
      return this.handleAuthFailure({
        auth,
        orderId,
        idempotencyKey: eventIdempotencyKey,
        rawMasked,
        sourceIp,
      });
    }

    const order = await this.getOrderByOrderId(orderId);
    if (!order) {
      return this.handleApprovalValidationFailure({
        cfg,
        auth,
        order,
        orderId,
        reason: "inicis_order_not_found",
        idempotencyKey: `${eventIdempotencyKey}:validation`,
        rawMasked,
        sourceIp,
      });
    }
    const authMismatch = this.validateAuthMatchesOrder(cfg, auth, order);
    if (authMismatch) {
      return this.handleApprovalValidationFailure({
        cfg,
        auth,
        order,
        orderId,
        reason: authMismatch,
        idempotencyKey: `${eventIdempotencyKey}:validation`,
        rawMasked,
        sourceIp,
      });
    }

    try {
      const approval = await requestApproval(cfg, auth);
      return await this.persistApprovalResult(auth, approval, order, sourceIp);
    } catch (error) {
      await requestNetCancel(cfg, auth).catch(() => undefined);
      await this.recordEventOnce({
        eventType: "approval_failed_net_cancel_requested",
        orderId,
        idempotencyKey: `${eventIdempotencyKey}:failed`,
        sourceIp,
        rawMasked,
        normalized: { code: "approval_failed" },
        errorCode: error instanceof Error ? error.message : "unknown",
        status: "failed",
      });
      return { status: "failed", code: "approval_failed", orderId };
    }
  }

  private async handleAuthFailure(input: {
    auth: ReturnType<typeof parseAuthResult>;
    orderId: string;
    idempotencyKey: string;
    rawMasked: Record<string, unknown>;
    sourceIp?: string;
  }) {
    const { auth, orderId, idempotencyKey, rawMasked, sourceIp } = input;
    await this.withTransaction(async (tx) => {
      await this.markOrderOn(tx, orderId, {
        status: "auth_failed",
        providerResultCode: auth.resultCode,
        providerResultMessage: auth.resultMsg ?? null,
        rawMasked,
      });
      await this.recordEventOnceOn(tx, {
        eventType: "return_auth_failed",
        orderId,
        idempotencyKey,
        sourceIp,
        providerResultCode: auth.resultCode,
        providerResultMessage: auth.resultMsg,
        rawMasked,
        normalized: { code: "auth_failed" },
        status: "processed",
      });
    });
    return { status: "failed", code: "auth_failed", orderId };
  }

  private async persistApprovalResult(
    auth: ReturnType<typeof parseAuthResult>,
    approval: Awaited<ReturnType<typeof requestApproval>>,
    order: PaymentInicisOrder,
    sourceIp?: string,
  ) {
    const success = isInicisApprovalSuccessCode(approval.resultCode);
    const rawMasked = maskProviderPayload(approval);
    const orderId = order.orderId;
    if (success) {
      const mismatch = this.validateApprovalMatchesOrder(approval, order);
      if (mismatch) {
        return this.handleApprovalValidationFailure({
          cfg: this.requireConfig(),
          auth,
          order,
          orderId,
          reason: mismatch,
          idempotencyKey: `inicis:approval:${orderId}:${approval.tid ?? "validated"}:mismatch`,
          rawMasked,
          sourceIp,
          approval,
        });
      }
    }
    await this.withTransaction(async (tx) => {
      await this.markOrderOn(tx, orderId, {
        tid: approval.tid ?? null,
        authTid: auth.authToken ?? null,
        status: success ? "approved" : "failed",
        providerResultCode: approval.resultCode,
        providerResultMessage: approval.resultMsg ?? null,
        approvedAt: success ? new Date() : null,
        rawMasked,
        normalized: { payMethod: approval.payMethod, amount: approval.TotPrice },
      });
      await this.recordEventOnceOn(tx, {
        eventType: success ? "approval_succeeded" : "approval_rejected",
        orderId,
        tid: approval.tid,
        idempotencyKey: `inicis:approval:${orderId}:${approval.tid ?? approval.resultCode}`,
        sourceIp,
        providerResultCode: approval.resultCode,
        providerResultMessage: approval.resultMsg,
        rawMasked,
        normalized: { code: success ? "approved" : "approval_rejected" },
        status: success ? "processed" : "failed",
      });
    });
    return {
      status: success ? "success" : "failed",
      code: success ? "approved" : "approval_rejected",
      orderId,
    };
  }

  async getUserOrder(orderId: string, userId: string) {
    const [order] = await this.db
      .select()
      .from(paymentInicisOrders)
      .where(and(eq(paymentInicisOrders.orderId, orderId), eq(paymentInicisOrders.userId, userId)))
      .limit(1);
    return order ?? null;
  }

  async handleNoti(input: Record<string, unknown>, sourceIp?: string) {
    const cfg = this.cfg;
    const payload = parseNotiPayload(input);
    const normalized = normalizeNoti(payload);
    const idempotencyKey = createNotiIdempotencyKey(payload);
    const rawMasked = maskProviderPayload(input);
    const sourceCheck = cfg
      ? validateNotiSource(sourceIp, cfg.notiAllowedIps)
      : "inicis_config_missing";
    const order = normalized.paymentCompleted
      ? await this.getOrderByOrderId(normalized.orderId)
      : null;
    const notiMismatch =
      sourceCheck ??
      (normalized.paymentCompleted ? validateNotiMatchesOrder(normalized, order) : null);
    return this.withTransaction(async (tx) => {
      const event = await this.recordEventOnceOn(tx, {
        eventType: normalized.kind,
        orderId: normalized.orderId,
        tid: normalized.tid,
        idempotencyKey,
        sourceIp,
        providerResultCode: normalized.providerResultCode,
        rawMasked,
        normalized: notiMismatch ? { ...normalized, code: notiMismatch } : normalized,
        errorCode: notiMismatch ?? undefined,
        status: notiMismatch ? "failed" : "processed",
      });
      if (notiMismatch) return INICIS_NOTI_FAILURE_RESPONSE;
      if (!event.inserted) return INICIS_NOTI_SUCCESS_RESPONSE;
      if (normalized.paymentCompleted) {
        await this.markOrderOn(tx, normalized.orderId, {
          tid: normalized.tid,
          status: "paid",
          paidAt: new Date(),
          providerResultCode: normalized.providerResultCode,
          normalized,
        });
      }
      return INICIS_NOTI_SUCCESS_RESPONSE;
    });
  }

  async listOrders(query: unknown) {
    const input = parseInput(listInput, query ?? {});
    const conditions: SQL[] = [];
    if (input.status) conditions.push(eq(paymentInicisOrders.status, input.status as never));
    if (input.from) conditions.push(gte(paymentInicisOrders.createdAt, input.from));
    if (input.to) conditions.push(lte(paymentInicisOrders.createdAt, input.to));
    if (input.search) {
      const searchFilter = or(
        ilike(paymentInicisOrders.orderId, `%${input.search}%`),
        ilike(paymentInicisOrders.tid, `%${input.search}%`),
        ilike(paymentInicisOrders.userId, `%${input.search}%`),
      );
      if (searchFilter) conditions.push(searchFilter);
    }
    if (input.cursor) {
      const [cursorRow] = await this.db
        .select({ createdAt: paymentInicisOrders.createdAt })
        .from(paymentInicisOrders)
        .where(eq(paymentInicisOrders.id, input.cursor))
        .limit(1);
      if (cursorRow) conditions.push(lt(paymentInicisOrders.createdAt, cursorRow.createdAt));
    }
    const rows = await this.db
      .select()
      .from(paymentInicisOrders)
      .where(conditions.length ? and(...conditions) : undefined)
      .orderBy(desc(paymentInicisOrders.createdAt))
      .limit(input.limit ?? 50);
    return {
      rows,
      nextCursor: rows.length === (input.limit ?? 50) ? (rows.at(-1)?.id ?? null) : null,
    };
  }

  async listEvents(query: unknown) {
    const input = parseInput(listInput, query ?? {});
    const conditions: SQL[] = [];
    if (input.status) conditions.push(eq(paymentInicisEvents.status, input.status as never));
    if (input.from) conditions.push(gte(paymentInicisEvents.createdAt, input.from));
    if (input.to) conditions.push(lte(paymentInicisEvents.createdAt, input.to));
    if (input.search) {
      const searchFilter = or(
        ilike(paymentInicisEvents.orderId, `%${input.search}%`),
        ilike(paymentInicisEvents.tid, `%${input.search}%`),
        ilike(paymentInicisEvents.idempotencyKey, `%${input.search}%`),
      );
      if (searchFilter) conditions.push(searchFilter);
    }
    if (input.cursor) {
      const [cursorRow] = await this.db
        .select({ createdAt: paymentInicisEvents.createdAt })
        .from(paymentInicisEvents)
        .where(eq(paymentInicisEvents.id, input.cursor))
        .limit(1);
      if (cursorRow) conditions.push(lt(paymentInicisEvents.createdAt, cursorRow.createdAt));
    }
    const rows = await this.db
      .select()
      .from(paymentInicisEvents)
      .where(conditions.length ? and(...conditions) : undefined)
      .orderBy(desc(paymentInicisEvents.createdAt))
      .limit(input.limit ?? 50);
    return {
      rows,
      nextCursor: rows.length === (input.limit ?? 50) ? (rows.at(-1)?.id ?? null) : null,
    };
  }

  async getOrderDetail(orderId: string) {
    const [order] = await this.db
      .select()
      .from(paymentInicisOrders)
      .where(eq(paymentInicisOrders.orderId, orderId))
      .limit(1);
    if (!order) return null;

    const eventFilters = [eq(paymentInicisEvents.orderId, orderId)];
    if (order.tid) eventFilters.push(eq(paymentInicisEvents.tid, order.tid));
    const eventWhere =
      eventFilters.length === 1 ? eventFilters[0] : or(...(eventFilters as [SQL, SQL, ...SQL[]]));
    const events = await this.db
      .select()
      .from(paymentInicisEvents)
      .where(eventWhere)
      .orderBy(desc(paymentInicisEvents.createdAt))
      .limit(100);

    return {
      order,
      events,
      entitlementStatus: this.resolveEntitlementStatus(order),
    };
  }

  async getEvent(eventId: string): Promise<PaymentInicisEvent | null> {
    const [event] = await this.db
      .select()
      .from(paymentInicisEvents)
      .where(eq(paymentInicisEvents.id, eventId))
      .limit(1);
    return event ?? null;
  }

  async cancelOrRefund(orderId: string, body: unknown) {
    const cfg = this.requireConfig();
    const input = parseInput(cancelInput, body);
    const order = await this.getOrderByOrderId(orderId);
    if (!order?.tid) throw ResourceError.notFound("INICIS order", orderId);
    this.assertRefundAmount(order, input);
    const result = await requestCancel(cfg, { tid: order.tid, ...input });
    const success = isInicisCancelSuccessCode(result.resultCode);
    const nextRefundedAmount = input.amount ? order.refundedAmount + input.amount : order.amount;
    const status = input.amount ? "partially_refunded" : "refunded";
    const rawMasked = maskProviderPayload(result as Record<string, unknown>);
    const cancelIdempotencyKey = `inicis:cancel:${orderId}:${input.amount ?? "full"}:${order.refundedAmount}`;
    if (!success) {
      await this.recordEventOnce({
        eventType: input.amount ? "partial_refund_rejected" : "cancel_rejected",
        orderId,
        tid: order.tid,
        idempotencyKey: `${cancelIdempotencyKey}:rejected`,
        rawMasked,
        normalized: { status: "failed", code: "inicis_cancel_rejected" },
        providerResultCode: String(result.resultCode ?? ""),
        providerResultMessage: typeof result.resultMsg === "string" ? result.resultMsg : undefined,
        errorCode: "inicis_cancel_rejected",
        status: "failed",
      });
      throw paymentProviderError("inicis_cancel_rejected", result.resultCode);
    }
    await this.withTransaction(async (tx) => {
      await this.markOrderOn(tx, orderId, {
        status,
        refundedAmount: nextRefundedAmount,
        providerResultCode: String(result.resultCode ?? ""),
        providerResultMessage: typeof result.resultMsg === "string" ? result.resultMsg : null,
        canceledAt: new Date(),
        rawMasked,
      });
      await this.recordEventOnceOn(tx, {
        eventType: input.amount ? "partial_refund_requested" : "cancel_requested",
        orderId,
        tid: order.tid ?? undefined,
        idempotencyKey: cancelIdempotencyKey,
        rawMasked,
        normalized: { status },
        providerResultCode: String(result.resultCode ?? ""),
        status: "processed",
      });
    });
    return result;
  }

  async inquiry(orderId: string) {
    const cfg = this.requireConfig();
    const [order] = await this.db
      .select()
      .from(paymentInicisOrders)
      .where(eq(paymentInicisOrders.orderId, orderId))
      .limit(1);
    const result = await requestInquiry(cfg, { tid: order?.tid ?? undefined, oid: orderId });
    await this.recordEventOnce({
      eventType: "inquiry_requested",
      orderId,
      tid: order?.tid ?? undefined,
      idempotencyKey: `inicis:inquiry:${orderId}:${Date.now()}`,
      rawMasked: maskProviderPayload(result as Record<string, unknown>),
      normalized: { resultCode: result.resultCode },
      providerResultCode: String(result.resultCode ?? ""),
      status: "processed",
    });
    return result;
  }

  async replayEvent(eventId: string) {
    const event = await this.getEvent(eventId);
    if (!event) return { ok: false as const, code: "event_not_found" };
    await this.recordEventOnce({
      eventType: "manual_replay_requested",
      orderId: event.orderId ?? undefined,
      tid: event.tid ?? undefined,
      idempotencyKey: `inicis:replay:${eventId}:${Date.now()}`,
      rawMasked: event.rawMasked as Record<string, unknown>,
      normalized: {
        replayedFromEventId: eventId,
        originalEventType: event.eventType,
        note: "manual_replay_requires_original_event_payload",
      },
      status: "replayed",
    });
    return {
      ok: true as const,
      eventId,
      replay: "manual_replay_requires_original_event_payload",
    };
  }

  private async getOrderByOrderId(orderId: string): Promise<PaymentInicisOrder | null> {
    if (!orderId) return null;
    const [order] = await this.db
      .select()
      .from(paymentInicisOrders)
      .where(eq(paymentInicisOrders.orderId, orderId))
      .limit(1);
    return order ?? null;
  }

  private assertCheckoutReuse(
    order: PaymentInicisOrder,
    input: z.infer<typeof checkoutInput>,
    userId: string,
  ) {
    const expectedPayMethod = input.payMethod ?? "all";
    if (
      order.userId !== userId ||
      order.amount !== input.amount ||
      order.goodsName !== input.goodsName ||
      order.payMethod !== expectedPayMethod
    ) {
      throw new ValidationError(
        { orderId: ["inicis_checkout_order_conflict"] },
        USER_SAFE_VALIDATION_ERROR,
      );
    }
  }

  private validateAuthMatchesOrder(
    cfg: InicisConfig,
    auth: ReturnType<typeof parseAuthResult>,
    order: PaymentInicisOrder,
  ): string | null {
    if (auth.mid && auth.mid !== cfg.mid) return "inicis_auth_mid_mismatch";
    if (auth.orderNumber && auth.orderNumber !== order.orderId) return "inicis_auth_oid_mismatch";
    return null;
  }

  private validateApprovalMatchesOrder(
    approval: Awaited<ReturnType<typeof requestApproval>>,
    order: PaymentInicisOrder,
  ): string | null {
    if (approval.MOID && approval.MOID !== order.orderId) return "inicis_approval_moid_mismatch";
    if (approval.TotPrice && Number(approval.TotPrice) !== order.amount) {
      return "inicis_approval_amount_mismatch";
    }
    if (typeof approval.mid === "string" && approval.mid !== this.requireConfig().mid) {
      return "inicis_approval_mid_mismatch";
    }
    return null;
  }

  private async handleApprovalValidationFailure(input: {
    cfg: InicisConfig;
    auth: ReturnType<typeof parseAuthResult>;
    order: PaymentInicisOrder | null;
    orderId: string;
    reason: string;
    idempotencyKey: string;
    rawMasked: Record<string, unknown>;
    sourceIp?: string;
    approval?: Awaited<ReturnType<typeof requestApproval>>;
  }) {
    await requestNetCancel(input.cfg, input.auth).catch(() => undefined);
    await this.withTransaction(async (tx) => {
      await this.markOrderOn(tx, input.orderId, {
        status: "failed",
        providerResultCode: input.approval?.resultCode ?? input.auth.resultCode,
        providerResultMessage: input.approval?.resultMsg ?? input.auth.resultMsg ?? null,
        rawMasked: input.rawMasked,
        normalized: { code: input.reason },
      });
      await this.recordEventOnceOn(tx, {
        eventType: "approval_validation_failed_net_cancel_requested",
        orderId: input.orderId,
        tid: input.approval?.tid ?? input.order?.tid ?? undefined,
        idempotencyKey: input.idempotencyKey,
        sourceIp: input.sourceIp,
        providerResultCode: input.approval?.resultCode ?? input.auth.resultCode,
        providerResultMessage: input.approval?.resultMsg ?? input.auth.resultMsg,
        rawMasked: input.rawMasked,
        normalized: { code: input.reason },
        errorCode: input.reason,
        status: "failed",
      });
    });
    return { status: "failed", code: input.reason, orderId: input.orderId };
  }

  private assertRefundAmount(order: PaymentInicisOrder, input: z.infer<typeof cancelInput>): void {
    if (input.amount === undefined) return;
    const remaining = order.amount - order.refundedAmount;
    const expectedConfirmPrice = remaining - input.amount;
    if (input.amount > remaining || input.confirmPrice !== expectedConfirmPrice) {
      throw new ValidationError(
        { amount: ["inicis_partial_refund_amount_invalid"] },
        USER_SAFE_VALIDATION_ERROR,
      );
    }
  }

  private requireConfig(): InicisConfig {
    if (!this.cfg) {
      throw new AppError({
        code: ErrorCode.SERVICE_UNAVAILABLE,
        message: USER_SAFE_PAYMENT_ERROR,
        context: { reason: "inicis_config_missing" },
      });
    }
    return this.cfg;
  }

  private resolveEntitlementStatus(order: PaymentInicisOrder) {
    if (order.status === "paid" || order.status === "approved") {
      return {
        status: "blocked",
        code: "inicis_entitlement_adapter_required",
        message:
          "INICIS payment is captured, but reusable entitlement grant/revoke needs a Product Builder-specific credit/subscription adapter.",
      };
    }
    if (order.status === "refunded" || order.status === "canceled") {
      return {
        status: "not_applicable",
        code: "payment_reversed",
        message: "Payment is reversed; no reusable INICIS entitlement is active.",
      };
    }
    return {
      status: "pending",
      code: "payment_not_completed",
      message: "Entitlement can only be evaluated after approval or noti payment completion.",
    };
  }

  private withTransaction<T>(fn: (tx: InicisDb) => Promise<T>): Promise<T> {
    const dbWithOptionalTx = this.db as unknown as {
      transaction?: (callback: (tx: InicisDb) => Promise<T>) => Promise<T>;
    };
    if (typeof dbWithOptionalTx.transaction === "function") {
      return dbWithOptionalTx.transaction((tx) => fn(tx));
    }
    return fn(this.db);
  }

  private async markOrderOn(db: InicisDb, orderId: string, patch: Partial<NewPaymentInicisOrder>) {
    if (!orderId) return;
    await db
      .update(paymentInicisOrders)
      .set({ ...patch, updatedAt: new Date() })
      .where(eq(paymentInicisOrders.orderId, orderId));
  }

  private recordEventOnce(
    input: Omit<NewPaymentInicisEvent, "id" | "createdAt" | "updatedAt" | "processedAt"> & {
      eventType: string;
      orderId?: string;
      tid?: string;
      idempotencyKey: string;
      sourceIp?: string;
      providerResultCode?: string;
      providerResultMessage?: string;
      rawMasked: Record<string, unknown>;
      normalized?: unknown;
      errorCode?: string;
      status: "received" | "processed" | "failed" | "replayed";
    },
  ): Promise<{ inserted: boolean; event: PaymentInicisEvent | null }> {
    return this.recordEventOnceOn(this.db, input);
  }

  private async recordEventOnceOn(
    db: InicisDb,
    input: Omit<NewPaymentInicisEvent, "id" | "createdAt" | "updatedAt" | "processedAt"> & {
      eventType: string;
      orderId?: string;
      tid?: string;
      idempotencyKey: string;
      sourceIp?: string;
      providerResultCode?: string;
      providerResultMessage?: string;
      rawMasked: Record<string, unknown>;
      normalized?: unknown;
      errorCode?: string;
      status: "received" | "processed" | "failed" | "replayed";
    },
  ): Promise<{ inserted: boolean; event: PaymentInicisEvent | null }> {
    const [inserted] = await db
      .insert(paymentInicisEvents)
      .values({
        eventType: input.eventType,
        status: input.status,
        orderId: input.orderId ?? null,
        tid: input.tid ?? null,
        idempotencyKey: input.idempotencyKey,
        sourceIp: input.sourceIp ?? null,
        providerResultCode: input.providerResultCode ?? null,
        providerResultMessage: input.providerResultMessage ?? null,
        rawMasked: input.rawMasked,
        normalized: (input.normalized ?? null) as never,
        errorCode: input.errorCode ?? null,
        processedAt: input.status === "processed" ? new Date() : null,
      })
      .onConflictDoNothing({ target: paymentInicisEvents.idempotencyKey })
      .returning();
    if (inserted) return { inserted: true, event: inserted };
    const [event] = await db
      .select()
      .from(paymentInicisEvents)
      .where(eq(paymentInicisEvents.idempotencyKey, input.idempotencyKey))
      .limit(1);
    return { inserted: false, event: event ?? null };
  }
}

function parseInput<T extends z.ZodTypeAny>(schema: T, input: unknown): z.infer<T> {
  const result = schema.safeParse(input);
  if (!result.success) {
    const fields: Record<string, string[]> = {};
    for (const issue of result.error.issues) {
      const path = issue.path.join(".") || "root";
      fields[path] = [...(fields[path] ?? []), issue.message];
    }
    throw new ValidationError(fields, USER_SAFE_VALIDATION_ERROR);
  }
  return result.data;
}

function isInicisApprovalSuccessCode(code: string | undefined): boolean {
  return code === "0000";
}

function isInicisCancelSuccessCode(code: unknown): boolean {
  return code === "00";
}

function validateNotiSource(sourceIp: string | undefined, allowedIps: string[]): string | null {
  if (allowedIps.length === 0) return "inicis_noti_ip_allowlist_missing";
  if (!sourceIp) return "inicis_noti_source_ip_missing";
  const normalizedSource = normalizeIp(sourceIp);
  const allowed = new Set(allowedIps.map(normalizeIp));
  return allowed.has(normalizedSource) ? null : "inicis_noti_source_ip_not_allowed";
}

function validateNotiMatchesOrder(
  normalized: ReturnType<typeof normalizeNoti>,
  order: PaymentInicisOrder | null,
): string | null {
  if (!order) return "inicis_noti_order_not_found";
  if (normalized.amount !== order.amount) return "inicis_noti_amount_mismatch";
  if (order.tid && normalized.tid && order.tid !== normalized.tid)
    return "inicis_noti_tid_mismatch";
  return null;
}

function normalizeIp(ip: string): string {
  const trimmed = ip.trim();
  return trimmed.startsWith("::ffff:") ? trimmed.slice("::ffff:".length) : trimmed;
}

function paymentProviderError(reason: string, resultCode?: unknown): AppError {
  return new AppError({
    code: ErrorCode.PAYMENT_FAILED,
    message: USER_SAFE_PAYMENT_ERROR,
    context: { reason, resultCode: String(resultCode ?? "") },
  });
}
