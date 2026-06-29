import {
  Body,
  Controller,
  Get,
  Header,
  NotFoundException,
  Param,
  Post,
  Query,
  Req,
  Res,
  UseGuards,
} from "@nestjs/common";
import {
  ApiBearerAuth,
  ApiBody,
  ApiConsumes,
  ApiOperation,
  ApiParam,
  ApiProperty,
  ApiResponse,
  ApiTags,
} from "@nestjs/swagger";
import type { User } from "@repo/core/nestjs/auth";
import { BetterAuthAdminGuard, BetterAuthGuard, CurrentUser } from "@repo/core/nestjs/auth";
import type { FastifyReply } from "fastify";
import { InicisPaymentService } from "../inicis/inicis.service";
import { type AuditableContext, withAuditLog } from "../service/audit.decorator";
import { AuditService } from "../service/audit.service";

interface RequestLike {
  ip?: string;
  headers?: Record<string, string | string[] | undefined>;
}

const objectSchema = { type: "object", additionalProperties: true } as const;
const pageSchema = {
  type: "object",
  properties: {
    rows: { type: "array", items: objectSchema },
    nextCursor: { type: "string", nullable: true },
  },
} as const;

class InicisCheckoutDto {
  @ApiProperty({ example: "order_20260613_0001", maxLength: 40 })
  orderId!: string;

  @ApiProperty({ example: 10000 })
  amount!: number;

  @ApiProperty({ example: "Pro plan" })
  goodsName!: string;

  @ApiProperty({ example: "K**" })
  buyerName!: string;

  @ApiProperty({ example: "01012345678" })
  buyerTel!: string;

  @ApiProperty({ example: "buyer@example.com" })
  buyerEmail!: string;

  @ApiProperty({ required: false, example: "Card" })
  payMethod?: string;

  @ApiProperty({ required: false })
  returnUrl?: string;

  @ApiProperty({ required: false })
  closeUrl?: string;

  @ApiProperty({ required: false, additionalProperties: { type: "string" } })
  merchantData?: Record<string, string>;
}

class InicisCancelDto {
  @ApiProperty({ example: "customer_request" })
  reason!: string;

  @ApiProperty({ required: false, example: 5000 })
  amount?: number;

  @ApiProperty({ required: false, example: 5000 })
  confirmPrice?: number;
}

function auditCtx(audit: AuditService, user: User, req: RequestLike): AuditableContext {
  return {
    audit,
    session: { user: { id: user.id } },
    req: { ip: req.ip, headers: req.headers },
  };
}

function resolveInicisNotiSourceIp(req: RequestLike): string | undefined {
  if (process.env.PAYMENT_INICIS_TRUST_PROXY !== "true") return req.ip;
  const forwardedFor = req.headers?.["x-forwarded-for"];
  const firstForwarded = Array.isArray(forwardedFor) ? forwardedFor[0] : forwardedFor;
  return firstForwarded?.split(",")[0]?.trim() || req.ip;
}

@ApiTags("Payment INICIS")
@Controller("payment/inicis")
export class InicisPublicController {
  constructor(private readonly inicis: InicisPaymentService) {}

  @Post("checkouts")
  @UseGuards(BetterAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: "Create INICIS PC standard checkout form payload" })
  @ApiResponse({
    status: 201,
    description: "INICIS form endpoint and fields",
    schema: objectSchema,
  })
  @ApiBody({ type: InicisCheckoutDto })
  createCheckout(@CurrentUser() user: User, @Body() body: InicisCheckoutDto) {
    return this.inicis.createCheckout(body, user.id);
  }

  @Post("return")
  @ApiConsumes("application/x-www-form-urlencoded", "application/json")
  @ApiOperation({ summary: "Handle INICIS auth return and approval" })
  @ApiResponse({ status: 302, description: "Redirects with stable status/code" })
  @ApiBody({ schema: objectSchema })
  async handleReturn(
    @Body() body: Record<string, unknown>,
    @Req() req: RequestLike,
    @Res() reply: FastifyReply,
  ) {
    const result = await this.inicis.handleReturn(body, req.ip);
    const params = new URLSearchParams(result);
    return reply.redirect(`/payment/result?${params.toString()}`, 302);
  }

  @Post("callback")
  @ApiConsumes("application/x-www-form-urlencoded", "application/json")
  @ApiOperation({ summary: "Alias for INICIS auth callback" })
  @ApiResponse({ status: 302, description: "Redirects with stable status/code" })
  @ApiBody({ schema: objectSchema })
  handleCallback(
    @Body() body: Record<string, unknown>,
    @Req() req: RequestLike,
    @Res() reply: FastifyReply,
  ) {
    return this.handleReturn(body, req, reply);
  }
}

@ApiTags("Payment INICIS")
@ApiBearerAuth()
@UseGuards(BetterAuthGuard)
@Controller("payment/orders")
export class InicisOrderPublicController {
  constructor(private readonly inicis: InicisPaymentService) {}

  @Get(":orderId")
  @ApiOperation({ summary: "Get my INICIS payment order status" })
  @ApiParam({ name: "orderId" })
  @ApiResponse({ status: 200, description: "Masked INICIS order status", schema: objectSchema })
  async getOrder(@CurrentUser() user: User, @Param("orderId") orderId: string) {
    const order = await this.inicis.getUserOrder(orderId, user.id);
    if (!order) throw new NotFoundException("주문을 찾을 수 없습니다.");
    return { order };
  }
}

@ApiTags("Payment INICIS Webhook")
@Controller("webhooks/inicis")
export class InicisWebhookController {
  constructor(private readonly inicis: InicisPaymentService) {}

