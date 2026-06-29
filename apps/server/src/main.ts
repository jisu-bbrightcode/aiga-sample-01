import { loadLocalServerEnv } from "./config/local-env";

loadLocalServerEnv();

import { Readable } from "node:stream";
import helmet from "@fastify/helmet";
import multipart from "@fastify/multipart";
import { ValidationPipe } from "@nestjs/common";
import { NestFactory } from "@nestjs/core";
import { FastifyAdapter, type NestFastifyApplication } from "@nestjs/platform-fastify";
import { SwaggerModule } from "@nestjs/swagger";
import { captureServerError, initPostHogServer, shutdownPostHogServer } from "@repo/core/analytics";
import { type AuthErrorLike, withNormalizedAuthErrorCode } from "@repo/core/auth/error-codes";
import { resolveTrustedOrigins } from "@repo/core/auth/origins";
import { GlobalExceptionFilter } from "@repo/core/error";
import { initOtelSdk, shutdownOtelSdk } from "@repo/core/logger";
import { RequestLoggerInterceptor } from "@repo/core/logger/nestjs";
import { isPolarPaymentConfigured, PolarWebhookController } from "@repo/features/payment";
import { ZodValidationPipe } from "@repo/shared/zod-nestjs";
import type { FastifyInstance } from "fastify";
import { AppModule } from "./app.module";
import { buildSwaggerConfig } from "./swagger.config";

let cachedApp: NestFastifyApplication | null = null;

function normalizeBetterAuthResponseBody(response: Response, body: string) {
  if (!body || response.status < 400) return body || null;

  const contentType = response.headers.get("content-type")?.toLowerCase() ?? "";
  if (!contentType.includes("application/json")) return body;

  try {
    const parsed: unknown = JSON.parse(body);
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return body;

    const hasStatus = Object.hasOwn(parsed, "status");
    const normalized = withNormalizedAuthErrorCode({
      ...(parsed as AuthErrorLike),
      status: hasStatus ? (parsed as AuthErrorLike).status : response.status,
    });

    return JSON.stringify(normalized);
  } catch {
    return body;
  }
}

export async function getApp(): Promise<NestFastifyApplication> {
  if (cachedApp) return cachedApp;
  cachedApp = (await bootstrap()) as NestFastifyApplication;
  return cachedApp;
}

function createFastifyNestApp() {
  return NestFactory.create<NestFastifyApplication>(
    AppModule,
    new FastifyAdapter({
      maxParamLength: 500,
      // Keep a bounded production payload while leaving enough headroom for
      // document saves and media metadata during local development.
      bodyLimit: process.env.NODE_ENV === "production" ? 5_242_880 : 52_428_800,
    }),
  );
}

function initObservability() {
  // OpenTelemetry Logs SDK 초기화
  if (process.env.POSTHOG_API_KEY) {
    initOtelSdk({
      serviceName: "server",
      posthogApiKey: process.env.POSTHOG_API_KEY,
      posthogHost: process.env.POSTHOG_HOST,
    });
  }

  // PostHog 초기화
  if (process.env.POSTHOG_API_KEY) {
    initPostHogServer({
      apiKey: process.env.POSTHOG_API_KEY,
      host: process.env.POSTHOG_HOST ?? "https://us.i.posthog.com",
    });
  }
}

function configureNestApp(app: NestFastifyApplication) {
  // Global prefix for REST API — `/` 는 제외해 Electron OAuth callback 핸드오프 페이지로 사용.
  app.setGlobalPrefix("api", { exclude: ["/"] });

  // CORS — 허용 origin 화이트리스트
  const allowedOrigins = resolveTrustedOrigins(process.env);

  app.enableCors({
    origin: allowedOrigins,
    credentials: true,
    // @fastify/cors 기본값은 CORS-safelisted GET,HEAD,POST 뿐 — REST 전환으로
    // PUT/PATCH/DELETE preflight 가 차단되므로 명시 (tRPC 는 전부 POST 라 미노출).
    methods: ["GET", "HEAD", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
  });

  // Validation — zod DTO(createZodDto)는 ZodValidationPipe 가 schema.parse 로 직접
  // 검증 (unknown key silent strip = 기존 tRPC zod parse 와 동일한 whitelist semantics).
  // class-validator DTO / primitive 는 기존 ValidationPipe 로 위임 (동작 보존).
  // biome-ignore lint/correctness/useHookAtTopLevel: NestJS INestApplication method, not a React hook
  app.useGlobalPipes(
    new ZodValidationPipe(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
        transformOptions: {
          enableImplicitConversion: true,
        },
      }),
    ),
  );

  // Global Exception Filter
  // biome-ignore lint/correctness/useHookAtTopLevel: NestJS INestApplication method, not a React hook
  app.useGlobalFilters(new GlobalExceptionFilter());

  // Request Logger (구조화 로그)
  // biome-ignore lint/correctness/useHookAtTopLevel: NestJS INestApplication method, not a React hook
  app.useGlobalInterceptors(new RequestLoggerInterceptor());
}

