import type { User } from "@repo/core/nestjs/auth";
import { BetterAuthGuard, CurrentUser } from "@repo/core/nestjs/auth";
import {
  All,
  Body,
  Controller,
  Get,
  Header,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
  UseGuards,
} from "@nestjs/common";
import {
  ApiBearerAuth,
  ApiExcludeEndpoint,
  ApiOperation,
  ApiParam,
  ApiResponse,
  ApiTags,
} from "@nestjs/swagger";
import {
  CreateKcbIdentitySessionDto,
  identityVerificationSessionOpenApiSchema,
  LinkKcbVerificationDto,
} from "../dto";
import { kcbCallbackInputSchema } from "../kcb";
import { toPublicKcbError } from "../kcb/errors";
import { IdentityVerificationService } from "../service";

@ApiTags("Identity Verification")
@Controller("identity-verifications/kcb")
export class IdentityVerificationController {
  constructor(private readonly service: IdentityVerificationService) {}

  // NOTE: identity verification is intentionally public — it runs before signup
  // (회원가입 전 본인확인). Sessions are created anonymously (userId = null); the
  // builder attaches a userId when it composes this feature with an authenticated flow.
  // TODO(prod): /sessions and /custom/start trigger metered KCB START calls. Add rate
  // limiting / bot protection before exposing them in production.
  @Post("sessions")
  @ApiOperation({ summary: "KCB 표준형 본인확인 세션 생성 (로그인 불필요)" })
  @ApiResponse({
    status: 201,
    description: "KCB 본인확인 세션. Provider 미구성 시 blocked 코드 포함",
    schema: {
      allOf: [identityVerificationSessionOpenApiSchema],
      properties: {
        state: { type: "string", nullable: true },
        nonce: { type: "string", nullable: true },
        blocked: { type: "object", nullable: true },
      },
    },
  })
  createSession(@Body() dto: CreateKcbIdentitySessionDto) {
    return this.service.createSession(null, dto);
  }

  @Get("sessions/:sessionId")
  @ApiOperation({ summary: "KCB 본인확인 세션 조회 (로그인 불필요)" })
  @ApiParam({ name: "sessionId", description: "본인확인 세션 ID" })
  @ApiResponse({
    status: 200,
    description: "KCB 본인확인 세션. 없으면 null",
    schema: { nullable: true, allOf: [identityVerificationSessionOpenApiSchema] },
  })
  getSession(@Param("sessionId", ParseUUIDPipe) sessionId: string) {
    return this.service.getSession(sessionId);
  }

  @Post("sessions/:sessionId/link")
  @UseGuards(BetterAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: "익명 본인확인 요청을 현재 user에 연결 (회원가입 후 귀속)" })
  @ApiParam({ name: "sessionId", description: "본인확인 요청 ID" })
  linkVerification(
    @CurrentUser() user: User,
    @Param("sessionId", ParseUUIDPipe) sessionId: string,
    @Body() dto: LinkKcbVerificationDto,
  ) {
    return this.service.linkVerification(user.id, sessionId, dto.state);
  }

  @Get("me")
  @UseGuards(BetterAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: "현재 user의 최신 본인확인 결과 (없으면 null)" })
  getMyVerification(@CurrentUser() user: User) {
    return this.service.getUserVerification(user.id);
  }

  @Post("callback")
  @ApiOperation({ summary: "KCB callback 검증" })
  @ApiResponse({
    status: 201,
    description: "검증 후 갱신된 KCB 본인확인 세션",
    schema: identityVerificationSessionOpenApiSchema,
  })
  callback(@Body() body: Record<string, unknown>, @Query() query: Record<string, string>) {
    return this.service.handleProviderResult(toProviderResultInput(body, query));
  }

  @Post("return")
  @ApiOperation({ summary: "KCB return 결과 검증" })
  @ApiResponse({
    status: 201,
    description: "검증 후 갱신된 KCB 본인확인 세션",
    schema: identityVerificationSessionOpenApiSchema,
  })
  returnFromProvider(
    @Body() body: Record<string, unknown>,
    @Query() query: Record<string, string>,
  ) {
    return this.service.handleProviderResult(toProviderResultInput(body, query));
  }

  /**
   * Browser-facing return target for the KCB popup (set as KCB_STANDARD_RETURN_URL).
   * KCB redirects the popup window here with `mdl_tkn`; we verify and return a tiny
   * HTML page that notifies the opener (same-origin postMessage) and closes itself.
   * Excluded from OpenAPI: it is consumed by the KCB popup browser, not the API client.
   */
  @All("popup-return")
  @ApiExcludeEndpoint()
  @Header("content-type", "text/html; charset=utf-8")
  @Header("cache-control", "no-store")
  async popupReturn(
    @Body() body: Record<string, unknown> | undefined,
    @Query() query: Record<string, string>,
  ): Promise<string> {
    const merged: Record<string, unknown> = { ...query, ...(body ?? {}) };
    const moduleToken = stringValue(merged.MDL_TKN) ?? stringValue(merged.mdl_tkn);
    try {
      // Prefer mdl_tkn correlation (KCB always returns it; does not depend on the return
      // URL query string surviving the redirect). Fall back to sessionId/state/nonce.
      const result = moduleToken
        ? await this.service.handleProviderResultByModuleToken(
            moduleToken,
            popupProviderPayload(merged),
          )
        : await this.service.handleProviderResult(toPopupReturnInput(body ?? {}, query));
      return renderPopupReturnHtml(result.id, result.status);
    } catch (error) {
      // Never surface raw provider/internal detail to the popup; map to a stable status only.
      toPublicKcbError(error);
      const sessionId = stringValue(merged.sessionId) ?? "";
      return renderPopupReturnHtml(sessionId, "failed");
    }
  }

  @Post("custom/start")
  @ApiOperation({ summary: "KCB 커스텀형 시작 (로그인 불필요). 공식 허용 전에는 차단" })
  customStart(@Body() dto: CreateKcbIdentitySessionDto) {
    return this.service.createSession(null, { ...dto, mode: "custom" });
  }

  @Post("custom/verify")
  @ApiOperation({ summary: "KCB 커스텀형 검증. 공식 허용 전에는 차단" })
  customVerify(@Body() body: Record<string, unknown>, @Query() query: Record<string, string>) {
    return this.service.handleProviderResult(toProviderResultInput(body, query));
  }
}

