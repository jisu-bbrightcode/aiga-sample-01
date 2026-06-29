# Server Registry Reference

서버: `apps/server/`

## App Router

### 타입 정의 (`packages/features/app-router.ts`)

20개 이상 feature/common 라우터를 조합하여 `AppRouter` **타입만** export. (TS2742 방지를 위해 값은 export하지 않음)

> **참고**: payment feature는 큰 `PaymentProvider` Strategy로 묶지 않는다. `PaymentModule.forRoot(env)`가 Polar와 INICIS provider module을 독립 등록하고, 공통화는 checkout/refund/status 같은 작은 capability 타입으로 제한한다.

- `AppRouter`: 클라이언트 타입 import용 (`import type { AppRouter } from "@repo/features/app-router"`)

### 런타임 라우터 (`apps/server/src/trpc/router.ts`)

서버에서 동일한 feature/common 라우터를 직접 import하여 런타임 `trpcRouter` 조립.

- `trpcRouter`: 런타임 라우터 (타입 `AppRouter`로 annotate)
- `TrpcRouter`: `AppRouter` re-export

## NestJS Module 등록 (`app.module.ts`)

경로: `apps/server/src/app.module.ts`

새 feature 모듈 추가 시 `imports` 배열의 `// ATLAS:MODULES` 블록에 등록.

## Video Lecture

- Module: `VideoLectureModule`
- Import: `@flotter/features/video-lecture`
- Registered in `apps/server/src/app.module.ts`
- REST prefix: `/api/video-*`, `/api/admin/video-lectures`, `/api/webhooks/cloudflare-stream`
- OpenAPI: Nest Swagger decorators on `VideoLectureController`, `VideoLectureAdminController`, `CloudflareStreamWebhookController`

| 모듈                      | Import 경로                           | 설명                                                                                                                                                   |
| ------------------------- | ------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `BlogModule`              | `@repo/features/blog`                 | 블로그                                                                                                                                                |
| `OperatorChatModule`      | `@repo/features/operator-chat`        | 운영 오퍼레이터 챗. Actor/thread/message/list preference 서비스와 `/api/operator-chat/*` REST controller를 등록한다. 기존 `/api/character-chat/*`는 호환 경로로 함께 유지한다. |
| `CommentModule`           | `@repo/features/comment`              | 댓글                                                                                                                                                  |
| `CommonFeatureModule`     | `@repo/features/_common`              | settings 공통 REST API. user preferences/profile, organization settings, settings projects controller를 등록한다.                                      |
| `CommunityModule`         | `@repo/features/community`            | 커뮤니티                                                                                                                                              |
| `EmailModule`             | `@repo/features/email`                | 이메일. 인증/비밀번호/Magic Link/워크스페이스 초대 발송 sender 주입을 위해 항상 등록한다. `RESEND_API_KEY`는 발송 시점에 검증하며, 누락되어도 core auth/API 부팅은 막지 않는다. |
| `FeedbackModule`          | `@repo/features/feedback`             | 인앱 제품 피드백 REST API. Featurebase env 미설정 시 제출 결과를 `skipped`로 반환한다.                                                                |
| `IdentityVerificationModule` | `@repo/features/identity-verification` | KCB/Ok-name 본인확인 reusable capability. `/api/identity-verifications/kcb/*`와 `/api/admin/identity-verifications/*` REST endpoint를 제공하고 Java adapter health/JAR/license/native readiness를 노출한다. |
| `MessageSendingModule`    | `@repo/features/message-sending`      | SOLAPI 메시지 발송 admin feature. `SOLAPI_ENABLED=true`와 placeholder 없는 SOLAPI env가 있을 때만 조건부 등록한다. 비활성/불완전 상태에서는 message-sending/admin/webhook route가 등록되지 않는다. |
| `NotificationModule`      | `@repo/features/notification`         | 알림                                                                                                                                                  |
| `OnboardingModule`        | `@repo/features/onboarding`           | 온보딩                                                                                                                                                |
| `PaymentModule`           | `@repo/features/payment`              | 결제 shell. Polar 또는 INICIS env 중 하나가 완전할 때 조건부 등록하며, 내부에서 provider별 module을 독립 등록한다. env가 모두 없거나 불완전하면 결제 provider/webhook route는 비활성화되지만 core auth/API 부팅은 막지 않는다. |
| `ProjectModule`           | `@repo/features/project`              | Product Builder 프로젝트 메타 CRUD. 보관은 `archivedAt`, 영구 삭제는 `project.permanentlyDelete`로 분리                                                       |
| `ReactionModule`          | `@repo/features/reaction`             | 리액션                                                                                                                                                |
| `ScheduledJobModule`      | `@repo/features/scheduled-job`        | 스케줄러                                                                                                                                              |
| `StoryQuestModule`        | `@repo/features/story-quest`          | CRPG Quest Authoring MVP. 세계 상태, Quest, Objective, Journal, 문서 link CRUD를 제공한다                                                            |
| `LocalizationModule`      | `@repo/features/localization`         | 번역/언어 관리                                                                                                                                        |
| `StoryModule`             | `@repo/features/story`                | 스토리 로어/초안/태그/관계 CRUD                                                                                                                       |