function appendRequestHeaders(
  source: Record<string, string | string[] | undefined>,
  target: Headers,
) {
  for (const [key, value] of Object.entries(source)) {
    if (value) target.append(key, Array.isArray(value) ? value.join(", ") : value);
  }
}

function splitSetCookieHeaders(response: Response): string[] {
  type HeadersWithGetSetCookie = Headers & { getSetCookie?: () => string[] };
  const headersWithGet = response.headers as HeadersWithGetSetCookie;
  const rawSetCookies =
    typeof headersWithGet.getSetCookie === "function"
      ? headersWithGet.getSetCookie()
      : [response.headers.get("set-cookie")].filter(
          (value): value is string => typeof value === "string" && value.length > 0,
        );

  // BetterAuth 는 expires 대신 Max-Age 만 쓰므로 attribute 안에 `, ` 가 없다.
  // 따라서 `,\s+(?=cookie-name=)` 패턴으로 cookie 경계만 split.
  return rawSetCookies.flatMap((raw) => raw.split(/,\s+(?=[A-Za-z0-9_.-]+=)/));
}

function registerBetterAuthRoute(fastify: FastifyInstance) {
  // Better Auth handler — catch-all route for /api/auth/*
  // Must be registered BEFORE global prefix takes effect on NestJS routes
  fastify.route({
    method: ["GET", "POST"],
    url: "/api/auth/*",
    async handler(request, reply) {
      try {
        const { auth } = await import("@repo/core/auth/server");
        const proto = (request.headers["x-forwarded-proto"] as string) || "http";
        const url = new URL(request.url, `${proto}://${request.headers.host}`);
        const headers = new Headers();
        appendRequestHeaders(request.headers, headers);
        const req = new Request(url.toString(), {
          method: request.method,
          headers,
          ...(request.body ? { body: JSON.stringify(request.body) } : {}),
        });
        const response = await auth.handler(req);
        // set-cookie 는 multi-value header — Headers.forEach 는 comma-joined string 으로 한 번
        // emit 하지만 set-cookie 만은 spec 상 절대 합치면 안 된다 (브라우저가 첫 값만 파싱).
        // Node 18+ 의 `Headers.getSetCookie()` 는 각 cookie 를 별도 entry 로 반환한다.
        // 일부 auth 응답/프록시는 multi set-cookie 를 comma-joined string 으로 합쳐
        // 전달할 수 있어, comma-joined string 도 다시 split 해야 한다.
        // Node 18+ 표준: Headers.getSetCookie() 가 multi set-cookie 를 분리 반환.
        const setCookieList = splitSetCookieHeaders(response);
        reply.status(response.status);
        response.headers.forEach((value: string, key: string) => {
          const k = key.toLowerCase();
          if (k === "content-length") return;
          // set-cookie 는 아래에서 별도 처리 — comma-join 방지.
          if (k === "set-cookie") return;
          reply.header(key, value);
        });
        // 각 set-cookie 를 개별 header 로 send — multi-cookie 안전.
        for (const cookieValue of setCookieList) {
          reply.header("set-cookie", cookieValue);
        }
        const body = await response.text();
        reply.send(normalizeBetterAuthResponseBody(response, body));
      } catch (err) {
        console.error("[Better Auth] handler error:", err);
        reply.status(500).send(
          withNormalizedAuthErrorCode({
            code: "INTERNAL_AUTH_ERROR",
            status: 500,
          }),
        );
      }
    },
  });
}

function registerSwaggerRoutes(app: NestFastifyApplication, fastify: FastifyInstance) {
  // Swagger (OpenAPI) — JSON spec + inline Swagger UI (CDN)
  const swaggerConfig = buildSwaggerConfig();

  const document = SwaggerModule.createDocument(app, swaggerConfig);

  // JSON spec 엔드포인트
  fastify.get("/api-docs/json", (_req, reply) => {
    reply.send(document);
  });

  // Swagger UI — CDN에서 로드하는 인라인 HTML
  fastify.get("/api-docs", (_req, reply) => {
    reply.type("text/html").send(`<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>Product Builder API - Swagger</title>
  <link rel="stylesheet" href="https://unpkg.com/swagger-ui-dist@5/swagger-ui.css">
</head>
<body>
  <div id="swagger-ui"></div>
  <script src="https://unpkg.com/swagger-ui-dist@5/swagger-ui-bundle.js"></script>
  <script>
    SwaggerUIBundle({
      url: '/api-docs/json',
      dom_id: '#swagger-ui',
      presets: [SwaggerUIBundle.presets.apis, SwaggerUIBundle.SwaggerUIStandalonePreset],
      layout: 'BaseLayout',
      deepLinking: true,
    });
  </script>
</body>
</html>`);
  });
}