  @Post("noti")
  @Header("Content-Type", "text/plain; charset=utf-8")
  @ApiConsumes("application/x-www-form-urlencoded", "application/json")
  @ApiOperation({ summary: "Handle INICIS virtual-account noti" })
  @ApiBody({ schema: objectSchema })
  @ApiResponse({
    status: 200,
    description: "Returns OK when processed",
    schema: { type: "string" },
  })
  handleNoti(@Body() body: Record<string, unknown>, @Req() req: RequestLike) {
    return this.inicis.handleNoti(body, resolveInicisNotiSourceIp(req));
  }
}

@ApiTags("Payment Admin INICIS")
@ApiBearerAuth()
@UseGuards(BetterAuthGuard, BetterAuthAdminGuard)
@Controller("admin/payment/inicis")
export class InicisAdminController {
  constructor(
    private readonly inicis: InicisPaymentService,
    private readonly audit: AuditService,
  ) {}

  @Get("status")
  @ApiOperation({ summary: "INICIS merchant config status" })
  @ApiResponse({ status: 200, description: "INICIS config readiness", schema: objectSchema })
  status() {
    return this.inicis.configStatus();
  }

  @Get("orders")
  @ApiOperation({ summary: "List INICIS orders" })
  @ApiResponse({ status: 200, description: "INICIS order page", schema: pageSchema })
  listOrders(@Query() query: unknown) {
    return this.inicis.listOrders(query);
  }

  @Get("orders/:orderId")
  @ApiOperation({ summary: "Get INICIS order detail with event timeline" })
  @ApiParam({ name: "orderId" })
  @ApiResponse({ status: 200, description: "INICIS order detail", schema: objectSchema })
  async getOrderDetail(@Param("orderId") orderId: string) {
    const detail = await this.inicis.getOrderDetail(orderId);
    if (!detail) throw new NotFoundException("주문을 찾을 수 없습니다.");
    return detail;
  }

  @Get("events")
  @ApiOperation({ summary: "List INICIS provider events" })
  @ApiResponse({ status: 200, description: "INICIS event page", schema: pageSchema })
  listEvents(@Query() query: unknown) {
    return this.inicis.listEvents(query);
  }

  @Get("events/:eventId")
  @ApiOperation({ summary: "Get masked INICIS provider event detail" })
  @ApiParam({ name: "eventId" })
  @ApiResponse({ status: 200, description: "Masked INICIS event detail", schema: objectSchema })
  async getEvent(@Param("eventId") eventId: string) {
    const event = await this.inicis.getEvent(eventId);
    if (!event) throw new NotFoundException("이벤트를 찾을 수 없습니다.");
    return { event };
  }

  @Post("orders/:orderId/cancel")
  @ApiOperation({ summary: "Cancel or partially refund an INICIS order" })
  @ApiBody({ type: InicisCancelDto })
  @ApiResponse({ status: 201, description: "INICIS cancel/refund result", schema: objectSchema })
  cancel(
    @Param("orderId") orderId: string,
    @Body() body: InicisCancelDto,
    @CurrentUser() user: User,
    @Req() req: RequestLike,
  ) {
    const input = { orderId, ...body };
    return withAuditLog<typeof input, unknown>(
      "inicis_cancel",
      ({ input: i }) => this.inicis.cancelOrRefund(i.orderId, i),
      { extract: (i) => ({ reason: i.reason, targetOrgId: undefined }) },
    )({ ctx: auditCtx(this.audit, user, req), input });
  }

  @Post("orders/:orderId/refund")
  @ApiOperation({ summary: "Alias for INICIS refund" })
  @ApiBody({ type: InicisCancelDto })
  @ApiResponse({ status: 201, description: "INICIS refund result", schema: objectSchema })
  refund(
    @Param("orderId") orderId: string,
    @Body() body: InicisCancelDto,
    @CurrentUser() user: User,
    @Req() req: RequestLike,
  ) {
    const input = { orderId, ...body };
    return withAuditLog<typeof input, unknown>(
      "inicis_refund",
      ({ input: i }) => this.inicis.cancelOrRefund(i.orderId, i),
      { extract: (i) => ({ reason: i.reason, targetOrgId: undefined }) },
    )({ ctx: auditCtx(this.audit, user, req), input });
  }

  @Post("orders/:orderId/inquiry")
  @ApiOperation({ summary: "Run INICIS transaction inquiry" })
  @ApiResponse({ status: 201, description: "INICIS inquiry result", schema: objectSchema })
  inquiry(@Param("orderId") orderId: string, @CurrentUser() user: User, @Req() req: RequestLike) {
    const input = { orderId, reason: "admin_inquiry" };
    return withAuditLog<typeof input, unknown>(
      "inicis_inquiry",
      ({ input: i }) => this.inicis.inquiry(i.orderId),
      { extract: (i) => ({ reason: i.reason, targetOrgId: undefined }) },
    )({ ctx: auditCtx(this.audit, user, req), input });
  }

  @Post("events/:eventId/replay")
  @ApiOperation({ summary: "Record INICIS replay request marker" })
  @ApiResponse({ status: 201, description: "Replay marker result", schema: objectSchema })
  replay(@Param("eventId") eventId: string, @CurrentUser() user: User, @Req() req: RequestLike) {
    const input = { eventId, reason: "admin_replay" };
    return withAuditLog<typeof input, unknown>(
      "inicis_replay",
      ({ input: i }) => this.inicis.replayEvent(i.eventId),
      { extract: (i) => ({ reason: i.reason, targetOrgId: undefined }) },
    )({ ctx: auditCtx(this.audit, user, req), input });
  }
}