## tRPC Router 등록 (`app-router.ts`)

경로: `packages/features/app-router.ts`

모든 라우터가 `@repo/features/app-router`에서 통합. 새 feature 라우터 추가 시 이 파일에 등록.

| 라우터 키              | Import 경로                                      | 설명                               |
| ---------------------- | ------------------------------------------------ | ---------------------------------- |
| `userPreference`       | `@repo/features/_common/routers/user-preference` | 사용자 환경설정                    |
| `userProfile`          | `@repo/features/_common/routers/user-profile`    | 사용자 프로필                      |
| `organizationSettings` | `@repo/features/_common/routers/organization-settings` | 조직 설정                   |
| `settingsProjects`    | `@repo/features/_common/routers/settings-projects` | 설정 프로젝트 목록/상세. `archivedAt` 기준 active/archived 필터 |
| `operatorChat`        | `@repo/features/operator-chat`                | 운영 오퍼레이터 챗. 신규 REST surface는 `/api/operator-chat/*`, 기존 `/api/character-chat/*`는 호환 경로로 유지 |
| `blog`                 | `@repo/features/blog`                            | 블로그                             |
| `comment`              | `@repo/features/comment`                         | 댓글                               |
| `community`            | `@repo/features/community`                       | 커뮤니티                           |
| `email`                | `@repo/features/email`                           | 이메일                             |
| `feedback`             | `@repo/features/feedback`                        | 인앱 피드백 → Featurebase post dual-write |
| `messageSending`       | `@repo/features/message-sending`                 | SOLAPI 메시지 발송 admin feature |
| `notification`         | `@repo/features/notification`                    | 알림                               |
| `onboarding`           | `@repo/features/onboarding`                      | 온보딩                             |
| `payment`              | `@repo/features/payment`                         | 결제                               |
| `project`              | `@repo/features/project`                         | 프로젝트 메타 CRUD. `archive`와 `permanentlyDelete` 포함 |
| `reaction`             | `@repo/features/reaction`                        | 리액션                             |
| `scheduledJob`         | `@repo/features/scheduled-job`                   | 스케줄러                           |
| `storyQuest`           | `@repo/features/story-quest`                     | CRPG Quest Authoring MVP. `worldState`, `quest`, `objective`, `journal`, 문서 `link` CRUD |
| `localization`         | `@repo/features/localization`                    | 번역/언어 관리                     |
| `story`                | `@repo/features/story`                           | 스토리 로어/초안/태그/관계 CRUD    |

## 서버 부트스트랩

경로: `apps/server/src/main.ts`

