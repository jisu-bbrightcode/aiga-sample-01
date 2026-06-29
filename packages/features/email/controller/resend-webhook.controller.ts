/**
 * Resend Webhook Controller
 *
 * Receives Resend delivery events (delivered / bounced / complained / opened)
 * at `POST /api/webhooks/resend` and reconciles `email_logs`.
 *
 * Security (mirrors video-lecture Cloudflare Stream + payment Polar webhooks):
 *   - The Fastify `preParsing` hook in apps/server/src/main.ts captures the
 *     exact bytes for any `/api/webhooks/*` path as `request.rawBody`. We MUST
 *     verify those bytes (Svix/Standard-Webhooks HMAC) — never a re-stringified
 *     JSON body — or the signature breaks.
 *   - No secret configured → 503 (operator must wire RESEND_WEBHOOK_SECRET).
 *   - Bad/missing signature or replayed timestamp → 401.
 */

import {
  Controller,
  Headers,
  Post,
  Req,
  ServiceUnavailableException,
  UnauthorizedException,
} from "@nestjs/common";
import { ApiExcludeEndpoint, ApiTags } from "@nestjs/swagger";
import type { FastifyRequest } from "fastify";
import { EmailService } from "../service/email.service";
import { parseResendWebhookPayload } from "../webhooks/resend.payload.schema";
import { verifyResendWebhookSignature } from "../webhooks/resend-signature";

@ApiTags("Email Webhook")
@Controller("webhooks/resend")
export class ResendWebhookController {
  constructor(private readonly emailService: EmailService) {}

  @Post()
  @ApiExcludeEndpoint()
  async handle(
    @Req() request: FastifyRequest & { rawBody?: string },
    @Headers() headers: Record<string, string | string[] | undefined>,
  ): Promise<{ received: true; matched: boolean }> {
    const secret = process.env.RESEND_WEBHOOK_SECRET ?? "";
    if (secret === "") {
      throw new ServiceUnavailableException({
        error: "webhook_not_configured",
        hint: "Set RESEND_WEBHOOK_SECRET",
      });
    }

    const rawBody = request.rawBody ?? JSON.stringify(request.body ?? {});

    const verification = verifyResendWebhookSignature({ rawBody, headers, secret });
    if (!verification.valid) {
      throw new UnauthorizedException({ error: verification.reason });
    }

    const payload = parseResendWebhookPayload(rawBody);
    const result = await this.emailService.recordProviderEvent(payload);

    return { received: true, matched: result.matched };
  }
}