function registerRawBodyHook(fastify: FastifyInstance) {
  // Raw body 캡처 (웹훅 서명 검증용)
  // preParsing hook으로 웹훅 경로의 raw body만 저장
  fastify.addHook("preParsing", async (request, _reply, payload) => {
    if (request.url?.startsWith("/api/webhook/") || request.url?.startsWith("/api/webhooks/")) {
      const chunks: Buffer[] = [];
      for await (const chunk of payload as AsyncIterable<Buffer>) {
        chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
      }
      const rawBody = Buffer.concat(chunks).toString("utf-8");
      (request as { rawBody?: string }).rawBody = rawBody;

      // raw body를 다시 스트림으로 반환하여 JSON 파서가 처리 가능하게 함
      return Readable.from(Buffer.from(rawBody));
    }
  });
}

async function registerFastifyPlugins(fastify: FastifyInstance) {
  // Security headers (Helmet)
  await fastify.register(helmet, {
    contentSecurityPolicy: false, // SPA 클라이언트와 호환을 위해 별도 설정
  });

  // Multipart (file upload)
  await fastify.register(multipart, {
    limits: {
      fileSize: 10 * 1024 * 1024, // 10MB
    },
  });
}

function registerPolarWebhook(app: NestFastifyApplication, fastify: FastifyInstance) {
  // Polar webhook — HMAC-verified by PolarWebhookController.
  // The preParsing hook above captures req.rawBody as a utf-8 string for any
  // /api/webhook/* path; we wrap it as a Buffer to match the controller's
  // standardwebhooks-based verifier (which signs the exact bytes Polar sent).
  if (isPolarPaymentConfigured()) {
    const polarWebhook = app.get(PolarWebhookController);
    fastify.post("/api/webhook/polar", async (request, reply) => {
      const rawBodyString = (request as { rawBody?: string }).rawBody;
      const replyAdapter = {
        code(status: number) {
          reply.status(status);
          return this;
        },
        send(body: unknown) {
          return reply.send(body);
        },
      };
      await polarWebhook.handle(
        {
          rawBody: rawBodyString ? Buffer.from(rawBodyString, "utf-8") : undefined,
          headers: request.headers,
        },
        replyAdapter,
      );
    });
  }
}

function registerShutdownHandlers(app: NestFastifyApplication) {
  // Graceful shutdown
  app.enableShutdownHooks();
  process.on("SIGTERM", async () => {
    await shutdownOtelSdk();
    await shutdownPostHogServer();
  });
  process.on("SIGINT", async () => {
    await shutdownOtelSdk();
    await shutdownPostHogServer();
  });

  // Flush OTEL + PostHog on crash so last ~5s of buffered logs are not lost
  async function flushAndExit(label: string, err: unknown): Promise<void> {
    console.error(`[${label}]`, err);
    const e = err instanceof Error ? err : new Error(String(err));
    try {
      captureServerError({
        service: "server",
        path: "process",
        method: "process",
        statusCode: 500,
        errorCode: label === "uncaughtException" ? "UNCAUGHT_EXCEPTION" : "UNHANDLED_REJECTION",
        errorMessage: e.message,
        stack: e.stack,
      });
    } catch {
      // best-effort capture
    }
    try {
      // flush 를 3s 안에 끝내거나 포기 — corrupted server 가 무한정 살아있지 않게
      await Promise.race([
        (async () => {
          await shutdownOtelSdk();
          await shutdownPostHogServer();
        })(),
        new Promise<void>((resolve) => setTimeout(resolve, 3000)),
      ]);
    } catch {
      // best-effort flush
    }
    process.exit(1);
  }

  process.on("uncaughtException", (err) => {
    void flushAndExit("uncaughtException", err);
  });
  process.on("unhandledRejection", (reason) => {
    void flushAndExit("unhandledRejection", reason);
  });
}

async function startApp(app: NestFastifyApplication) {
  if (process.env.VERCEL) {
    await app.init();
    await (app.getHttpAdapter().getInstance() as FastifyInstance).ready();
  } else {
    const port = process.env.PORT ?? 3002;
    await app.listen(port, "0.0.0.0");
  }
}

async function bootstrap() {
  initObservability();
  const app = await createFastifyNestApp();
  const fastify = app.getHttpAdapter().getInstance() as FastifyInstance;

  configureNestApp(app);
  registerBetterAuthRoute(fastify);
  registerSwaggerRoutes(app, fastify);
  registerRawBodyHook(fastify);
  await registerFastifyPlugins(fastify);
  registerPolarWebhook(app, fastify);
  registerShutdownHandlers(app);
  await startApp(app);

  return app;
}

if (!process.env.VERCEL) {
  bootstrap();
}