- Vercel `product-builder-api` project root: `apps/server`
- Vercel Node.js runtime: 루트와 Vercel 배포 대상 앱 package의 `engines.node`가 현재 Vercel 기본/최신 지원 버전인 `24.x`로 고정되어 프로젝트 설정의 잘못된 Node 버전을 override
- NestJS + Fastify
- REST API: `http://localhost:3002/api`
- tRPC: `http://localhost:3002/trpc`
- Settings REST APIs: `/api/user-preferences`, `/api/user-profile`, `/api/organization-settings`, `/api/settings-projects` are generated into `@repo/api-client` and used by apps/app settings pages during the tRPC migration coexistence period.
- Operator Chat REST APIs: `/api/operator-chat/actors*`, `/api/operator-chat/threads*`, `/api/operator-chat/chat-sessions*`, `/api/operator-chat/chat-list*` provide the Product Builder operator-chat surface. Legacy `/api/character-chat/*` routes remain registered for compatibility. Assistant save/upsert endpoints intentionally remain public like the previous tRPC procedures and accept the stream token in the request body.
- Identity verification REST APIs: `/api/identity-verifications/kcb/*` and `/api/admin/identity-verifications/*` expose KCB session, callback/return, admin list/detail/health/retry/archive. Current KCB validation uses `KCB_MODE=PROD` with the production site code/license during the KCB-approved test period; there is no separate TEST target for this contract.
- Message Sending REST APIs: `/api/message-sending/solapi/messages`, `/api/admin/message-sending/*`, `/api/webhooks/solapi` are registered only when `SOLAPI_ENABLED=true` and the SOLAPI env values are non-placeholder.
- CORS 활성화: `CORS_ORIGINS`가 있으면 쉼표 구분 origin을 사용하고, 없으면 localhost 개발 origin과 `https://product-builder-app.vercel.app`를 기본 허용한다. Vercel Build Output API wrapper는 `OPTIONS` preflight를 Nest 번들 로드 전에 204로 처리하고, runtime bootstrap 실패도 CORS 헤더가 있는 JSON 500으로 반환한다. 서버 env 모듈은 import 시점에 parse하지 않으며, `DATABASE_URL`만 전역 부팅 필수값이다. `OPENAI_API_KEY`, `OPENAI_IMAGE_MODEL`, `GEMINI_API_KEY`, `INNGEST_*`, `BLOB_READ_WRITE_TOKEN`, SOLAPI env는 feature-specific optional env로 취급한다. Product Builder 템플릿에서 provider-backed optional feature는 명시 `{FEATURE}_ENABLED=true`와 placeholder 없는 strict env가 있어야 module/route를 등록한다. Vercel 런타임에서는 `VERCEL` 환경변수를 기준으로 `.env.local` / `.env` 파일 로딩을 건너뛰고, Vercel Environment Variables만 사용한다.
- Vercel Build Output API wrapper는 webpack external로 남긴 native runtime package(`sharp`)와 transitive dependencies를 `.func/node_modules`에 실제 파일로 복사한다. pnpm symlink는 Vercel 함수 파일시스템에서 깨질 수 있으므로 dereference해서 포함한다.
- ValidationPipe (whitelist, transform)
- GlobalExceptionFilter (`@repo/core/error`) — 모든 예외를 구조화된 JSON으로 변환, 5xx는 PostHog `server_error` 자동 캡처
- PostHog 초기화 (`@repo/core/analytics`) — `POSTHOG_API_KEY` 환경변수 존재 시 서버 에러 추적 활성화
- Multipart file upload (10MB limit)
- Helmet 보안 헤더
- Raw body 캡처 (웹훅 서명 검증용, `/api/webhook/` 경로)
- JWT 인증: `parseJwtFromHeader` via Authorization header
- tRPC context: Better Auth cookie session을 해석해 `user`와 `activeOrganizationId`를 함께 전달한다. 프로젝트/설정 프로젝트 라우터는 이 active organization으로 워크스페이스 스코프를 강제한다.
- tRPC `onError`: 5xx 에러 시 `captureServerError`로 PostHog 이벤트 캡처 (requestId 포함)
- Graceful shutdown: SIGTERM/SIGINT 시 `shutdownPostHogServer()` 호출

## Agent Server (별도)

경로: `apps/agent-server/`

Hono 기반 독립 서버로 AI 에이전트 기능을 처리합니다. `server`와는 별도로 동작하며 동일한 PostgreSQL DB를 공유합니다.

- Hono + `@hono/node-server`
- REST API: `http://localhost:3003/api`
- tRPC: `http://localhost:3003/trpc`
- SSE 스트리밍: `POST /api/chat/stream`
- Vercel AI SDK (`ai`, `@ai-sdk/anthropic`, `@ai-sdk/openai`, `@ai-sdk/google`)
- JWT 인증: `parseJwtFromHeader` via Authorization header
- `app.onError()` — 글로벌 에러 핸들러, 구조화된 JSON 응답 + PostHog `server_error` 캡처
- PostHog 초기화 (`@repo/core/analytics`) — `POSTHOG_API_KEY` 환경변수 존재 시 활성화
- tRPC `errorFormatter` — 에러 응답에 `requestId` 포함
- Graceful shutdown: SIGTERM 시 `shutdownPostHogServer()` 호출

### Agent tRPC Router