function toProviderResultInput(body: Record<string, unknown>, query: Record<string, string>) {
  const sessionId = stringValue(body.sessionId) ?? query.sessionId;
  const state = stringValue(body.state) ?? query.state;
  const nonce = stringValue(body.nonce) ?? query.nonce;
  const providerPayload = Object.fromEntries(
    Object.entries(body).filter(
      ([key]) => key !== "sessionId" && key !== "state" && key !== "nonce",
    ),
  );
  return kcbCallbackInputSchema.parse({
    sessionId,
    state,
    nonce,
    providerPayload,
  });
}

function stringValue(value: unknown): string | undefined {
  return typeof value === "string" ? value : undefined;
}

const RESERVED_RESULT_KEYS = new Set(["sessionId", "state", "nonce"]);

/**
 * Popup return can arrive as a POST form (mdl_tkn in body) or a GET (mdl_tkn in query),
 * while we carry sessionId/state/nonce on the return URL query string. Merge both, with
 * body taking precedence, so the same handler works regardless of KCB's redirect method.
 */
function toPopupReturnInput(body: Record<string, unknown>, query: Record<string, string>) {
  const merged: Record<string, unknown> = { ...query, ...body };
  const sessionId = stringValue(merged.sessionId);
  const state = stringValue(merged.state);
  const nonce = stringValue(merged.nonce);
  const providerPayload = Object.fromEntries(
    Object.entries(merged).filter(([key]) => !RESERVED_RESULT_KEYS.has(key)),
  );
  return kcbCallbackInputSchema.parse({ sessionId, state, nonce, providerPayload });
}

// Provider payload for the mdl_tkn correlation path — everything except our own
// sessionId/state/nonce carriers (KCB's mdl_tkn + result fields remain).
function popupProviderPayload(merged: Record<string, unknown>): Record<string, unknown> {
  return Object.fromEntries(
    Object.entries(merged).filter(([key]) => !RESERVED_RESULT_KEYS.has(key)),
  );
}

const POPUP_RESULT_MESSAGE_TYPE = "kcb:identity-result";

/**
 * Minimal self-closing page shown inside the KCB popup after verification.
 * Carries only the session id and a stable status (no name/phone/CI/DI) and posts it
 * to the opener using the same origin, so the host page can refresh its session view.
 */
function renderPopupReturnHtml(sessionId: string, status: string): string {
  const payload = embedJson({ type: POPUP_RESULT_MESSAGE_TYPE, sessionId, status });
  return `<!doctype html>
<html lang="ko">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>KCB</title></head>
<body style="font-family:system-ui,-apple-system,sans-serif;display:flex;align-items:center;justify-content:center;min-height:100vh;margin:0;color:#374151">
<p style="font-size:14px">본인확인 결과를 처리했습니다. 이 창은 자동으로 닫힙니다.</p>
<script>
(function(){
  var payload = ${payload};
  try { if (window.opener && !window.opener.closed) { window.opener.postMessage(payload, window.location.origin); } } catch (e) {}
  setTimeout(function(){ try { window.close(); } catch (e) {} }, 600);
})();
</script>
</body>
</html>`;
}

// JSON for inline <script> — escape sequences that could break out of the script context.
function embedJson(value: unknown): string {
  return JSON.stringify(value).replace(
    /[<>\u2028\u2029]/g,
    (char) => `\\u${char.charCodeAt(0).toString(16).padStart(4, "0")}`,
  );
}