| 서브 라우터        | 프로시저 | 인증   | 설명                    |
| ------------------ | -------- | ------ | ----------------------- |
| `agents.list`      | Query    | Public | 활성 에이전트 목록      |
| `agents.getById`   | Query    | Public | ID로 조회               |
| `agents.getBySlug` | Query    | Public | Slug로 조회             |
| `agents.create`    | Mutation | Admin  | 에이전트 생성           |
| `agents.update`    | Mutation | Admin  | 에이전트 수정           |
| `agents.delete`    | Mutation | Admin  | 에이전트 삭제 (soft)    |
| `threads.list`     | Query    | Auth   | 내 스레드 목록          |
| `threads.getById`  | Query    | Auth   | 스레드 상세             |
| `threads.create`   | Mutation | Auth   | 스레드 생성             |
| `threads.update`   | Mutation | Auth   | 스레드 수정             |
| `threads.delete`   | Mutation | Auth   | 스레드 삭제             |
| `messages.list`    | Query    | Auth   | 메시지 목록 (커서 기반) |
| `usage.summary`    | Query    | Admin  | 사용량 요약             |
| `usage.byModel`    | Query    | Admin  | 모델별 사용량           |
| `usage.byAgent`    | Query    | Admin  | 에이전트별 사용량       |

### Agent-Server Tools (`apps/agent-server/src/tools/`)

도구 등록: `tool-registry.ts`의 `registerTools()`로 등록, `getToolsForAgent(enabledTools)`로 에이전트별 필터링.

#### Content Studio (`content-studio.tools.ts`)

| 도구                    | 타입  | 설명                                         |
| ----------------------- | ----- | -------------------------------------------- |
| `studio.list`           | Read  | 스튜디오 목록 조회 (ownerId 기반)            |
| `studio.getCanvas`      | Read  | 캔버스 데이터 조회 (토픽/콘텐츠/엣지)        |
| `content.get`           | Read  | 콘텐츠 상세 조회 (SEO 이력 포함)             |
| `content.search`        | Read  | 콘텐츠 제목 검색 (상태 필터)                 |
| `content.create`        | Write | 새 콘텐츠 생성                               |
| `content.update`        | Write | 콘텐츠 수정 (제목/본문/상태/썸네일 등)       |
| `content.schedule`      | Write | 콘텐츠 발행 예약 (ISO 8601)                  |
| `topic.create`          | Write | 토픽(주제 노드) 생성                         |
| `edge.create`           | Write | 노드 간 연결(엣지) 생성                      |
| `seo.getHistory`        | Read  | SEO 이력 스냅샷 조회                         |
| `seo.addSnapshot`       | Write | SEO 메타데이터 스냅샷 추가                   |
| `brandVoice.getProfile` | Read  | 브랜드 보이스 프로필 조회 (톤/금지어/필수어) |

#### Board (`board.tools.ts`)

| 도구               | 타입 | 설명               |
| ------------------ | ---- | ------------------ |
| `board.list`       | Read | 게시판 목록 조회   |
| `board.postSearch` | Read | 게시판 게시물 검색 |

#### Community (`community.tools.ts`)

| 도구               | 타입 | 설명                 |
| ------------------ | ---- | -------------------- |
| `community.search` | Read | 커뮤니티 검색        |
| `community.posts`  | Read | 커뮤니티 게시물 조회 |

#### File (`file.tools.ts`)

| 도구          | 타입 | 설명      |
| ------------- | ---- | --------- |
| `file.search` | Read | 파일 검색 |

#### User (`user.tools.ts`)

| 도구           | 타입 | 설명               |
| -------------- | ---- | ------------------ |
| `user.profile` | Read | 사용자 프로필 조회 |

#### Image Generation (`image-generation/`)

| 도구             | 타입  | 설명                    |
| ---------------- | ----- | ----------------------- |
| `image.generate` | Write | AI 이미지 생성 (Gemini) |
| `image.edit`     | Write | AI 이미지 편집 (Gemini) |

### Agent Seed Scripts

| 스크립트               | 경로                           | 설명                                                               |
| ---------------------- | ------------------------------ | ------------------------------------------------------------------ |
| `blog-writer-agent.ts` | `apps/agent-server/src/seeds/` | 블로그 작성 에이전트 시드 (content-studio 12도구 + image.generate) |

## Feature 추가 체크리스트

1. `packages/features/{name}/` — 모듈, 서비스, tRPC 라우트 생성
2. `packages/drizzle/src/schema/features/{name}/` — DB 스키마 추가
3. `packages/drizzle/src/schema/index.ts` — 스키마 export 추가
4. `packages/features/app-router.ts` — 타입용 라우터 등록
5. `apps/server/src/trpc/router.ts` — 런타임 라우터 등록
6. `apps/server/src/app.module.ts` — NestJS 모듈 등록
7. `apps/app/src/features/{name}/` — 프론트엔드 feature 생성
8. `docs/reference/` — 레퍼런스 문서 업데이트
