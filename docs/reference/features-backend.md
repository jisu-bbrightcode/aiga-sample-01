# Features Backend Reference

패키지: `@repo/features` (`packages/features/`)

import 패턴: `import { XxxModule, xxxRouter } from "@repo/features/xxx";`

## Feature 목록

### board

경로: `packages/features/board/`

| 구분    | 이름                                                                 | 설명                 |
| ------- | -------------------------------------------------------------------- | -------------------- |
| Module  | `BoardModule`                                                        | NestJS 모듈          |
| Service | `BoardService`                                                       | 게시판 CRUD          |
| Service | `PostService`                                                        | 게시글 CRUD          |
| tRPC    | `boardRouter`                                                        | 게시판/게시글 라우트 |
| Type    | `CreateBoardInput`, `UpdateBoardInput`, `BoardWithStats`             | 게시판 관련          |
| Type    | `CreatePostInput`, `UpdatePostInput`, `PostWithAuthor`, `PostDetail` | 게시글 관련          |
| Type    | `PaginationOptions`, `PaginatedPosts`                                | 페이지네이션         |

### data-tracker

상태: 제거됨.

현재 worktree에는 `packages/features/data-tracker/` backend feature가 존재하지 않는다. `apps/admin/src/features/data-tracker/` legacy admin surface도 Phase 8 tRPC 철거 중 제거됐다.

### comment

경로: `packages/features/comment/`

| 구분    | 이름             | 설명        |
| ------- | ---------------- | ----------- |
| Module  | `CommentModule`  | NestJS 모듈 |
| Service | `CommentService` | 댓글 CRUD   |
| tRPC    | `commentRouter`  | 댓글 라우트 |

REST controller는 `/api/comment*` endpoint를 제공한다. widgets Phase 7 전환 이후 `packages/widgets/src/comment`는 OpenAPI client를 사용하며, top-level list는 기존 tRPC widget 표시 순서를 보존하기 위해 `CommentService.findByTarget(..., sortOrder: "asc")`로 조회한다.

### operator-chat

경로: `packages/features/operator-chat/` (호환 구현은 `packages/features/character-chat/` 내부 서비스를 재사용)

운영 오퍼레이터 챗 backend surface. Product Builder에서는 신규 API를 `/api/operator-chat/*`로 제공한다. 기존 chat 구현은 저장소 호환 레이어로 남겨 `/api/character-chat/*`도 계속 등록하지만, 신규 클라이언트와 AI Runtime callback은 `/api/operator-chat/*`를 사용한다. streaming은 `createChatSession`이 발급한 `streamToken`을 AI Runtime이 별도 호출에 싣는 구조다. `saveAssistant`/`upsertAssistant`는 AI Runtime callback을 위해 public endpoint로 유지한다.

| 구분       | 이름                            | 설명 |
| ---------- | ------------------------------- | ---- |
| Module     | `OperatorChatModule`            | Actor, thread/message, list preference 서비스와 REST controller 등록 |
| Controller | `OperatorChatController`        | REST API (`/api/operator-chat/*`) — BetterAuthGuard, Swagger DTO 적용 |
| Controller | `OperatorChatPublicController`  | AI Runtime assistant save/upsert public REST callback |
| Service    | `ActorService`                  | 운영 오퍼레이터 actor 준비/재활성화/비활성화, greeting 생성 |
| Service    | `ThreadService`                 | thread 생성, user message 저장, AI runtime streamToken/snapshot 발급 |
| Compat     | `CharacterChatController`       | 기존 `/api/character-chat/*` 호환 경로 |
| Const      | `DEFAULT_CHARACTER_CHAT_MODEL`  | AI Runtime Gateway 정책 기본값 `gateway` / `openai/gpt-4o-mini` |

#### REST API (Swagger 적용)

| 엔드포인트 | 메서드 | 인증 | 설명 |
| ---------- | ------ | ---- | ---- |
| `/api/operator-chat/actors/prepare` | POST | Better Auth | 운영 오퍼레이터 actor 준비/재활성화 |
| `/api/operator-chat/actors/by-character/:characterId` | GET | Better Auth | 기존 캐릭터 소스 ID로 actor 조회 (`null` 허용) |
| `/api/operator-chat/actors/:actorId/disable` | POST | Better Auth | actor 비활성화 |
| `/api/operator-chat/actors?projectId=` | GET | Better Auth | 프로젝트 operator actor 목록 조회 |
| `/api/operator-chat/chat-list/hide` | POST | Better Auth | 오퍼레이터 챗 목록 항목 숨김 |
| `/api/operator-chat/chat-list/show` | POST | Better Auth | 오퍼레이터 챗 목록 항목 표시 |
| `/api/operator-chat/chat-list/hidden-actor-ids?projectId=` | GET | Better Auth | 숨긴 actor ID 목록 조회 |
| `/api/operator-chat/chat-list/last-opened` | PUT | Better Auth | 마지막으로 연 thread 저장 |
| `/api/operator-chat/chat-list/last-opened?actorId=` | GET | Better Auth | 마지막으로 연 thread 조회 |
| `/api/operator-chat/threads?projectId=&characterId=` | GET | Better Auth | 오퍼레이터 챗 thread 목록 조회 |
| `/api/operator-chat/threads` | POST | Better Auth | 오퍼레이터 챗 thread 생성 |
| `/api/operator-chat/threads/:threadId/messages` | GET | Better Auth | thread 메시지 목록 조회 |
| `/api/operator-chat/chat-sessions` | POST | Better Auth | 사용자 메시지 저장 + streamToken 발급 |
| `/api/operator-chat/chat-sessions/assistant/save` | POST | Public + streamToken payload | AI Runtime assistant 최종 메시지 저장 |
| `/api/operator-chat/chat-sessions/assistant/upsert` | PUT | Public + streamToken payload | AI Runtime assistant streaming 메시지 upsert |

#### 모델 기본값

Actor 생성, 재활성화 스냅샷, 소스 문서 갱신 스냅샷은 `DEFAULT_CHARACTER_CHAT_MODEL`을 사용한다. `actorSnapshotData.modelProvider/modelName`은 호환 필드로 AI Runtime에 전달되지만, 실제 모델 선택과 fallback chain은 AI Runtime의 Vercel AI Gateway 환경변수(`AI_GATEWAY_MODEL`, `AI_GATEWAY_FALLBACK_MODELS`)가 소유한다. 기존 `anthropic` / `claude-3-5-haiku-20241022` 및 중간 OpenAI 기본값 actor는 `0036_character_chat_gateway_model` migration으로 Gateway 기본값으로 전환한다.

### feedback

경로: `packages/features/feedback/`

| 구분    | 이름                              | 설명                                                                 |
| ------- | --------------------------------- | -------------------------------------------------------------------- |
| Module  | `FeedbackModule`                  | NestJS 모듈. `FeedbackController` 등록                               |
| Controller | `FeedbackController`           | REST API (`POST /api/feedback`) — BetterAuthGuard, Swagger DTO 적용 |
| Service | `submitFeedbackToFeaturebase`     | Featurebase REST API `POST /v2/posts`로 인앱 피드백 post 생성        |
| tRPC    | `feedbackRouter`                  | `submit` protected mutation. Featurebase env 미설정 시 skipped 반환 |
| DTO     | `SubmitFeedbackDto`               | tRPC/REST 공용 입력 DTO                                              |
| DTO     | `SubmitFeedbackResponseDto`       | `created`/`skipped` 제출 결과 DTO                                    |

#### REST API (Swagger 적용)

| 엔드포인트 | 메서드 | 인증 | 설명 |
| ---------- | ------ | ---- | ---- |
| `/api/feedback` | POST | Better Auth | 제품 피드백 제출. Featurebase env 미설정 시 `skipped` 반환 |

### _common settings

경로: `packages/features/_common/`

설정 화면 공통 backend surface. Phase 3 REST 전환으로 기존 `_common` tRPC router 4개(`userPreference`, `userProfile`, `organizationSettings`, `settingsProjects`)에 대응하는 NestJS controller/service/module이 추가되었다. `CommonFeatureModule`은 `apps/server/src/app.module.ts`에 등록되며, 앱 settings 화면은 OpenAPI 생성 클라이언트(`$api`/`apiClient`)를 사용한다.

| 구분       | 이름                             | 설명 |
| ---------- | -------------------------------- | ---- |
| Module     | `CommonFeatureModule`            | `_common` settings REST controller/service 등록 |
| Controller | `UserPreferenceController`       | `/api/user-preferences/*` — key-value preference get/set/getAll |
| Controller | `UserProfileController`          | `/api/user-profile/*` — me/name/avatar/handle/bio |
| Controller | `OrganizationSettingsController` | `/api/organization-settings/*` — org update/logo/metadata/billing/membership/members/delete |
| Controller | `SettingsProjectsController`     | `/api/settings-projects/*` — active workspace scoped settings project list/detail |
| Service    | `UserPreferenceService`          | `user_preferences` read/upsert |
| Service    | `UserProfileService`             | Better Auth user + `profiles` mirror update, avatar upload confirm |
| Service    | `OrganizationSettingsService`    | member/admin/owner 권한 검증 후 조직 설정 변경 |
| Service    | `SettingsProjectsService`        | `project_projects.organization_id = activeOrganizationId` 스코프 강제 |
| tRPC       | `_common/routers/*`              | Phase 3 공존용. apps/app settings 사용처는 REST로 전환 완료 |

#### REST API (Swagger 적용)

| 엔드포인트 | 메서드 | 인증 | 설명 |
| ---------- | ------ | ---- | ---- |
| `/api/user-preferences` | GET | Better Auth | 사용자 preference 전체 map |
| `/api/user-preferences/:key` | GET, PUT | Better Auth | preference 단건 조회/저장 |
| `/api/admin/users?limit=&offset=` | GET | Better Auth + Admin role | 관리자용 사용자 메타 목록. `users`/`profiles`/`user_roles`를 읽기 전용으로 조회하며, community ban 같은 도메인 제재 상태는 포함하지 않음 |
| `/api/user-profile/me` | GET | Better Auth | 내 프로필 조회 (`null` 허용) |
| `/api/user-profile/name` | PATCH | Better Auth | 이름 변경 |
| `/api/user-profile/avatar/upload-url` | POST | Better Auth | 아바타 presigned upload URL 발급 |
| `/api/user-profile/avatar/confirm` | POST | Better Auth | 아바타 public URL 저장 |
| `/api/user-profile/handles/:handle/availability` | GET | Better Auth | 핸들 사용 가능 여부 |
| `/api/user-profile/handle` | PATCH | Better Auth | 핸들 변경 |
| `/api/user-profile/bio` | PATCH | Better Auth | bio 변경 |
| `/api/organization-settings/:organizationId` | PATCH, DELETE | Better Auth | 조직 설정 변경 / owner soft delete |
| `/api/organization-settings/:organizationId/logo/upload-url` | POST | Better Auth | 조직 로고 upload URL 발급 |
| `/api/organization-settings/:organizationId/logo/confirm` | POST | Better Auth | 조직 로고 public URL 저장 |
| `/api/organization-settings/:organizationId/metadata` | GET | Better Auth | billingEmail 등 metadata 조회 |
| `/api/organization-settings/:organizationId/billing-email` | PATCH | Better Auth | billingEmail 변경 |
| `/api/organization-settings/:organizationId/membership` | GET | Better Auth | 내 조직 membership 조회 (`null` 허용) |
| `/api/organization-settings/:organizationId/members` | GET | Better Auth | 멤버 + pending invitation 목록 |
| `/api/settings-projects` | GET | Better Auth | 설정용 프로젝트 목록 (`filter`, `search`) |
| `/api/settings-projects/:projectId` | GET | Better Auth | 설정용 프로젝트 상세 (`null` 허용) |

#### Featurebase env

| Env | 설명 |
| --- | --- |
| `FEATUREBASE_API_KEY` | 서버 전용 Featurebase API key |
| `FEATUREBASE_FEEDBACK_BOARD_ID` | 인앱 피드백을 생성할 Featurebase board id |
| `FEATUREBASE_API_URL` | 기본값 `https://do.featurebase.app` |
| `FEATUREBASE_API_VERSION` | 기본값 `2026-01-01.nova` |
| `FEATUREBASE_FEEDBACK_TAGS` | 기본 태그 외에 추가할 comma-separated tag |
| `FEATUREBASE_FEEDBACK_VISIBILITY` | `public`, `authorOnly`, `companyOnly`; 기본값 `authorOnly` |

### identity-verification

경로: `packages/features/identity-verification/`

KCB/Ok-name 본인확인 reusable backend capability. 표준형과 커스텀형을 API/계약에서 분리하며, 공식 KCB 계약/연동가이드/JAR/license/native artifact가 없으면 성공 payload를 만들지 않고 `configuration_required` / `official_documents_required` 등 안정 blocker code로 차단한다. 현재 KCB는 별도 TEST 환경을 지원하지 않으므로 운영 회원사 코드와 운영 라이선스, `KCB_MODE=PROD`를 사용하고 KCB가 제공한 테스트 기간 동안 live verification으로 검증한다.

| 구분       | 이름                                  | 설명 |
| ---------- | ------------------------------------- | ---- |
| Module     | `IdentityVerificationModule`          | KCB session REST controller, admin controller, adapter client/service 등록 |
| Controller | `IdentityVerificationController`      | `/api/identity-verifications/kcb/*` session/callback/return/custom API |
| Controller | `IdentityVerificationAdminController` | `/api/admin/identity-verifications/*` list/detail/health/retry/archive API |
| Service    | `IdentityVerificationService`         | nonce/state hash, session lifecycle, replay guard, minimal result persistence, admin detail에서 redacted provider events/consents/masked results 제공 |
| Client     | `KcbAdapterClient`                    | Java adapter `/health` 및 `/internal/kcb/*` 호출. provider raw error를 public UI로 넘기지 않음 |
| Registry   | `identityVerificationCapabilityRegistry` | `identity-verification.kcb.*` REUSE capability IDs |

#### REST API (Swagger 적용)

| 엔드포인트 | 메서드 | 인증 | 설명 |
| ---------- | ------ | ---- | ---- |
| `/api/identity-verifications/kcb/sessions` | POST | Public | KCB 본인확인 세션 생성. adapter 미구성 시 blocked code 포함 |
| `/api/identity-verifications/kcb/sessions/:sessionId` | GET | Public | KCB session 조회 |
| `/api/identity-verifications/kcb/sessions/:sessionId/link` | POST | Better Auth | 익명 본인확인 요청을 현재 user에 연결 |
| `/api/identity-verifications/kcb/me` | GET | Better Auth | 현재 user의 최신 본인확인 결과 조회 (`null` 허용) |
| `/api/identity-verifications/kcb/callback` | POST | Public | KCB callback 검증 및 replay 방지 |
| `/api/identity-verifications/kcb/return` | POST | Public | KCB return 검증 및 replay 방지 |
| `/api/identity-verifications/kcb/popup-return` | GET, POST | Public | KCB popup browser return target. HTML 응답은 opener notify 후 self-close |
| `/api/identity-verifications/kcb/custom/start` | POST | Public | 커스텀형 시작. 공식 허용 전 차단 |
| `/api/identity-verifications/kcb/custom/verify` | POST | Public | 커스텀형 검증. 공식 허용 전 차단 |
| `/api/admin/identity-verifications` | GET | Better Auth + Admin | 본인확인 session 목록 |
| `/api/admin/identity-verifications/:id` | GET | Better Auth + Admin | session detail + provider event timeline + consent/masked result/retention state |
| `/api/admin/identity-verifications/kcb/health` | GET | Better Auth + Admin | Java adapter/JAR/license/native readiness |
| `/api/admin/identity-verifications/:id/retry` | POST | Better Auth + Admin | 재시도 필요 상태 기록 |
| `/api/admin/identity-verifications/:id/archive` | POST | Better Auth + Admin | 관리자 archive action 기록 |

### content-studio

경로: `packages/features/content-studio/`

| 구분       | 이름                      | 설명                                                                                                         |
| ---------- | ------------------------- | ------------------------------------------------------------------------------------------------------------ |
| Module     | `ContentStudioModule`     | NestJS 모듈 (AIModule 의존)                                                                                  |
| Service    | `ContentStudioService`    | Studio, Topic, Content, Edge, SEO History, Calendar, Recurrence, Admin CRUD                                  |
| Service    | `StudioAiSuggestService`  | AI 주제 추천, 초안 생성, AI 반복 규칙 관리, 크론 처리                                                        |
| Service    | `StudioBrandVoiceService` | 브랜드 프로필 CRUD, 톤 프리셋 CRUD, AI 금칙어 대체어 추천, 브랜드 컨텍스트 빌드                              |
| Service    | `StudioSeoService`        | AI 키워드 리서치 (LLMService 연동), 내부 링크 후보 조회                                                      |
| Service    | `StudioRepurposeService`  | 콘텐츠 리퍼포징 (LLMService + BrandVoice 연동, 4포맷 변환, 파생 콘텐츠/엣지 관리)                            |
| Controller | `ContentStudioController` | REST API (`/api/content-studio/*`) — JwtAuthGuard, Swagger 데코레이터 적용 (admin/all은 NestAdminGuard 추가) |
| tRPC       | `contentStudioRouter`     | 52개 프로시저 (기존 50 + analysis 2)                                                                         |

#### tRPC 프로시저 (46개)

| 프로시저                         | 설명                                                                   |
| -------------------------------- | ---------------------------------------------------------------------- |
| `studios`                        | 스튜디오 목록 조회                                                     |
| `canvas`                         | 캔버스 데이터 조회                                                     |
| `createStudio`                   | 스튜디오 생성                                                          |
| `updateStudio`                   | 스튜디오 수정                                                          |
| `deleteStudio`                   | 스튜디오 삭제                                                          |
| `createTopic`                    | 토픽 생성                                                              |
| `updateTopic`                    | 토픽 수정                                                              |
| `deleteTopic`                    | 토픽 삭제                                                              |
| `getContent`                     | 콘텐츠 상세 조회                                                       |
| `createContent`                  | 콘텐츠 생성                                                            |
| `updateContent`                  | 콘텐츠 수정                                                            |
| `deleteContent`                  | 콘텐츠 삭제                                                            |
| `updateNodePositions`            | 노드 위치 일괄 업데이트                                                |
| `createEdge`                     | 엣지 생성                                                              |
| `deleteEdge`                     | 엣지 삭제                                                              |
| `seoHistory`                     | SEO 히스토리 조회                                                      |
| `addSeoSnapshot`                 | SEO 스냅샷 추가                                                        |
| `calendarList`                   | 월별 캘린더 콘텐츠 조회                                                |
| `scheduleContent`                | 콘텐츠 예약 발행 설정                                                  |
| `unscheduleContent`              | 예약 발행 해제                                                         |
| `recurrenceList`                 | 반복 규칙 목록 조회                                                    |
| `createRecurrence`               | 반복 규칙 생성                                                         |
| `updateRecurrence`               | 반복 규칙 수정                                                         |
| `deleteRecurrence`               | 반복 규칙 삭제                                                         |
| `toggleRecurrence`               | 반복 규칙 활성/비활성 토글                                             |
| `executeRecurrence`              | 반복 규칙 수동 실행 (콘텐츠 복제)                                      |
| `adminList`                      | 관리자 스튜디오 목록 조회                                              |
| `ai.chat`                        | 콘텐츠 컨텍스트 기반 AI 채팅 (contentId + prompt → 응답 텍스트)        |
| REST: `POST ai/chat/stream`      | SSE 스트리밍 AI 채팅 (동일 입력 → text/event-stream 청크 반환)         |
| `ai.suggest`                     | AI 주제 추천 (topicId → TopicSuggestion[])                             |
| `ai.generate`                    | AI 초안 생성 (suggestion → draft content)                              |
| `ai.suggestAndGenerate`          | 추천 + 초안 한번에 (topicId → draft content)                           |
| `ai.recurrence.list`             | AI 반복 규칙 목록 조회                                                 |
| `ai.recurrence.create`           | AI 반복 규칙 생성                                                      |
| `ai.recurrence.update`           | AI 반복 규칙 수정                                                      |
| `ai.recurrence.delete`           | AI 반복 규칙 삭제                                                      |
| `ai.recurrence.toggle`           | AI 반복 규칙 활성/비활성 토글                                          |
| `brandVoice.getProfile`          | 브랜드 프로필 조회 (activePreset 포함)                                 |
| `brandVoice.upsertProfile`       | 브랜드 프로필 생성/수정                                                |
| `brandVoice.deleteProfile`       | 브랜드 프로필 삭제                                                     |
| `brandVoice.setActivePreset`     | 활성 프리셋 설정/해제                                                  |
| `brandVoice.presets`             | 톤 프리셋 목록 조회 (시스템 + 커스텀)                                  |
| `brandVoice.createPreset`        | 커스텀 톤 프리셋 생성                                                  |
| `brandVoice.updatePreset`        | 커스텀 톤 프리셋 수정                                                  |
| `brandVoice.deletePreset`        | 커스텀 톤 프리셋 삭제                                                  |
| `brandVoice.suggestAlternatives` | AI 금칙어 대체어 추천                                                  |
| `seo.suggestKeywords`            | AI 키워드 리서치 (main/longTail/question/related 키워드 추천)          |
| `seo.studioContents`             | 같은 스튜디오 내 콘텐츠 목록 (내부 링크 후보)                          |
| `repurpose.convert`              | 단일 포맷 리퍼포징 (card_news/short_form/twitter_thread/email_summary) |
| `repurpose.convertBatch`         | 복수 포맷 일괄 리퍼포징                                                |
| `repurpose.listDerived`          | 파생 콘텐츠 목록 조회                                                  |
| `analysis.save`                  | 통합 분석 스냅샷 저장 (SEO/AEO/GEO 점수 + 규칙별 결과)                 |
| `analysis.history`               | 통합 분석 히스토리 조회 (콘텐츠별 분석 이력)                           |

#### REST API (Swagger 적용)

| 엔드포인트                                                 | 메서드 | 인증 | 설명                    |
| ---------------------------------------------------------- | ------ | ---- | ----------------------- |
| `/api/content-studio/contents/:contentId/analysis`         | POST   | JWT  | 통합 분석 스냅샷 저장   |
| `/api/content-studio/contents/:contentId/analysis/history` | GET    | JWT  | 통합 분석 히스토리 조회 |
| `/api/content-studio/ai/chat/stream`                       | POST   | JWT  | SSE 스트리밍 AI 채팅    |

### community

경로: `packages/features/community/`

| 구분       | 이름                                       | 설명                                                                                    |
| ---------- | ------------------------------------------ | --------------------------------------------------------------------------------------- |
| Module     | `CommunityModule`                          | NestJS 모듈 (7개 서비스 + RateLimitService)                                             |
| Service    | `CommunityService`                         | 커뮤니티 CRUD, 가입/탈퇴                                                                |
| Service    | `CommunityPostService`                     | 커뮤니티 게시글 (hot/new/top/rising/controversial 목록 정렬 + 정렬별 cursor pagination) |
| Service    | `CommunityCommentService`                  | 커뮤니티 댓글                                                                           |
| Service    | `CommunityVoteService`                     | 투표 (upvote/downvote)                                                                  |
| Service    | `CommunityKarmaService`                    | 유저 카르마 조회 (단건/배치, communityId 파라미터 제거됨)                               |
| Service    | `CommunityModerationService`               | 모더레이션 (신고, 차단, 삭제)                                                           |
| Service    | `CommunityFeedService`                     | 피드 알고리즘 (hot/new/top)                                                             |
| Controller | `CommunityController`                      | REST API (`/api/community/*`) — 공개/인증 엔드포인트, Swagger 데코레이터                |
| Controller | `CommunityAdminController`                 | REST API (`/api/admin/community/*`) — JwtAuthGuard + NestAdminGuard, Swagger 데코레이터 |
| tRPC       | `communityMainRouter`                      | 8개 서브 라우터 통합 (community, post, comment, vote, karma, moderation, feed, admin)   |
| Helper     | `permission.ts`                            | 권한 확인 헬퍼                                                                          |
| Helper     | `post-list-options.ts`                     | 게시글 목록 sort/limit 런타임 검증 및 기본값                                           |
| DTO        | `CreateCommunityDto`, `UpdateCommunityDto` | 커뮤니티                                                                                |
| DTO        | `CreatePostDto`, `UpdatePostDto`           | 게시글                                                                                  |
| DTO        | `CreateCommentDto`                         | 댓글                                                                                    |
| DTO        | `VoteDto`                                  | 투표                                                                                    |
| DTO        | `CreateReportDto`                          | 신고                                                                                    |
| DTO        | `ModActionDto`                             | 모더레이션 액션                                                                         |

#### Admin tRPC 프로시저 (admin 네임스페이스)

| 프로시저              | 유형     | 설명                                                 |
| --------------------- | -------- | ---------------------------------------------------- |
| `admin.list`          | Query    | 커뮤니티 목록 (offset pagination + 검색 + 타입 필터) |
| `admin.delete`        | Mutation | 커뮤니티 삭제 (hard delete)                          |
| `admin.stats`         | Query    | 전체 시스템 통계 (커뮤니티/멤버/게시글/댓글 수)      |
| `admin.reports`       | Query    | 전체 신고 목록 (cross-community, 상태 필터)          |
| `admin.reportStats`   | Query    | 신고 통계 (pending/reviewing/resolved/dismissed)     |
| `admin.resolveReport` | Mutation | 신고 처리 (removed/banned/warned/dismissed)          |
| `admin.banUser`       | Mutation | 사용자 밴                                            |
| `admin.unbanUser`     | Mutation | 밴 해제                                              |

#### REST API (Swagger 적용)

**Public/Auth** (`/api/community/*`)

| 엔드포인트                   | 메서드 | 인증 | 설명                                                       |
| ---------------------------- | ------ | ---- | ---------------------------------------------------------- |
| `/api/community`             | GET    | -    | 커뮤니티 목록                                              |
| `/api/community/:slug`       | GET    | -    | 커뮤니티 상세                                              |
| `/api/community`             | POST   | JWT  | 커뮤니티 생성                                              |
| `/api/community/:id`         | PUT    | JWT  | 커뮤니티 수정                                              |
| `/api/community/:id/join`    | POST   | JWT  | 커뮤니티 가입                                              |
| `/api/community/:id/leave`   | POST   | JWT  | 커뮤니티 탈퇴                                              |
| `/api/community/posts`       | GET    | -    | 게시물 목록. sort 검증, limit 1-100, 정렬별 nextCursor     |
| `/api/community/posts`       | POST   | JWT  | 게시물 생성                                                |
| `/api/community/posts/:id`   | PUT    | JWT  | 게시물 수정                                                |
| `/api/community/posts/:id`   | DELETE | JWT  | 게시물 삭제                                                |
| `/api/community/comments`    | POST   | JWT  | 댓글 생성                                                  |
| `/api/community/karma`       | GET    | -    | 유저 카르마 조회                                           |
| `/api/community/karma/batch` | GET    | -    | 유저 카르마 배치 조회 (UUID 검증, dedupe, max 50)          |
| `/api/community/vote`        | POST   | JWT  | 투표                                                       |
| `/api/community/feed/*`      | GET    | -    | 피드 (all/popular/home)                                    |
| `/api/community/:id/reports` | POST   | JWT  | 신고 접수                                                  |
| `/api/community/:id/rules`   | GET    | -    | 규칙 목록                                                  |

**Admin** (`/api/admin/community/*`)

| 엔드포인트                                        | 메서드 | 인증  | 설명               |
| ------------------------------------------------- | ------ | ----- | ------------------ |
| `/api/admin/community`                            | GET    | Admin | 전체 커뮤니티 목록 |
| `/api/admin/community/:id`                        | DELETE | Admin | 커뮤니티 삭제      |
| `/api/admin/community/stats`                      | GET    | Admin | 시스템 통계        |
| `/api/admin/community/reports`                    | GET    | Admin | 전체 신고 목록     |
| `/api/admin/community/reports/stats`              | GET    | Admin | 신고 통계          |
| `/api/admin/community/reports/resolve`            | POST   | Admin | 신고 처리          |
| `/api/admin/community/ban`                        | POST   | Admin | 사용자 밴          |
| `/api/admin/community/unban`                      | POST   | Admin | 밴 해제            |

### file-manager

경로: `packages/features/file-manager/`

Cross-cutting concern으로 다른 feature에서 공통 사용 가능한 shared feature.

| 구분       | 이름                     | 설명                                                                                    |
| ---------- | ------------------------ | --------------------------------------------------------------------------------------- |
| Module     | `FileManagerModule`      | NestJS 모듈 (ConfigModule import, OnModuleInit으로 tRPC 서비스 주입)                    |
| Service    | `SupabaseStorageService` | Supabase Storage 연동                                                                   |
| Service    | `FileService`            | 파일 메타데이터 관리 (`@InjectDrizzle()`, `buildPaginatedResult` 사용)                  |
| Controller | `FileController`         | REST API 컨트롤러 (업로드/signed-upload-url 등 multipart 전용, Swagger 데코레이터 적용) |
| tRPC       | `fileManagerRouter`      | 파일 조회/삭제 프로시저 (upload는 REST 유지)                                            |
| DTO        | `UploadFileDto`          | 업로드 요청                                                                             |

#### tRPC 프로시저

| 프로시저       | 유형     | 인증      | 설명                             |
| -------------- | -------- | --------- | -------------------------------- |
| `list`         | Query    | Protected | 내 파일 목록 조회 (페이지네이션) |
| `byId`         | Query    | Public    | ID로 파일 조회                   |
| `delete`       | Mutation | Protected | 내 파일 삭제                     |
| `signedUrl`    | Query    | Protected | 다운로드용 Signed URL 발급       |
| `admin.list`   | Query    | Admin     | 전체 파일 목록 조회              |
| `admin.delete` | Mutation | Admin     | 관리자 파일 삭제                 |

#### REST API (Swagger 적용)

| 엔드포인트                     | 메서드 | 인증  | 설명                            |
| ------------------------------ | ------ | ----- | ------------------------------- |
| `/api/files/upload`            | POST   | JWT   | multipart/form-data 파일 업로드 |
| `/api/files`                   | GET    | JWT   | 내 파일 목록                    |
| `/api/files/admin`             | GET    | Admin | 전체 파일 목록                  |
| `/api/files/:id`               | GET    | -     | ID로 파일 조회                  |
| `/api/files/:id`               | DELETE | JWT   | 내 파일 삭제                    |
| `/api/files/admin/:id`         | DELETE | Admin | 관리자 파일 삭제                |
| `/api/files/:id/signed-url`    | GET    | JWT   | Signed URL 발급                 |
| `/api/files/signed-upload-url` | POST   | JWT   | Direct Upload URL 발급          |

### agent-desk

경로: `packages/features/agent-desk/`

| 구분       | 이름                                                                                                       | 설명                                                                                                                           |
| ---------- | ---------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------ |
| Module     | `AgentDeskModule`                                                                                          | NestJS 모듈 (AIModule import, OnModuleInit)                                                                                    |
| Service    | `SessionService`                                                                                           | 세션/파일/메시지 CRUD                                                                                                          |
| Service    | `FileParserService`                                                                                        | PDF/PPTX/DOCX/이미지/텍스트 파싱                                                                                               |
| Service    | `ChatService`                                                                                              | LLMService 기반 채팅 (스트리밍 지원)                                                                                           |
| Service    | `AnalyzerService`                                                                                          | LLM 기반 요구사항 분석 + 스펙 생성 + 화면 목록 자동 생성                                                                       |
| Service    | `ExecutorService`                                                                                          | Git Worktree + Claude Agent SDK 실행 + PR 생성                                                                                 |
| Service    | `DiagramGeneratorService`                                                                                  | LLM 기반 Mermaid 다이어그램 생성 (자동/단건/분석기반)                                                                          |
| Service    | `CanvasExporterService`                                                                                    | DiagramResult → Obsidian Canvas JSON 변환                                                                                      |
| Service    | `FlowDesignerService`                                                                                      | 화면 흐름 디자이너 (스크린 CRUD, 설정, Mermaid 흐름도, 화면정의서 생성, operator 세션 지원)                                    |
| Service    | `ScreenCandidateService`                                                                                   | 화면 후보 생성 (LLM) + 상세 수정 + 엣지 수정 (Flow Model)                                                                      |
| Service    | `RequirementSourceService`                                                                                 | 요구사항 소스 수집 (manual/파일 추가, 비동기 파싱)                                                                             |
| Service    | `RequirementNormalizerService`                                                                             | LLM 기반 요구사항 정규화 (카테고리, 중복/충돌 감지)                                                                            |
| Controller | `AgentDeskController`                                                                                      | REST API (`/api/agent-desk/*`), Swagger, SSE 스트리밍                                                                          |
| tRPC       | `agentDeskRouter`                                                                                          | 38 프로시저 (세션 5 + 파일 4 + 모델 1 + 채팅 3 + 파이프라인 6 + 다이어그램 3 + 플로우 디자이너 7 + 화면후보 5 + 소스/정규화 4) |
| DTO        | `CreateSessionDto`, `SendMessageDto`, `ConfirmUploadDto`                                                   | 세션/메시지/파일 관련                                                                                                          |
| DTO        | `AnalyzeDto`, `ExecuteDto`, `CancelExecutionDto`                                                           | 파이프라인 관련                                                                                                                |
| DTO        | `GenerateDiagramsDto`, `GenerateSingleDiagramDto`, `ExportToCanvasDto`                                     | 다이어그램/캔버스 관련                                                                                                         |
| DTO        | `AddScreenDto`, `UpdateScreenDto`, `RemoveScreenDto`, `UpdateDesignerSettingsDto`, `CompleteFlowDesignDto` | 플로우 디자이너 관련                                                                                                           |
| DTO        | `GenerateScreenCandidatesDto`, `UpdateScreenCandidateDto`, `UpdateFlowEdgeDto`                             | 화면 후보 생성/수정, 엣지 수정                                                                                                 |
| DTO        | `SelectCanvasNodeDto`, `SelectCanvasEdgeDto`                                                               | 캔버스 노드/엣지 선택 (프론트엔드 연동)                                                                                        |
| DTO        | `AddRequirementSourceDto`, `ListRequirementSourcesDto`                                                     | 요구사항 소스 관련                                                                                                             |
| DTO        | `NormalizeRequirementsDto`, `ListNormalizedRequirementsDto`                                                | 요구사항 정규화 관련                                                                                                           |
| Type       | `SessionType`, `SessionStatus`, `MessageRole`, `ParsedFileResult`                                          | API 타입                                                                                                                       |
| Type       | `AnalysisResult`, `AnalysisFeature`, `ExecutionEvent`, `ExecutionStatus`                                   | 파이프라인 타입                                                                                                                |
| Type       | `DiagramType`, `DiagramResult`, `DiagramGenerationResult`                                                  | 다이어그램 타입                                                                                                                |
| Type       | `CanvasNode`, `CanvasEdge`, `CanvasData`, `CanvasExportResult`                                             | Obsidian Canvas 타입                                                                                                           |
| Type       | `FlowScreen`, `FlowEdge`, `FlowData`, `ScreenDetail`, `PanelState`, `PanelMode`                            | 플로우 디자이너/캔버스 타입                                                                                                    |

#### tRPC 프로시저 (15개)

| 프로시저                      | 유형     | 설명                                                   |
| ----------------------------- | -------- | ------------------------------------------------------ |
| `createSession`               | Mutation | 세션 생성 + 웰컴 메시지 자동 추가                      |
| `getSession`                  | Query    | 세션 상세 (파일 + 메시지 포함)                         |
| `listSessions`                | Query    | 내 세션 목록 (타입별 필터)                             |
| `deleteSession`               | Mutation | 세션 삭제                                              |
| `updateSessionStatus`         | Mutation | 세션 상태 변경                                         |
| `confirmUpload`               | Mutation | 파일 메타데이터 등록                                   |
| `removeFile`                  | Mutation | 파일 삭제                                              |
| `parseFile`                   | Mutation | 파일 파싱 (텍스트 추출)                                |
| `getFiles`                    | Query    | 세션 파일 목록                                         |
| `sendMessage`                 | Mutation | 메시지 전송 + AI 응답 생성                             |
| `getMessages`                 | Query    | 대화 이력 조회                                         |
| `updateMessageFeedback`       | Mutation | 메시지 피드백 (좋아요/싫어요) 저장                     |
| `analyze`                     | Mutation | 요구사항 분석 (LLM)                                    |
| `execute`                     | Mutation | 스펙 생성 + 실행 시작                                  |
| `cancelExecution`             | Mutation | 실행 취소 (AbortController)                            |
| `getExecution`                | Query    | 실행 상태 조회                                         |
| `getLatestExecution`          | Query    | 최신 실행 기록 조회                                    |
| `generateDiagrams`            | Mutation | 자동 다이어그램 생성 (2~5개, Mermaid)                  |
| `generateSingleDiagram`       | Mutation | 특정 유형 다이어그램 단건 생성                         |
| `generateFromAnalysis`        | Mutation | 분석 결과 기반 다이어그램 생성                         |
| `exportToCanvas`              | Mutation | 다이어그램 생성 + Obsidian Canvas 변환                 |
| `exportAnalysisToCanvas`      | Mutation | 분석 기반 다이어그램 + Canvas 변환                     |
| `generateScreensFromAnalysis` | Mutation | 분석 결과 → 화면 목록 자동 생성 (LLM)                  |
| `getFlowData`                 | Query    | 플로우 디자이너 데이터 조회                            |
| `addScreen`                   | Mutation | 화면 추가                                              |
| `updateScreen`                | Mutation | 화면 정보 수정                                         |
| `removeScreen`                | Mutation | 화면 삭제                                              |
| `updateDesignerSettings`      | Mutation | 디자이너 설정 (플랫폼, 테마)                           |
| `completeFlowDesign`          | Mutation | 화면정의서 초안 생성 (LLM)                             |
| `generateScreenCandidates`    | Mutation | 분석 결과 → 화면/엣지 후보 자동 생성 (LLM, Flow Model) |
| `updateScreenCandidate`       | Mutation | 화면 후보 상세 정보 수정 (ScreenDetail)                |
| `updateFlowEdge`              | Mutation | 엣지 조건/전이유형 수정                                |
| `selectCanvasNode`            | Query    | 캔버스 노드 선택 시 상세 조회                          |
| `selectCanvasEdge`            | Query    | 캔버스 엣지 선택 시 상세 조회                          |
| `getModels`                   | Query    | 사용 가능한 LLM 모델 목록                              |

#### REST 전용 엔드포인트

| 메서드 | 경로                                                       | 설명                                                        |
| ------ | ---------------------------------------------------------- | ----------------------------------------------------------- |
| POST   | `/api/agent-desk/chat/stream`                              | SSE 스트리밍 채팅 (text/event-stream, Fastify raw response) |
| POST   | `/api/agent-desk/chat`                                     | 비스트리밍 채팅 (fallback)                                  |
| POST   | `/api/agent-desk/pipeline/analyze`                         | 요구사항 분석 시작                                          |
| POST   | `/api/agent-desk/pipeline/execute`                         | Feature 구현 실행 (SSE 스트리밍)                            |
| POST   | `/api/agent-desk/pipeline/cancel`                          | 실행 취소                                                   |
| GET    | `/api/agent-desk/pipeline/status/:id`                      | 파이프라인 실행 상태 조회                                   |
| POST   | `/api/agent-desk/diagrams/generate`                        | 자동 다이어그램 생성 (LLM + Mermaid)                        |
| POST   | `/api/agent-desk/diagrams/generate-single`                 | 특정 유형 다이어그램 단건 생성                              |
| POST   | `/api/agent-desk/diagrams/from-analysis`                   | 분석 결과 기반 다이어그램 생성                              |
| POST   | `/api/agent-desk/canvas/export`                            | 다이어그램 → Obsidian Canvas JSON 변환                      |
| POST   | `/api/agent-desk/canvas/export-analysis`                   | 분석 → 다이어그램 → Canvas JSON 변환                        |
| GET    | `/api/agent-desk/flow/:sessionId`                          | 플로우 디자이너 데이터 조회                                 |
| POST   | `/api/agent-desk/flow/:sessionId/screens`                  | 화면 추가                                                   |
| PATCH  | `/api/agent-desk/flow/:sessionId/screens/:screenId`        | 화면 수정                                                   |
| DELETE | `/api/agent-desk/flow/:sessionId/screens/:screenId`        | 화면 삭제                                                   |
| PATCH  | `/api/agent-desk/flow/:sessionId/settings`                 | 디자이너 설정 업데이트                                      |
| POST   | `/api/agent-desk/flow/:sessionId/complete`                 | 화면정의서 초안 생성                                        |
| POST   | `/api/agent-desk/pipeline/generate-screens`                | 분석 결과 → 화면 목록 자동 생성                             |
| POST   | `/api/agent-desk/flow/:sessionId/generate-candidates`      | 화면/엣지 후보 자동 생성 (LLM, Flow Model)                  |
| PATCH  | `/api/agent-desk/flow/:sessionId/screens/:screenId/detail` | 화면 후보 상세 수정 (ScreenDetail)                          |
| PATCH  | `/api/agent-desk/flow/:sessionId/edges/:edgeId`            | 엣지 조건/전이유형 수정                                     |

### family

경로: `packages/features/family/`

| 구분       | 이름                                                                                 | 설명                                                                           |
| ---------- | ------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------ |
| Module     | `FamilyModule`                                                                       | NestJS 모듈 (OnModuleInit으로 tRPC 서비스 주입)                                |
| Service    | `FamilyService`                                                                      | 가족 관리 22 메서드 (Group CRUD 5, Member 관리 6, Child 관리 9, Admin 2)       |
| Controller | `FamilyController`                                                                   | REST API (`/api/family/*`) + Admin (`/api/family/admin/*`), Swagger 데코레이터 |
| tRPC       | `familyRouter`                                                                       | 20 protected + 2 admin (nested `admin` router)                                 |
| DTO        | `CreateGroupInput`, `UpdateGroupInput`, `InviteMemberInput`, `UpdateMemberRoleInput` | 그룹/멤버 관련                                                                 |
| DTO        | `CreateChildInput`, `UpdateChildInput`, `AssignTherapistInput`                       | 아이 관련                                                                      |

#### tRPC 프로시저

**Protected (인증 필요)**

| 프로시저              | 유형     | 설명                                               |
| --------------------- | -------- | -------------------------------------------------- |
| `createGroup`         | Mutation | 가족 그룹 생성 + 생성자를 owner로 등록             |
| `getMyGroups`         | Query    | 내 그룹 목록 (memberCount, childCount 포함)        |
| `getGroup`            | Query    | 그룹 상세 (멤버 + 아이 + 대기 초대 포함)           |
| `updateGroup`         | Mutation | 그룹명 수정 (owner/guardian)                       |
| `deleteGroup`         | Mutation | 그룹 삭제 — soft delete (owner만)                  |
| `inviteMember`        | Mutation | 멤버 초대 — 이메일 기반, 7일 만료 (owner/guardian) |
| `acceptInvitation`    | Mutation | 초대 수락 — 토큰 유효성 + 이메일 매칭              |
| `rejectInvitation`    | Mutation | 초대 거절                                          |
| `updateMemberRole`    | Mutation | 멤버 역할 변경 (owner/guardian)                    |
| `removeMember`        | Mutation | 멤버 제거 (owner/guardian)                         |
| `leaveGroup`          | Mutation | 그룹 탈퇴 (owner 제외)                             |
| `createChild`         | Mutation | 아이 등록 — 인원 제한 체크 (owner/guardian)        |
| `getChildren`         | Query    | 아이 목록 — therapist는 배정 아이만, 만 나이 포함  |
| `getChild`            | Query    | 아이 상세 — therapist 스코핑, 배정 정보 포함       |
| `updateChild`         | Mutation | 아이 정보 수정 (owner/guardian)                    |
| `deactivateChild`     | Mutation | 아이 비활성화 (owner/guardian)                     |
| `reactivateChild`     | Mutation | 아이 재활성화 — 인원 제한 재확인 (owner/guardian)  |
| `assignTherapist`     | Mutation | 치료사 배정 (owner/guardian)                       |
| `unassignTherapist`   | Mutation | 치료사 배정 해제 (owner/guardian)                  |
| `getChildAssignments` | Query    | 아이의 치료사 배정 목록 (owner/guardian)           |

**Admin (admin 네임스페이스)**

| 프로시저               | 유형  | 설명                                 |
| ---------------------- | ----- | ------------------------------------ |
| `admin.listGroups`     | Query | 전체 그룹 목록 (페이지네이션 + 검색) |
| `admin.getGroupDetail` | Query | 그룹 상세 (멤버 + 아이 포함)         |

#### REST API (Swagger 적용)

| 엔드포인트                                           | 메서드 | 인증  | 설명             |
| ---------------------------------------------------- | ------ | ----- | ---------------- |
| `/api/family/groups`                                 | POST   | JWT   | 그룹 생성        |
| `/api/family/groups`                                 | GET    | JWT   | 내 그룹 목록     |
| `/api/family/groups/:id`                             | GET    | JWT   | 그룹 상세        |
| `/api/family/groups/:id`                             | PATCH  | JWT   | 그룹 수정        |
| `/api/family/groups/:id`                             | DELETE | JWT   | 그룹 삭제        |
| `/api/family/groups/:groupId/invite`                 | POST   | JWT   | 멤버 초대        |
| `/api/family/invitations/:token/accept`              | POST   | JWT   | 초대 수락        |
| `/api/family/invitations/:token/reject`              | POST   | JWT   | 초대 거절        |
| `/api/family/groups/:groupId/members/:memberId/role` | PATCH  | JWT   | 멤버 역할 변경   |
| `/api/family/groups/:groupId/members/:memberId`      | DELETE | JWT   | 멤버 제거        |
| `/api/family/groups/:groupId/leave`                  | POST   | JWT   | 그룹 탈퇴        |
| `/api/family/groups/:groupId/children`               | POST   | JWT   | 아이 등록        |
| `/api/family/groups/:groupId/children`               | GET    | JWT   | 아이 목록        |
| `/api/family/children/:childId`                      | GET    | JWT   | 아이 상세        |
| `/api/family/children/:childId`                      | PATCH  | JWT   | 아이 수정        |
| `/api/family/children/:childId/deactivate`           | POST   | JWT   | 아이 비활성화    |
| `/api/family/children/:childId/reactivate`           | POST   | JWT   | 아이 재활성화    |
| `/api/family/children/:childId/assign-therapist`     | POST   | JWT   | 치료사 배정      |
| `/api/family/children/:childId/unassign-therapist`   | POST   | JWT   | 치료사 배정 해제 |
| `/api/family/children/:childId/assignments`          | GET    | JWT   | 치료사 배정 목록 |
| `/api/family/admin/groups`                           | GET    | Admin | 전체 그룹 목록   |
| `/api/family/admin/groups/:id`                       | GET    | Admin | 그룹 상세        |

### hello-world

경로: `packages/features/hello-world/`

| 구분       | 이름                   | 설명              |
| ---------- | ---------------------- | ----------------- |
| Module     | `HelloWorldModule`     | NestJS 모듈       |
| Service    | `HelloWorldService`    | 예제 서비스       |
| Controller | `HelloWorldController` | REST API 컨트롤러 |
| tRPC       | `helloWorldRouter`     | 예제 라우트       |

### message-sending

경로: `packages/features/message-sending/`

SOLAPI 기반 메시지 발송 reuse feature. Product Builder base가 새 프로젝트 템플릿으로 복제되는 구조를 고려해 `SOLAPI_ENABLED=true`와 placeholder 없는 SOLAPI env가 모두 있을 때만 `apps/server`에서 조건부 등록된다. gate가 꺼져 있거나 `.env.example` placeholder가 남아 있으면 message-sending/admin/webhook route는 등록되지 않는다. SOLAPI SDK는 사용하지 않고 provider 계약은 direct REST/HMAC `SolapiClient`에 격리한다. 내부 REST API는 발송 요청/수신자별 메시지/웹훅 이벤트 로그를 Drizzle schema(`message_sending_*`)로 저장한다. 요청/수신자 row는 transaction으로 생성하고, 수신자별 상태 매핑은 SOLAPI `customFields.productBuilderMessageId`에 실은 내부 메시지 row id를 우선 사용한다. `showMessageList: true` 응답의 `messageList`/`failedMessageList`와 이후 웹훅 모두 같은 id로 반영한다. 상세 운영 문서는 `docs/features/message-sending-solapi.md`.

| 구분       | 이름                       | 설명 |
| ---------- | -------------------------- | ---- |
| Module     | `MessageSendingModule`     | NestJS 모듈. `SOLAPI_ENABLED=true` + SOLAPI 설정이 완전할 때 조건부 등록 |
| Provider   | `SolapiClient`             | SOLAPI HMAC-SHA256 인증 및 `send-many/detail` 호출 |
| Service    | `MessageSendingService`    | 발송 idempotency, 로그 저장, 웹훅 이벤트 반영 |
| Controller | `MessageSendingController` | REST API (`/api/message-sending/solapi/*`, `/api/admin/message-sending/*`, `/api/webhooks/solapi`) |
| Config     | `solapi.config.ts`         | `SOLAPI_ENABLED`, `SOLAPI_API_KEY`, `SOLAPI_API_SECRET`, `SOLAPI_DEFAULT_SENDER`, 선택 `SOLAPI_WEBHOOK_SECRET`. 공통 `provider-feature-env` helper로 template placeholder를 거부 |

### notification

경로: `packages/features/notification/`

| 구분       | 이름                                                                                 | 설명                 |
| ---------- | ------------------------------------------------------------------------------------ | -------------------- |
| Module     | `NotificationModule`                                                                 | NestJS 모듈          |
| Service    | `NotificationService`                                                                | 알림 CRUD            |
| Service    | `NotificationEmitterService`                                                         | 알림 발송            |
| Gateway    | `NotificationGateway`                                                                | WebSocket 게이트웨이 |
| Controller | `NotificationController`                                                             | REST API 컨트롤러    |
| tRPC       | `notificationRouter`                                                                 | 알림 라우트          |
| DTO        | `CreateNotificationDto`, `NotificationQueryDto`, `UpdateSettingsDto`, `BroadcastDto` | DTO들                |

### payment

경로: `packages/features/payment/`

| 구분       | 이름                                                                                                                                                                         | 설명                                                                                                                                                                                                                |
| ---------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Module     | `PaymentModule`                                                                                                                                                              | NestJS shell 모듈. `PaymentModule.forRoot(env)`가 provider별 env를 검사해 Polar와 INICIS provider module을 독립 등록한다. provider env가 모두 없으면 apps/server에서 payment feature를 등록하지 않는다.                                           |
| Module     | `PolarPaymentProviderModule`                                                                                                                                                 | 기존 Polar.sh 구독/크레딧/쿠폰/웹훅/cron provider module. Polar env가 완전할 때만 등록된다.                                                                                                                        |
| Module     | `InicisPaymentProviderModule`                                                                                                                                                | KG이니시스 checkout/return/noti/admin provider module. INICIS env가 완전할 때만 등록되며 Polar env 없이도 부팅된다.                                                                                                |
| Provider   | `PolarAdapter`                                                                                                                                                               | Polar.sh REST API 연동. checkout, subscription update/revoke, refund, discount, order/subscription 조회를 담당한다.                                                                                                |
| Provider   | `packages/features/payment/inicis/src/*`                                                                                                                                     | KG이니시스 재사용 provider 모듈. PC 표준결제 checkout/auth/approval/netCancel, noti, 일반 전체취소/부분환불 V2, inquiry V2, masking/config/hash helper를 순수 함수와 HTTP client로 분리한다. 정기결제는 계약/INILite Key 확인 전 blocker이며, 가상계좌 환불은 환불계좌 암호화 key/test vector 확인 전 blocker. |
| Service    | `InicisPaymentService`                                                                                                                                                       | INICIS 주문/이벤트 영속화와 REST controller orchestration. checkout 생성/재사용 충돌 검증, return 승인 전후 local order/MID/OID/MOID/금액 대조, noti IP allowlist 및 idempotency, 관리자 검색/status/기간 필터, 주문 상세 timeline, 취소/부분환불/거래조회/재처리 marker를 처리하며 raw payload는 masked JSON만 저장한다.              |
| Service    | `PlanService`                                                                                                                                                                | 플랜 CRUD, Provider↔DB 양방향 동기화 (syncPlansFromProvider, pushPlansToProvider), Free/Enterprise 플랜 시드, assignPlanToUser (크레딧 할당), inferTier                                                             |
| Service    | `CreditService`                                                                                                                                                              | 크레딧 잔액 조회/차감/추가, 트랜잭션 내역, AI 모델 사용량 크레딧 계산                                                                                                                                               |
| Service    | `ModelPricingService`                                                                                                                                                        | AI 모델별 크레딧 환산 가격 관리                                                                                                                                                                                     |
| Controller | `PaymentController`                                                                                                                                                          | REST API (`/api/payment/*`) — 공개 결제 엔드포인트, Swagger 데코레이터                                                                                                                                              |
| Controller | `PaymentPublicController`                                                                                                                                                    | Phase 5 REST parity controller. 앱 결제 화면의 public catalog/coupon 조회를 `/api/payment/*` REST로 제공한다.                                                                                                      |
| Controller | `WebhookController`                                                                                                                                                          | REST API (`/api/payment/webhook/lemon-squeezy`) — LemonSqueezy 웹훅 수신                                                                                                                                            |
| Controller | `WebhookPolarController`                                                                                                                                                     | REST API (`/api/webhook/polar`) — Polar Standard Webhooks 수신                                                                                                                                                      |
| Controller | `SubscriptionController`                                                                                                                                                     | REST API (`/api/auth/subscription/*`) — JwtAuthGuard, 구독 조회/수정/취소/플랜변경/주문내역/라이선스/크레딧, Swagger 데코레이터                                                                                     |
| Controller | `PaymentAdminController`                                                                                                                                                     | REST API (`/api/admin/payment/*`) — JwtAuthGuard + NestAdminGuard, 상품 동기화/구독/주문/라이선스/플랜(CRUD+동기화)/크레딧/구독자/모델가격 관리, Swagger 데코레이터                                                 |
| Controller | `InicisPublicController`, `InicisOrderPublicController`                                                                                                                      | REST API (`/api/payment/inicis/checkouts`, `/api/payment/inicis/return`, `/api/payment/inicis/callback`, `/api/payment/orders/:orderId`) — INICIS PC 표준결제 생성/인증결과 승인/사용자 주문 상태 조회.              |
| Controller | `InicisWebhookController`                                                                                                                                                    | REST API (`/api/webhooks/inicis/noti`) — INICIS PC/mobile 가상계좌 입금 통보 수신. `PAYMENT_INICIS_NOTI_ALLOWED_IPS`가 source IP와 일치하고 local order/금액 검증이 통과한 경우에만 공식 요구 문자열 `OK`를 반환한다.                                                                                               |
| Controller | `InicisAdminController`                                                                                                                                                      | REST API (`/api/admin/payment/inicis/*`) — 설정 상태, 주문 목록/상세, 이벤트 목록/상세, 전체취소/부분환불, 거래조회, 재처리 marker를 제공한다. 모든 admin mutation은 payment audit log를 남긴다.                                                                         |
| Controller | `CreditApiController`                                                                                                                                                        | 내부 REST API (`/api/internal/credits/*`) — agent-server 연동용                                                                                                                                                     |
| tRPC       | `paymentRouter`                                                                                                                                                              | Public (상품 조회, 체크아웃, 플랜 목록), Protected (구독/라이센스, 플랜 변경, 주문 내역, 크레딧 잔액/내역, 자동충전 설정), Admin (동기화, 환불, 플랜 CRUD/Provider 양방향 동기화/할당, 크레딧/구독자/모델가격 관리) |
| Config     | `payment.config.ts`, `inicis/src/config.ts`, `provider.config.ts`                                                                                                            | Polar와 INICIS 설정을 분리한다. `isPolarPaymentConfigured`, `isInicisPaymentConfigured`, `isAnyPaymentConfigured`가 provider별 조건부 등록 판단용이다.                                                              |
| DTO        | `CreateCheckoutDto`, `UpdateSubscriptionDto`, `CancelSubscriptionDto`, `ValidateLicenseDto`, `RefundOrderDto`, `RefundSubscriptionDto`, `PaymentQueryDto`, `WebhookEventDto` | DTO들                                                                                                                                                                                                               |
| DTO        | `RequestRefundInput`                                                                                                                                                         | 유저 환불 요청 (requestRefundSchema)                                                                                                                                                                                |
| DTO        | `ProcessRefundRequestInput`                                                                                                                                                  | 관리자 환불 요청 처리 (processRefundRequestSchema)                                                                                                                                                                  |
| Type       | `OrderStatus`                                                                                                                                                                | 주문 상태 enum 타입 (`pending \| paid \| failed \| refunded \| partial_refund \| fraudulent`), `@repo/drizzle`에서 export                                                                                           |

> Phase 8 tRPC→REST 전환 상태: `apps/app` 결제 화면은 `/api/payment/*` REST + OpenAPI generated client를 사용한다. `payment.admin.*` 29개는 `/api/admin/payment/*` REST endpoint로 이식됐고 `BetterAuthGuard + BetterAuthAdminGuard` 및 payment audit log 경계를 유지한다. `payment.ai.*` metering sub-router는 내부 metering 범위로 보류한다. Polar webhook은 raw body 검증 때문에 기존 `POST /api/webhook/polar` 수동 Fastify route를 유지한다.

> INICIS reuse 상태: `payment.inicis.checkout`, `payment.inicis.approval`, `payment.inicis.noti`, `payment.inicis.cancel`, `payment.inicis.inquiry`, `payment.inicis.billing.blocker` surface는 `packages/features/payment/inicis/src`에서 export된다. `src/capabilities.ts`의 `INICIS_PAYMENT_CAPABILITIES`가 Product Builder용 capability manifest이며, 공식 source map은 `packages/features/payment/inicis/README.md`에 유지한다. 외부 INICIS field/hash는 공식 manual에서 확인한 값만 구현했고, return/noti는 공식 form-urlencoded POST를 수신한다. 승인/취소/noti는 provider transport 성공과 business 성공코드를 분리하고 local order + event 변경을 transaction으로 묶는다. billing은 merchant billing contract와 INILite Key 검증 전까지 blocker로 남긴다. 가상계좌 환불은 `refundAcctNum` 암호화(`ENC`) 확인 전까지 blocker다. paid/approved INICIS 주문의 entitlement 부여/회수는 Product Builder별 credit/subscription adapter가 필요하므로 재사용 provider 레이어에서는 `inicis_entitlement_adapter_required` blocker로 노출한다.

#### tRPC 프로시저

**Public**

| 프로시저            | 유형     | 설명                |
| ------------------- | -------- | ------------------- |
| `getPlans`          | Query    | 활성 플랜 목록 조회 |
| `getActiveProducts` | Query    | 활성 상품 목록 조회 |
| `createCheckout`    | Mutation | 체크아웃 세션 생성  |

**Protected (인증 필요)**

| 프로시저              | 유형     | 설명                                                                |
| --------------------- | -------- | ------------------------------------------------------------------- |
| `getMySubscription`   | Query    | 내 구독 조회                                                        |
| `updateSubscription`  | Mutation | 구독 수정 (variant 변경, 일시정지 등)                               |
| `cancelSubscription`  | Mutation | 구독 취소                                                           |
| `changePlan`          | Mutation | 플랜 변경 — LS variant 변경 + 크레딧 할당 (업그레이드/다운그레이드) |
| `getMyOrders`         | Query    | 내 주문(결제) 내역 조회 (페이지네이션)                              |
| `getMyLicenses`       | Query    | 내 라이센스 목록                                                    |
| `validateLicense`     | Mutation | 라이센스 키 검증                                                    |
| `getMyBalance`        | Query    | 내 크레딧 잔액 조회                                                 |
| `getMyTransactions`   | Query    | 내 크레딧 사용 내역 (페이지네이션)                                  |
| `updateAutoRecharge`  | Mutation | 자동충전 설정 변경                                                  |
| `checkRefundable`     | Query    | 주문 환불 가능 여부 확인                                            |
| `requestRefund`       | Mutation | 유저 환불 요청 (사유 + 상세 입력)                                   |
| `getMyRefundRequests` | Query    | 내 환불 요청 목록 (페이지네이션)                                    |

**Admin**

| 프로시저                     | 유형     | 설명                                                                   |
| ---------------------------- | -------- | ---------------------------------------------------------------------- |
| `admin.syncProducts`         | Mutation | 상품 동기화 (Provider→DB)                                              |
| `admin.getSubscriptions`     | Query    | 구독 목록 조회 (필터+페이지네이션)                                     |
| `admin.getSubscriptionStats` | Query    | 구독 통계                                                              |
| `admin.refundSubscription`   | Mutation | 구독 환불                                                              |
| `admin.getOrders`            | Query    | 주문 목록 조회                                                         |
| `admin.refundOrder`          | Mutation | 주문 환불                                                              |
| `admin.getLicenses`          | Query    | 라이센스 목록                                                          |
| `admin.getRefundRequests`    | Query    | 환불 요청 목록                                                         |
| `admin.syncPlans`            | Mutation | Provider→DB 플랜 동기화 (variant 매칭, 가격 변환, 로컬 전용 플랜 보호) |
| `admin.pushPlansToProvider`  | Mutation | DB→Provider 플랜 동기화 (Push, variant 가격 업데이트)                  |
| `admin.getAllPlans`          | Query    | 전체 플랜 목록 (비활성 포함)                                           |
| `admin.createPlan`           | Mutation | 플랜 생성                                                              |
| `admin.updatePlan`           | Mutation | 플랜 수정                                                              |
| `admin.assignPlan`           | Mutation | 사용자에게 플랜 할당 (크레딧 자동 배정)                                |
| `admin.getUserCredits`       | Query    | 특정 사용자 크레딧 잔액 조회                                           |
| `admin.getUserTransactions`  | Query    | 특정 사용자 트랜잭션 내역                                              |
| `admin.adjustCredits`        | Mutation | 관리자 수동 크레딧 조정                                                |
| `admin.getSubscribers`       | Query    | 구독자 목록 (profiles JOIN, 페이지네이션 + 검색 + 상태/플랜 필터)      |
| `admin.getModelPricing`      | Query    | AI 모델 가격 목록                                                      |
| `admin.upsertModelPricing`   | Mutation | AI 모델 가격 생성/수정                                                 |
| `admin.processRefundRequest` | Mutation | 환불 요청 처리 (승인/거절)                                             |

#### REST API — Public (Swagger 적용)

| 엔드포인트                           | 메서드 | 인증 | 설명                                                      |
| ------------------------------------ | ------ | ---- | --------------------------------------------------------- |
| `/api/payment/products`              | GET    | -    | 상품 목록                                                 |
| `/api/payment/plans`                 | GET    | -    | 플랜 목록                                                 |
| `/api/payment/top-up-packages`       | GET    | -    | 크레딧 충전 패키지 목록                                   |
| `/api/payment/coupons/preview`       | GET    | -    | 체크아웃 전 쿠폰 검증                                     |
| `/api/payment/checkout`              | POST   | -    | 체크아웃 세션 생성                                        |
| `/api/payment/webhook/lemon-squeezy` | POST   | -    | LemonSqueezy 웹훅 수신                                    |
| `/api/webhook/polar`                 | POST   | -    | Polar 웹훅 수신 (Standard Webhooks)                       |
| `/api/payment/inicis/callback`       | POST   | -    | INICIS 모바일 결제 P_NEXT_URL 콜백 (인증→승인→리다이렉트) |
| `/api/webhook/inicis`                | POST   | -    | INICIS 가상계좌 입금 통보 웹훅                            |

#### REST API — Auth (Swagger 적용)

| 엔드포인트                                          | 메서드 | 인증 | 설명                                |
| --------------------------------------------------- | ------ | ---- | ----------------------------------- |
| `/api/auth/subscription/my`                         | GET    | JWT  | 내 구독 조회                        |
| `/api/auth/subscription/:id`                        | PATCH  | JWT  | 구독 수정                           |
| `/api/auth/subscription/:id/cancel`                 | DELETE | JWT  | 구독 취소                           |
| `/api/payment/me/subscription`                      | GET    | Auth | 내 활성 구독 조회                    |
| `/api/payment/me/credits/balance`                    | GET    | Auth | 내 크레딧 잔액 조회                  |
| `/api/payment/me/credits/history`                    | GET    | Auth | 내 크레딧 내역 조회                  |
| `/api/payment/me/usage`                              | GET    | Auth | 모델별 사용량 통계 조회              |
| `/api/payment/me/invoices`                           | GET    | Auth | 내 인보이스 목록 조회                |
| `/api/payment/checkouts/subscription`                | POST   | Auth | 구독 checkout 생성                   |
| `/api/payment/checkouts/top-up`                      | POST   | Auth | 충전 checkout 생성                   |
| `/api/payment/me/subscription/plan-change-preview`   | GET    | Auth | 플랜 변경 사전 계산                  |
| `/api/payment/me/subscription/change-plan`           | POST   | Auth | 플랜 변경                            |
| `/api/payment/me/subscription/cancel`                | POST   | Auth | 구독 해지                            |
| `/api/payment/me/subscription/uncancel`              | POST   | Auth | 기간 종료 해지 예약 취소             |
| `/api/payment/me/subscription/reactivate`            | POST   | Auth | 연체/유예 구독 재개                  |
| `/api/payment/me/extra-usage/settings`               | GET    | Auth | 추가 사용량 설정 조회                |
| `/api/payment/me/extra-usage/settings`               | PUT    | Auth | 추가 사용량 설정 수정                |
| `/api/payment/me/extra-usage/stats`                  | GET    | Auth | 추가 사용량 통계 조회                |
| `/api/payment/me/extra-usage/manual-topup`           | POST   | Auth | 추가 사용량 수동 충전 checkout 생성  |
| `/api/auth/subscription/change-plan`                | POST   | JWT  | 플랜 변경 (업그레이드/다운그레이드) |
| `/api/auth/subscription/orders`                     | GET    | JWT  | 내 주문(결제) 내역                  |
| `/api/auth/subscription/licenses`                   | GET    | JWT  | 라이선스 목록                       |
| `/api/auth/subscription/licenses/validate`          | POST   | -    | 라이선스 키 검증                    |
| `/api/auth/subscription/credits/balance`            | GET    | JWT  | 크레딧 잔액                         |
| `/api/auth/subscription/credits/transactions`       | GET    | JWT  | 크레딧 사용 내역                    |
| `/api/auth/subscription/orders/:orderId/refundable` | GET    | JWT  | 주문 환불 가능 여부 확인            |
| `/api/auth/subscription/refund-requests`            | POST   | JWT  | 유저 환불 요청                      |
| `/api/auth/subscription/refund-requests`            | GET    | JWT  | 내 환불 요청 목록                   |

#### REST API — Admin (Swagger 적용)

| 엔드포인트                                              | 메서드 | 인증  | 설명                         |
| ------------------------------------------------------- | ------ | ----- | ---------------------------- |
| `/api/admin/payment/products/sync`                      | POST   | Admin | 상품 동기화                  |
| `/api/admin/payment/subscriptions`                      | GET    | Admin | 구독 목록 조회               |
| `/api/admin/payment/subscriptions/stats`                | GET    | Admin | 구독 통계                    |
| `/api/admin/payment/subscriptions/:id/refund`           | POST   | Admin | 구독 환불                    |
| `/api/admin/payment/orders`                             | GET    | Admin | 주문 목록                    |
| `/api/admin/payment/orders/:id/refund`                  | POST   | Admin | 주문 환불                    |
| `/api/admin/payment/licenses`                           | GET    | Admin | 라이선스 목록                |
| `/api/admin/payment/refunds`                            | GET    | Admin | 환불 요청 목록               |
| `/api/admin/payment/plans/sync`                         | POST   | Admin | Provider→DB 플랜 동기화      |
| `/api/admin/payment/plans/push`                         | POST   | Admin | DB→Provider 플랜 동기화      |
| `/api/admin/payment/plans`                              | GET    | Admin | 전체 플랜 목록               |
| `/api/admin/payment/plans`                              | POST   | Admin | 플랜 생성                    |
| `/api/admin/payment/plans/:id`                          | POST   | Admin | 플랜 수정                    |
| `/api/admin/payment/plans/assign`                       | POST   | Admin | 플랜 할당 (크레딧 자동 배정) |
| `/api/admin/payment/credits/:userId`                    | GET    | Admin | 사용자 크레딧 잔액           |
| `/api/admin/payment/credits/:userId/transactions`       | GET    | Admin | 사용자 트랜잭션 내역         |
| `/api/admin/payment/credits/adjust`                     | POST   | Admin | 크레딧 수동 조정             |
| `/api/admin/payment/subscribers`                        | GET    | Admin | 구독자 목록                  |
| `/api/admin/payment/model-pricing`                      | GET    | Admin | 모델 가격 목록               |
| `/api/admin/payment/model-pricing`                      | POST   | Admin | 모델 가격 생성/수정          |
| `/api/admin/payment/refund-requests/:requestId/process` | POST   | Admin | 환불 요청 처리 (승인/거절)   |

#### Credit REST API (agent-server 연동)

| 엔드포인트                        | 메서드 | 인증 | 설명                         |
| --------------------------------- | ------ | ---- | ---------------------------- |
| `/api/internal/credits/check`     | POST   | JWT  | 크레딧 잔액 충분 여부 확인   |
| `/api/internal/credits/deduct`    | POST   | JWT  | 크레딧 차감 (트랜잭션 로그)  |
| `/api/internal/credits/calculate` | POST   | JWT  | AI 모델 사용량 → 크레딧 계산 |

#### coupon (쿠폰 기능 — payment 하위)

경로: `packages/features/payment/coupon/`

| 구분       | 이름                                                                        | 설명                                                                                                |
| ---------- | --------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------- |
| Service    | `CouponService`                                                             | 쿠폰 CRUD, 유효성 검증, 적용, 취소, 환수 (Admin), 사용자별 조회, 통계                               |
| Controller | `CouponAdminController`                                                     | REST API (`/api/admin/coupon/*`) — Admin 쿠폰 관리 (CRUD, 조회, 통계)                               |
| Controller | `CouponUserController`                                                      | REST API (`/api/coupon/*`) — 사용자 쿠폰 조회/적용/취소/유효성 검증                                 |
| tRPC       | couponRouter (payment 라우터 내 `coupon` 네임스페이스)                      | Admin: 쿠폰 CRUD/조회/통계, Protected: 내 쿠폰 조회/유효성 검증/적용/취소, Public: 쿠폰 유효성 검증 |
| DTO        | `CreateCouponDto`, `UpdateCouponDto`, `ValidateCouponDto`, `ApplyCouponDto` | 쿠폰 DTO들                                                                                          |

**Service 메서드:**

| 메서드                                 | 설명                                            |
| -------------------------------------- | ----------------------------------------------- |
| `create(input, adminId)`               | 쿠폰 생성 (코드 중복 검사)                      |
| `update(id, input, adminId)`           | 쿠폰 수정 (관리자)                              |
| `delete(id, adminId)`                  | 쿠폰 삭제                                       |
| `findById(id)`                         | 쿠폰 상세 조회                                  |
| `findAll(filters, pagination)`         | 쿠폰 목록 조회 (상태/코드 필터, 페이지네이션)   |
| `getStatistics(adminId)`               | 쿠폰 사용 통계 (발급/사용/취소 집계)            |
| `validateCoupon(code, input?)`         | 쿠폰 유효성 검증 (상태, 유효기간, 디스카운트율) |
| `applyCoupon(code, userId)`            | 쿠폰 적용 (상환 기록 생성)                      |
| `cancelCoupon(redemptionId, userId)`   | 쿠폰 취소 (상환 기록 soft delete)               |
| `reclaimCoupon(redemptionId, adminId)` | 쿠폰 환수 (관리자 - 상환 기록 hard delete)      |
| `getMyRedemptions(userId, pagination)` | 사용자별 상환 기록 조회                         |

**tRPC 프로시저 (coupon 네임스페이스):**

Public:
| `validateCoupon` | Mutation | 쿠폰 유효성 검증 |

Protected:
| `getMyRedemptions` | Query | 내 쿠폰 상환 기록 조회 |
| `applyCoupon` | Mutation | 쿠폰 적용 |
| `cancelCoupon` | Mutation | 쿠폰 취소 |

Admin:
| `admin.create` | Mutation | 쿠폰 생성 |
| `admin.update` | Mutation | 쿠폰 수정 |
| `admin.delete` | Mutation | 쿠폰 삭제 |
| `admin.list` | Query | 쿠폰 목록 |
| `admin.getById` | Query | 쿠폰 상세 |
| `admin.getStatistics` | Query | 쿠폰 통계 |
| `admin.getRedemptions` | Query | 쿠폰 상환 기록 |
| `admin.reclaim` | Mutation | 쿠폰 환수 (상환 기록 hard delete) |

**REST API — Admin (Swagger 적용)**

| 엔드포인트                                | 메서드 | 인증  | 설명                    |
| ----------------------------------------- | ------ | ----- | ----------------------- |
| `/api/admin/coupon`                       | GET    | Admin | 쿠폰 목록 조회          |
| `/api/admin/coupon`                       | POST   | Admin | 쿠폰 생성               |
| `/api/admin/coupon/:id`                   | GET    | Admin | 쿠폰 상세 조회          |
| `/api/admin/coupon/:id`                   | PATCH  | Admin | 쿠폰 수정               |
| `/api/admin/coupon/:id`                   | DELETE | Admin | 쿠폰 삭제               |
| `/api/admin/coupon/statistics`            | GET    | Admin | 쿠폰 사용 통계          |
| `/api/admin/coupon/redemptions`           | GET    | Admin | 쿠폰 상환 기록 조회     |
| `/api/admin/coupon/:redemptionId/reclaim` | POST   | Admin | 쿠폰 환수 (hard delete) |

**REST API — User (Swagger 적용)**

| 엔드포인트                         | 메서드 | 인증 | 설명              |
| ---------------------------------- | ------ | ---- | ----------------- |
| `/api/coupon/validate`             | POST   | -    | 쿠폰 유효성 검증  |
| `/api/coupon/my-redemptions`       | GET    | JWT  | 내 쿠폰 상환 기록 |
| `/api/coupon/apply`                | POST   | JWT  | 쿠폰 적용         |
| `/api/coupon/:redemptionId/cancel` | DELETE | JWT  | 쿠폰 취소         |

### profile

경로: `packages/features/profile/`

| 구분       | 이름                   | 설명                                                                                                                                                     |
| ---------- | ---------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Module     | `ProfileModule`        | NestJS 모듈                                                                                                                                              |
| Service    | `ProfileService`       | 프로필 CRUD, Admin 유저 관리 (listAll, updateRole, deactivate, reactivate), 약관 CRUD, 회원탈퇴 (checkWithdrawable, withdraw, adminWithdrawalReasons)    |
| Controller | `ProfileController`    | REST API 컨트롤러 (프로필)                                                                                                                               |
| Controller | `TermsController`      | REST API 컨트롤러 — Public: `GET /api/terms` (활성 약관 목록)                                                                                            |
| Controller | `TermsAdminController` | REST API 컨트롤러 — Admin: `GET/POST/PATCH/DELETE /api/admin/terms`                                                                                      |
| tRPC       | `profileRouter`        | me (조회), update (수정), termsList (공개 약관), checkWithdrawable (탈퇴 가능 여부), withdraw (회원탈퇴), admin (유저 관리 + 약관 관리 + 탈퇴 사유 조회) |
| DTO        | `UpdateProfileDto`     | 프로필 수정                                                                                                                                              |
| DTO        | `CreateTermDto`        | 약관 생성 (name, url, isRequired, sortOrder)                                                                                                             |
| DTO        | `UpdateTermDto`        | 약관 수정 (전부 optional + isActive)                                                                                                                     |
| DTO        | `WithdrawInput`        | 회원탈퇴 (withdrawInputSchema)                                                                                                                           |

#### tRPC 프로시저

**Protected**

| 프로시저            | 유형     | 설명                                        |
| ------------------- | -------- | ------------------------------------------- |
| `me`                | Query    | 내 프로필 조회                              |
| `update`            | Mutation | 내 프로필 수정                              |
| `checkWithdrawable` | Query    | 회원탈퇴 가능 여부 확인 (활성 구독 등 체크) |
| `withdraw`          | Mutation | 회원탈퇴 (탈퇴 사유 기록 + 프로필 비활성화) |

**Public**

| 프로시저    | 유형  | 설명                       |
| ----------- | ----- | -------------------------- |
| `termsList` | Query | 활성 약관 목록 조회 (공개) |

**Admin (admin 네임스페이스)**

| 프로시저                  | 유형     | 설명                                                     |
| ------------------------- | -------- | -------------------------------------------------------- |
| `admin.list`              | Query    | 전체 사용자 목록 (페이지네이션 + 검색 + 마케팅동의 필터) |
| `admin.updateRole`        | Mutation | 사용자 역할 변경 (자기 자신 변경 불가)                   |
| `admin.deactivate`        | Mutation | 사용자 비활성화 (자기 자신 비활성화 불가)                |
| `admin.reactivate`        | Mutation | 사용자 재활성화                                          |
| `admin.termsList`         | Query    | 약관 전체 목록 (비활성 포함)                             |
| `admin.termsCreate`       | Mutation | 약관 등록                                                |
| `admin.termsUpdate`       | Mutation | 약관 수정                                                |
| `admin.termsDelete`       | Mutation | 약관 비활성화 (soft delete)                              |
| `admin.withdrawalReasons` | Query    | 회원탈퇴 사유 목록 조회 (페이지네이션)                   |

#### REST API — 회원탈퇴 (Swagger 적용)

| 엔드포인트                              | 메서드 | 인증  | 설명                    |
| --------------------------------------- | ------ | ----- | ----------------------- |
| `/api/profile/withdrawable`             | GET    | JWT   | 회원탈퇴 가능 여부 확인 |
| `/api/profile/withdraw`                 | POST   | JWT   | 회원탈퇴 실행           |
| `/api/profile/admin/withdrawal-reasons` | GET    | Admin | 회원탈퇴 사유 목록 조회 |

### reaction

경로: `packages/features/reaction/`

> **Widget Feature** — 라우트 없음. `targetType`/`targetId` 다형성 패턴으로 모든 Feature에서 임베드 가능.

| 구분    | 이름              | 설명                                                       |
| ------- | ----------------- | ---------------------------------------------------------- |
| Module  | `ReactionModule`  | NestJS 모듈                                                |
| Service | `ReactionService` | 이모지 리액션 토글, 카운트 집계, 유저 상태 조회, 일괄 조회 |
| tRPC    | `reactionRouter`  | 5개 프로시저 (아래 참조)                                   |

**Service 메서드:**

| 메서드                                                      | 설명                                           |
| ----------------------------------------------------------- | ---------------------------------------------- |
| `toggle(targetType, targetId, userId, type)`                | 리액션 토글 (있으면 제거, 없으면 추가)         |
| `getReactionCounts(targetType, targetId)`                   | 타입별 카운트 집계 (`{ total, byType }`)       |
| `getReactionCountsBatch(targetType, targetIds)`             | 여러 대상 카운트 일괄 조회 (목록 최적화)       |
| `getUserReactionStatus(targetType, targetId, userId)`       | 유저의 리액션 상태 (`{ hasReacted, types[] }`) |
| `getUserReactionStatusBatch(targetType, targetIds, userId)` | 여러 대상 유저 상태 일괄 조회                  |
| `deleteAllForTarget(targetType, targetId)`                  | 대상 삭제 시 리액션 전체 제거                  |

**tRPC 프로시저:**

| 프로시저             | 권한   | 설명                          |
| -------------------- | ------ | ----------------------------- |
| `getCounts`          | public | 타입별 카운트 조회            |
| `getCountsBatch`     | public | 여러 대상 카운트 일괄 조회    |
| `toggle`             | auth   | 리액션 토글 (추가/제거)       |
| `getUserStatus`      | auth   | 유저 리액션 상태 조회         |
| `getUserStatusBatch` | auth   | 여러 대상 유저 상태 일괄 조회 |

**리액션 타입 (6종):** `like` 👍, `love` ❤️, `haha` 😂, `wow` 😮, `sad` 😢, `angry` 😠

**사용처:** community (post-detail, post-card, comment-item)

### bookmark

경로: `packages/features/bookmark/`

> **Widget Feature** — 라우트 없음. `targetType`/`targetId` 다형성 패턴으로 모든 Feature에서 임베드 가능.

| 구분       | 이름                 | 설명                                    |
| ---------- | -------------------- | --------------------------------------- |
| Module     | `BookmarkModule`     | NestJS 모듈                             |
| Service    | `BookmarkService`    | 북마크 토글, 상태 조회, 일괄 조회, 목록 |
| Controller | `BookmarkController` | REST API (`/api/bookmark/*`)            |
| tRPC       | `bookmarkRouter`     | 4개 프로시저 (아래 참조)                |

**Service 메서드:**

| 메서드                                             | 설명                                   |
| -------------------------------------------------- | -------------------------------------- |
| `toggle(targetType, targetId, userId)`             | 북마크 토글 (있으면 제거, 없으면 추가) |
| `isBookmarked(targetType, targetId, userId)`       | 북마크 여부 조회                       |
| `isBookmarkedBatch(targetType, targetIds, userId)` | 여러 대상 북마크 여부 일괄 조회        |
| `getMyBookmarks(userId, targetType?)`              | 내 북마크 목록 조회 (타입 필터 가능)   |
| `deleteAllForTarget(targetType, targetId)`         | 대상 삭제 시 북마크 전체 제거          |

**tRPC 프로시저:**

| 프로시저            | 권한 | 설명                            |
| ------------------- | ---- | ------------------------------- |
| `toggle`            | auth | 북마크 토글 (추가/제거)         |
| `isBookmarked`      | auth | 북마크 여부 조회                |
| `isBookmarkedBatch` | auth | 여러 대상 북마크 여부 일괄 조회 |
| `myList`            | auth | 내 북마크 목록 조회             |

### review

경로: `packages/features/review/`

| 구분    | 이름            | 설명                                                     |
| ------- | --------------- | -------------------------------------------------------- |
| Module  | `ReviewModule`  | NestJS 모듈                                              |
| Service | `ReviewService` | 다형성 리뷰/평점 (helpful 투표, 신고, 관리자 모더레이션) |
| tRPC    | `reviewRouter`  | 리뷰 라우트                                              |

### role-permission

Phase 8 정리 상태: `packages/features/role-permission/` 서버 feature는 현재 worktree에 설치되어 있지 않고, `apps/server/src/trpc/router.ts` 및 `packages/features/app-router.ts`에도 `rolePermission` router가 조립되어 있지 않다. `apps/server/src/scripts/seed-roles-permissions.ts` 역시 "feature is not installed" placeholder다. `apps/admin/src/features/role-permission` 레거시 클라이언트 surface는 제거됐다.

### marketing

Phase 8 정리 상태: `packages/features/marketing/` 서버 feature는 현재 worktree에 존재하지 않고 서버 tRPC/OpenAPI에도 조립되어 있지 않다. `apps/admin/src/features/marketing` 레거시 클라이언트 surface는 제거됐다. Scheduled-job의 `marketing_scheduled_publish` key는 공용 잡 식별자로 유지한다.
| Type       | `PaginatedResult`, `CalendarEvent`                                 | 페이지네이션/캘린더                                                                                  |

### email

경로: `packages/features/email/`

| 구분      | 이름                                                           | 설명                                                     |
| --------- | -------------------------------------------------------------- | -------------------------------------------------------- |
| Module    | `EmailModule`                                                  | NestJS 모듈                                              |
| Service   | `EmailService`                                                 | 이메일 발송 및 로그 관리                                 |
| Service   | `EmailProviderService`                                         | 이메일 제공자 추상화. Resend API key는 provider 생성 시점이 아니라 실제 발송 시점에 검증한다. |
| Service   | `EmailTemplateService`                                         | React Email 템플릿 렌더링                                |
| tRPC      | `emailRouter`                                                  | 이메일 라우트 (getLogs, getLog, resend, previewTemplate) |
| Function  | `injectEmailService`                                           | NestJS 서비스 주입용                                     |
| Function  | `injectAuthEmailVerificationSender`                            | Better Auth 이메일 인증 콜백 → EmailService 연결         |
| Function  | `injectAuthMagicLinkSender`                                    | Better Auth Magic Link 콜백 → EmailService 연결          |
| Function  | `injectAuthOrganizationInvitationSender`                       | Better Auth organization 초대 콜백 → EmailService 연결   |
| Function  | `injectAuthPasswordResetSender`                                | Better Auth 비밀번호 재설정 콜백 → EmailService 연결     |
| Function  | `injectAuthPasswordChangedSender`                              | Better Auth 비밀번호 변경 완료 콜백 → EmailService 연결  |
| Type      | `IEmailService`                                                | 이메일 서비스 인터페이스                                 |
| DTO       | `queryLogsSchema`, `sendEmailSchema`                           | Zod 스키마                                               |
| Templates | `WelcomeEmail`, `EmailVerificationEmail`, `PasswordResetEmail`, `PasswordChangedEmail`, `NotificationEmail` | React Email 템플릿                                       |
| Test      | `email-template.service.spec.ts`, `email.service.spec.ts`, `email.module.spec.ts` | 인증/환영/비밀번호/Magic Link/워크스페이스 초대 템플릿, 발송 서비스, Better Auth sender 주입 회귀 검증 |

Admin email REST endpoints (`/api/admin/email/logs*`) are generated into `@repo/api-client` and used by `apps/admin` during the Phase 8 tRPC migration. They preserve the existing `BetterAuthGuard` + `BetterAuthAdminGuard` authorization boundary.

Better Auth 회원가입/재발송 인증 메일, 비밀번호 재설정 메일, organization 초대 메일은 `EmailModule.onModuleInit()`에서 core auth sender에 `EmailService`를 주입해 발송한다. 따라서 인증/비밀번호 재설정/워크스페이스 초대 메일도 React Email 템플릿, `email_logs`, provider 추상화 경로를 공유한다.
비밀번호 찾기 화면은 Better Auth `requestPasswordReset`을 호출하고, 서버 `emailAndPassword.sendResetPassword`가 Better Auth에서 생성한 callback URL과 token으로 프론트 `/reset-password?token=...` 링크를 만들어 `EmailService.sendPasswordResetEmail()`에 전달한다.
비밀번호 변경 완료 후에는 Better Auth `emailAndPassword.onPasswordReset`이 `EmailService.sendPasswordChangedEmail()`을 호출해 `password-changed` 메일을 발송한다.
Magic Link 로그인은 Better Auth `magicLink` 플러그인의 `sendMagicLink` 콜백이 `EmailService.sendMagicLinkEmail()`을 호출해 `notification` 템플릿으로 발송한다. 링크는 `/api/auth/magic-link/verify?token=...`에서 세션 쿠키를 설정한 뒤 callback URL로 이동한다.
워크스페이스 멤버 초대는 Better Auth organization `sendInvitationEmail` 콜백이 `EmailService.sendOrganizationInvitationEmail()`을 호출해 `notification` 템플릿으로 `/accept-invitation?id=...` 링크를 발송한다. 초대 링크 base URL은 `APP_URL`을 우선 사용하고, 미설정 시 요청 `Origin`, `Referer`, 현재 요청 host 순서로 해석한 뒤 마지막에 `https://product-builder.app`로 fallback 한다.
서버 `/api/auth/*` catch-all은 Better Auth 4xx/5xx JSON 응답에 core auth 표준 `errorCode`를 추가한다. provider 원본 `code`/`message`는 디버깅용으로 유지하지만, 앱 UI는 `errorCode` 또는 `code`를 i18n key로 매핑하고 서버 `message`를 직접 표시하지 않는다.
Auth 배포 게이트는 `pnpm test:auth`에서 core auth sender 단위 테스트, EmailService/EmailModule 테스트, 앱 auth 호출 테스트를 함께 실행한다. 앱 Vitest scripts는 Vercel production build 환경에서도 React test utils가 production build를 로드하지 않도록 테스트 프로세스에만 `NODE_ENV=test`를 지정한다. 이후 `vite build`와 server build는 Vercel의 production 환경으로 실행된다. `pnpm deploy:check`와 Vercel app/server buildCommand는 이 게이트가 실패하면 배포 빌드를 중단한다.
React Email 템플릿은 Nest/Webpack 런타임에서 JSX가 `React` 심볼을 참조하므로 각 `.tsx` 템플릿이 React 런타임을 명시 import한다.
메일 상단 로고는 `APP_URL` 기준 `/logo.svg` 절대 URL을 사용한다. `APP_URL` 미설정 시 기본값은 `https://product-builder.app`다.

### scheduled-job

Admin scheduled-job REST endpoints (`/api/admin/scheduled-job*`) are generated into `@repo/api-client` and used by `apps/admin` during the Phase 8 tRPC migration. They preserve the existing `BetterAuthGuard` + `BetterAuthAdminGuard` authorization boundary and expose list, run history, toggle, and run-now operations.

### agent (별도 서버)

경로: `apps/agent-server/` (Hono 기반 독립 서버, `server`와 분리)

> Agent Feature는 NestJS가 아닌 **Hono 서버**에서 동작합니다. Vercel AI SDK를 사용하여 멀티모델 AI 에이전트를 관리합니다.

| 구분     | 이름                             | 설명                                                                           |
| -------- | -------------------------------- | ------------------------------------------------------------------------------ |
| Server   | `apps/agent-server/src/main.ts`  | Hono 서버 (포트 3003)                                                          |
| Provider | `registry.ts`, `model-router.ts` | Vercel AI SDK `createProviderRegistry` + `customProvider` 기반 멀티모델 라우터 |
| Service  | `AgentService`                   | 에이전트 CRUD                                                                  |
| Service  | `ThreadService`                  | 스레드 CRUD                                                                    |
| Service  | `MessageService`                 | 메시지 CRUD                                                                    |
| Service  | `UsageService`                   | 사용량 통계 (summary, byModel, byAgent)                                        |
| Lib      | `CreditClient`                   | server 크레딧 REST API HTTP 클라이언트 (check, deduct, calculate)              |
| Runtime  | `AgentRuntime`                   | `streamText` 기반 AI 실행 엔진                                                 |
| Runtime  | `ContextBuilder`                 | 시스템 프롬프트 + 도구 조립                                                    |
| Tools    | `graph.tools.ts`                 | 그래프 콘텐츠 조회 도구                                                        |
| Tools    | `board.tools.ts`                 | 게시판/게시글 조회 도구                                                        |
| Tools    | `community.tools.ts`             | 커뮤니티 조회 도구                                                             |
| Tools    | `file.tools.ts`                  | 파일 조회 도구                                                                 |
| Tools    | `user.tools.ts`                  | 유저 프로필 조회 도구                                                          |
| Tools    | `personal-color.ts`              | 퍼스널 컬러 분석 도구 (Gemini Vision → 4계절 시즌 + 컬러 팔레트)               |
| Route    | `POST /api/chat/stream`          | SSE 기반 AI 채팅 스트리밍 (크레딧 사전 검증 + 사후 차감)                       |
| tRPC     | `agentAppRouter`                 | CRUD 라우트 (agents, threads, messages, usage)                                 |

#### 크레딧 연동 (`lib/credit-client.ts`)

AI 채팅 요청 시 server의 Credit REST API와 연동하여 크레딧을 관리합니다.

| 단계        | 동작                                    | 실패 시                            |
| ----------- | --------------------------------------- | ---------------------------------- |
| Pre-check   | AI 호출 전 최소 5 크레딧 확인           | 402 Payment Required 반환          |
| Post-deduct | AI 응답 완료 후 실제 사용량 계산 → 차감 | Graceful degradation (로그만 기록) |

### scheduled-job

경로: `packages/features/scheduled-job/`

| 구분    | 이름                  | 설명                                                    |
| ------- | --------------------- | ------------------------------------------------------- |
| Module  | `ScheduledJobModule`  | NestJS 모듈 (ScheduleModule.forRoot 포함, 5개 Job 시드) |
| Service | `ScheduledJobService` | 잡 CRUD, 실행 이력 조회, 토글, 시드                     |
| Service | `CronRunnerService`   | @Cron 데코레이터 기반 5개 잡 실행기                     |
| tRPC    | `scheduledJobRouter`  | Admin (listJobs, getJobRuns, toggleJob, runJobNow)      |

#### Cron Jobs

| Job Key                       | Cron       | 설명                                                 |
| ----------------------------- | ---------- | ---------------------------------------------------- |
| `credit_monthly_renewal`      | 매일 00:00 | 크레딧 월 갱신 (currentPeriodEnd 만료 사용자)        |
| `marketing_scheduled_publish` | 매분       | 마케팅 예약 발행 + 실패 재시도                       |
| `data_cleanup`                | 매일 03:00 | 90일 이상 soft-deleted 레코드 물리 삭제              |
| `analytics_daily_aggregate`   | 매일 01:00 | 전일 이벤트 → 일별 메트릭 집계                       |
| `studio_ai_suggest`           | 매시간     | AI 주제 추천 및 초안 자동 생성 (due recurrence 실행) |

### audit-log

경로: `packages/features/audit-log/`

| 구분    | 이름              | 설명                                               |
| ------- | ----------------- | -------------------------------------------------- |
| Module  | `AuditLogModule`  | NestJS 모듈                                        |
| Service | `AuditLogService` | 감사 로그 기록 (`log()`), 조회 (필터+페이지네이션) |
| tRPC    | `auditLogRouter`  | Admin (listLogs, getLog)                           |

#### 기록 대상 Action Enum

`create`, `update`, `delete`, `assign`, `adjust`, `sync`, `config_change`

### analytics

상태: 제거됨.

현재 worktree에는 `packages/features/analytics/` backend feature가 존재하지 않는다. `apps/admin/src/features/analytics/` legacy admin surface도 Phase 8 tRPC 철거 중 제거됐다. core analytics/PostHog client와 scheduled-job의 `analytics_daily_aggregate` 키는 이 backend feature와 별개로 유지한다.

### ai

경로: `packages/features/ai/`

| 구분       | 이름           | 설명                                                                                   |
| ---------- | -------------- | -------------------------------------------------------------------------------------- |
| Module     | `AIModule`     | NestJS 모듈 (LLMService 제공, 다른 Feature에서 import)                                 |
| Service    | `LLMService`   | AI 모델 호출 (주제 추천, 초안 생성, 스트리밍 chatCompletionStream)                     |
| Controller | `AIController` | REST API (`/api/ai/*`) — JwtAuthGuard, suggestTopics/generateDraft, Swagger 데코레이터 |
| tRPC       | `aiRouter`     | suggestTopics, generateDraft (인증 필요)                                               |

### ai-image

경로: `packages/features/ai-image/`

서브 폴더 구조:

- `generation/` — 범용 프롬프트 이미지 생성 (AiImageService, StyleTemplateService)
- `content-theme/` — 콘텐츠 테마 (ContentThemeService, spec)
- `dto/` — generation.dto.ts, content-theme.dto.ts (index.ts re-export)

| 구분       | 이름                     | 설명                                                                                      |
| ---------- | ------------------------ | ----------------------------------------------------------------------------------------- |
| Module     | `AiImageModule`          | NestJS 모듈 (3개 Service, createSingleServiceContainer로 tRPC 주입)                       |
| Service    | `AiImageService`         | `generation/` — 이미지 생성 (Gemini API), 포맷별 크기, 테마 프롬프트 해석, SSE 스트리밍   |
| Service    | `StyleTemplateService`   | `generation/` — 스타일 템플릿 CRUD (Active 목록, slug 중복 체크)                          |
| Service    | `ContentThemeService`    | `content-theme/` — 콘텐츠 테마 CRUD, 프롬프트 템플릿 변수 해석 (`{{var}}` 구문)           |
| Controller | `AiImageController`      | REST API (`/api/ai-image/*`) — generate/stream/result/history/reuse/delete/content-themes |
| Controller | `AiImageAdminController` | REST API (`/api/admin/ai-image/*`) — styleTemplates/contentThemes CRUD, adminHistory      |
| tRPC       | `aiImageRouter`          | 11개 프로시저 (v1.0 7개 + v1.1 contentThemes 4개)                                         |

#### tRPC 프로시저 (11개)

| 프로시저             | 설명                                          |
| -------------------- | --------------------------------------------- |
| `generate`           | 이미지 생성 요청 (format/contentThemeId 포함) |
| `result`             | 생성 결과 조회 (generationId)                 |
| `history`            | 사용자별 생성 이력 (페이지네이션)             |
| `reuse`              | 이전 생성의 프롬프트/스타일/포맷 재사용       |
| `delete`             | 생성 이력 소프트 삭제                         |
| `styleTemplates`     | 활성 스타일 템플릿 목록 조회                  |
| `adminHistory`       | Admin: 전체 생성 이력 (필터/페이지네이션)     |
| `contentThemes`      | 활성 콘텐츠 테마 목록 조회                    |
| `createContentTheme` | Admin: 콘텐츠 테마 생성                       |
| `updateContentTheme` | Admin: 콘텐츠 테마 수정                       |
| `deleteContentTheme` | Admin: 콘텐츠 테마 삭제                       |

### course

경로: `packages/features/course/`

| 구분       | 이름                                                            | 설명                                                                           |
| ---------- | --------------------------------------------------------------- | ------------------------------------------------------------------------------ |
| Module     | `CourseModule`                                                  | NestJS 모듈 (6개 서비스 주입, OnModuleInit으로 tRPC 연결)                      |
| Service    | `CourseService`                                                 | 강의 CRUD, 발행/비발행, 관리자 목록 (필터/검색/페이지네이션)                   |
| Service    | `TopicService`                                                  | 주제 CRUD, 순서 변경                                                           |
| Service    | `SectionService`                                                | 섹션 CRUD, 순서 변경                                                           |
| Service    | `LessonService`                                                 | 레슨 CRUD, 동영상 설정/제거, 비디오 URL 조회, 순서 변경                        |
| Service    | `EnrollmentService`                                             | 수강 신청/취소, 수강 상태, 진도 관리, 자동 수강 완료                           |
| Service    | `AttachmentService`                                             | 첨부파일 CRUD, 순서 변경                                                       |
| Controller | `CourseController`                                              | REST API (`/api/course/*`) — 강의 목록/상세/커리큘럼 (Public)                  |
| Controller | `CourseAdminController`                                         | REST API (`/api/admin/course/*`) — Admin CRUD, Swagger 데코레이터              |
| tRPC       | `courseRouter`                                                  | 6개 서브 라우터 (topic, list, bySlug, section, lesson, enrollment, attachment) |
| DTO        | `createCourseSchema`, `updateCourseSchema`                      | 강의                                                                           |
| DTO        | `createTopicSchema`, `updateTopicSchema`                        | 주제                                                                           |
| DTO        | `createSectionSchema`, `updateSectionSchema`                    | 섹션                                                                           |
| DTO        | `createLessonSchema`, `updateLessonSchema`, `setVideoSchema`    | 레슨                                                                           |
| Type       | `CourseWithTopic`, `SectionWithLessons`, `MyCourseWithProgress` | 강의/커리큘럼                                                                  |
| Type       | `EnrollmentWithProgress`, `CourseProgressDetail`                | 수강/진도                                                                      |
| Type       | `PaginatedResult`, `PaginationInput`, `ReorderInput`            | 공통                                                                           |

#### tRPC 프로시저

**Public**

| 프로시저       | 유형  | 설명                                      |
| -------------- | ----- | ----------------------------------------- |
| `topic.list`   | Query | 주제 목록 (활성/전체)                     |
| `list`         | Query | 강의 목록 (페이지네이션, 주제 필터, 정렬) |
| `bySlug`       | Query | 슬러그로 강의 상세                        |
| `section.list` | Query | 커리큘럼 (섹션+레슨)                      |

**Auth**

| 프로시저                          | 유형     | 설명                                  |
| --------------------------------- | -------- | ------------------------------------- |
| `lesson.withVideo`                | Query    | 레슨 상세 (비디오 URL 포함)           |
| `enrollment.enroll`               | Mutation | 수강 신청                             |
| `enrollment.cancel`               | Mutation | 수강 취소                             |
| `enrollment.isEnrolled`           | Query    | 수강 여부 확인                        |
| `enrollment.myCourses`            | Query    | 내 수강 목록 (진도 포함)              |
| `enrollment.courseProgress`       | Query    | 강의 진도 상세                        |
| `enrollment.toggleLessonComplete` | Mutation | 레슨 완료/미완료 토글                 |
| `enrollment.updateProgress`       | Mutation | 레슨 진도 업데이트 (비디오 위치 기반) |

**Admin**

| 프로시저               | 유형     | 설명                         |
| ---------------------- | -------- | ---------------------------- |
| `topic.create`         | Mutation | 주제 생성                    |
| `topic.update`         | Mutation | 주제 수정                    |
| `topic.delete`         | Mutation | 주제 삭제                    |
| `topic.reorder`        | Mutation | 주제 순서 변경               |
| `admin.list`           | Query    | 관리자 강의 목록 (필터/검색) |
| `admin.byId`           | Query    | 강의 상세 (관리자)           |
| `admin.create`         | Mutation | 강의 생성                    |
| `admin.update`         | Mutation | 강의 수정                    |
| `admin.delete`         | Mutation | 강의 삭제                    |
| `admin.publish`        | Mutation | 강의 발행                    |
| `admin.unpublish`      | Mutation | 강의 비발행                  |
| `section.create`       | Mutation | 섹션 생성                    |
| `section.update`       | Mutation | 섹션 수정                    |
| `section.delete`       | Mutation | 섹션 삭제                    |
| `section.reorder`      | Mutation | 섹션 순서 변경               |
| `lesson.create`        | Mutation | 레슨 생성                    |
| `lesson.update`        | Mutation | 레슨 수정                    |
| `lesson.delete`        | Mutation | 레슨 삭제                    |
| `lesson.setVideo`      | Mutation | 레슨 동영상 설정             |
| `lesson.removeVideo`   | Mutation | 레슨 동영상 제거             |
| `lesson.reorder`       | Mutation | 레슨 순서 변경               |
| `attachment.list`      | Query    | 첨부파일 목록                |
| `attachment.create`    | Mutation | 첨부파일 추가                |
| `attachment.delete`    | Mutation | 첨부파일 삭제                |
| `attachment.reorder`   | Mutation | 첨부파일 순서 변경           |
| `enrollment.adminList` | Query    | 수강생 목록 (관리자)         |

#### REST API — Public (Swagger 적용)

| 엔드포인트                         | 메서드 | 인증 | 설명                                      |
| ---------------------------------- | ------ | ---- | ----------------------------------------- |
| `/api/course`                      | GET    | -    | 강의 목록 (페이지네이션, 주제 필터, 정렬) |
| `/api/course/:slug`                | GET    | -    | 강의 상세 (슬러그)                        |
| `/api/course/:courseId/curriculum` | GET    | -    | 커리큘럼 (섹션+레슨)                      |
| `/api/course/topics`               | GET    | -    | 주제 목록                                 |
| `/api/course/:id/attachments`      | GET    | -    | 첨부파일 목록                             |
| `/api/course/:id/enroll`           | POST   | Auth | 수강 신청                                 |
| `/api/course/:id/enroll`           | DELETE | Auth | 수강 취소                                 |
| `/api/course/:id/enrolled`         | GET    | Auth | 수강 여부 확인                            |
| `/api/course/my/courses`           | GET    | Auth | 내 수강 목록                              |
| `/api/course/progress`             | POST   | Auth | 비디오 진행률 업데이트                    |
| `/api/course/progress/complete`    | POST   | Auth | 레슨 완료/미완료 토글                     |
| `/api/course/:id/progress`         | GET    | Auth | 강의 전체 진행 상황                       |

#### REST API — Admin (Swagger 적용)

| 엔드포인트                              | 메서드 | 인증  | 설명                  |
| --------------------------------------- | ------ | ----- | --------------------- |
| `/api/admin/course`                     | GET    | Admin | 강의 목록 (필터/검색) |
| `/api/admin/course`                     | POST   | Admin | 강의 생성             |
| `/api/admin/course/:id`                 | GET    | Admin | 강의 상세             |
| `/api/admin/course/:id`                 | PATCH  | Admin | 강의 수정             |
| `/api/admin/course/:id`                 | DELETE | Admin | 강의 삭제             |
| `/api/admin/course/:id/publish`         | POST   | Admin | 강의 발행             |
| `/api/admin/course/:id/unpublish`       | POST   | Admin | 강의 비발행           |
| `/api/admin/course/topics`              | POST   | Admin | 주제 생성             |
| `/api/admin/course/topics/:id`          | PATCH  | Admin | 주제 수정             |
| `/api/admin/course/topics/:id`          | DELETE | Admin | 주제 삭제             |
| `/api/admin/course/:courseId/sections`  | POST   | Admin | 섹션 생성             |
| `/api/admin/course/sections/:id`        | PATCH  | Admin | 섹션 수정             |
| `/api/admin/course/sections/:id`        | DELETE | Admin | 섹션 삭제             |
| `/api/admin/course/:courseId/lessons`   | POST   | Admin | 레슨 생성             |
| `/api/admin/course/lessons/:id`         | PATCH  | Admin | 레슨 수정             |
| `/api/admin/course/lessons/:id`         | DELETE | Admin | 레슨 삭제             |
| `/api/admin/course/:courseId/students`  | GET    | Admin | 수강생 목록           |
| `/api/admin/course/attachments`         | POST   | Admin | 첨부파일 추가         |
| `/api/admin/course/attachments/:id`     | DELETE | Admin | 첨부파일 삭제         |
| `/api/admin/course/attachments/reorder` | PUT    | Admin | 첨부파일 순서 변경    |
| `/api/admin/course/lessons/:id/video`   | POST   | Admin | 레슨 동영상 설정      |
| `/api/admin/course/lessons/:id/video`   | DELETE | Admin | 레슨 동영상 제거      |
| `/api/admin/course/lessons/reorder`     | PUT    | Admin | 레슨 순서 변경        |
| `/api/admin/course/sections/reorder`    | PUT    | Admin | 섹션 순서 변경        |
| `/api/admin/course/topics/reorder`      | PUT    | Admin | 주제 순서 변경        |

### booking

경로: `packages/features/booking/`

| 구분       | 이름                                                                       | 설명                                                                                          |
| ---------- | -------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------- |
| Module     | `BookingModule`                                                            | NestJS 모듈 (7개 서비스 주입, OnModuleInit으로 tRPC 연결)                                     |
| Service    | `CategoryService`                                                          | 상담 카테고리 CRUD                                                                            |
| Service    | `ProviderService`                                                          | 상담사 등록/프로필/상태 관리                                                                  |
| Service    | `SessionProductService`                                                    | 세션 상품 CRUD, 상담사별 상품 관리                                                            |
| Service    | `AvailabilityService`                                                      | 주간 스케줄, 오버라이드, 슬롯 계산                                                            |
| Service    | `BookingService`                                                           | 예약 생성/상태 전이/세션 관리                                                                 |
| Service    | `MatchingService`                                                          | 필터 기반 상담사 검색, 매칭 점수 계산                                                         |
| Service    | `RefundService`                                                            | 환불 정책 CRUD, 환불 비율 계산, 환불 실행                                                     |
| Controller | `BookingController`                                                        | REST API (`/api/booking/*`) — 공개/인증 엔드포인트, Swagger 데코레이터                        |
| Controller | `BookingAdminController`                                                   | REST API (`/api/admin/booking/*`) — JwtAuthGuard + NestAdminGuard, Swagger 데코레이터         |
| tRPC       | `bookingMainRouter`                                                        | 8개 서브 라우터 (category, provider, product, availability, booking, matching, refund, admin) |
| DTO        | `CreateCategoryDto`, `UpdateCategoryDto`                                   | 카테고리                                                                                      |
| DTO        | `CreateProviderDto`, `UpdateProviderProfileDto`, `UpdateProviderStatusDto` | 상담사                                                                                        |
| DTO        | `CreateSessionProductDto`, `UpdateSessionProductDto`                       | 세션 상품                                                                                     |
| DTO        | `UpdateWeeklyScheduleDto`, `CreateScheduleOverrideDto`                     | 스케줄                                                                                        |
| DTO        | `CreateBookingDto`, `CancelBookingDto`, `BookingQueryDto`                  | 예약                                                                                          |
| DTO        | `SearchProvidersDto`                                                       | 상담사 검색                                                                                   |
| DTO        | `UpdateRefundPolicyDto`                                                    | 환불 정책                                                                                     |

#### Admin tRPC 프로시저 (admin 네임스페이스)

**카테고리 관리** (`admin.categories`)

| 프로시저                        | 유형     | 설명                                                |
| ------------------------------- | -------- | --------------------------------------------------- |
| `admin.categories.list`         | Query    | 전체 카테고리 목록 (비활성 포함, 페이지네이션+검색) |
| `admin.categories.create`       | Mutation | 카테고리 생성                                       |
| `admin.categories.update`       | Mutation | 카테고리 수정                                       |
| `admin.categories.delete`       | Mutation | 카테고리 삭제                                       |
| `admin.categories.reorder`      | Mutation | 카테고리 정렬 순서 변경                             |
| `admin.categories.toggleActive` | Mutation | 카테고리 활성/비활성 토글                           |

**상담사 관리** (`admin.providers`)

| 프로시저                       | 유형     | 설명                                             |
| ------------------------------ | -------- | ------------------------------------------------ |
| `admin.providers.list`         | Query    | 전체 상담사 목록 (상태 필터, 검색, 페이지네이션) |
| `admin.providers.getDetail`    | Query    | 상담사 상세 조회 (카테고리, 상품 포함)           |
| `admin.providers.register`     | Mutation | 관리자에서 상담사 등록 (userId + 카테고리 지정)  |
| `admin.providers.updateStatus` | Mutation | 상담사 상태 변경 (active/inactive/suspended)     |

**세션 상품 관리** (`admin.products`)

| 프로시저                      | 유형     | 설명                                                 |
| ----------------------------- | -------- | ---------------------------------------------------- |
| `admin.products.list`         | Query    | 전체 세션 상품 목록 (비활성 포함, 페이지네이션+검색) |
| `admin.products.create`       | Mutation | 세션 상품 생성                                       |
| `admin.products.update`       | Mutation | 세션 상품 수정                                       |
| `admin.products.delete`       | Mutation | 세션 상품 삭제                                       |
| `admin.products.toggleStatus` | Mutation | 세션 상품 상태 토글 (active ↔ inactive)              |

**예약 관리** (`admin.bookings`)

| 프로시저                       | 유형     | 설명                                                              |
| ------------------------------ | -------- | ----------------------------------------------------------------- |
| `admin.bookings.list`          | Query    | 전체 예약 목록 (고객/상담사/상품 이름 JOIN, 상태 필터, 날짜 범위) |
| `admin.bookings.getDetail`     | Query    | 예약 상세 조회                                                    |
| `admin.bookings.forceCancel`   | Mutation | 관리자 강제 취소 (사유 입력)                                      |
| `admin.bookings.forceComplete` | Mutation | 관리자 강제 완료                                                  |
| `admin.bookings.forceNoShow`   | Mutation | 관리자 강제 노쇼 처리                                             |
| `admin.bookings.forceRefund`   | Mutation | 관리자 강제 환불 (금액 지정)                                      |

**환불 정책 관리** (`admin.refundPolicy`)

| 프로시저                    | 유형     | 설명                                                       |
| --------------------------- | -------- | ---------------------------------------------------------- |
| `admin.refundPolicy.list`   | Query    | 환불 정책 목록                                             |
| `admin.refundPolicy.create` | Mutation | 환불 정책 생성 (시간대별 규칙, 노쇼/상담사 취소 환불 비율) |
| `admin.refundPolicy.update` | Mutation | 환불 정책 수정                                             |
| `admin.refundPolicy.delete` | Mutation | 환불 정책 삭제 (기본 정책 삭제 불가)                       |

**통합 통계**

| 프로시저      | 유형  | 설명                                                              |
| ------------- | ----- | ----------------------------------------------------------------- |
| `admin.stats` | Query | Booking 시스템 통합 통계 (카테고리/상담사/상품/예약 카운트, 수익) |

#### REST API — Admin (Swagger 적용)

| 엔드포인트                                       | 메서드 | 설명               |
| ------------------------------------------------ | ------ | ------------------ |
| `/api/admin/booking/categories`                  | GET    | 카테고리 목록      |
| `/api/admin/booking/categories`                  | POST   | 카테고리 생성      |
| `/api/admin/booking/categories/:id`              | PATCH  | 카테고리 수정      |
| `/api/admin/booking/categories/:id`              | DELETE | 카테고리 삭제      |
| `/api/admin/booking/categories/reorder`          | PUT    | 카테고리 정렬 변경 |
| `/api/admin/booking/providers`                   | GET    | 상담사 목록        |
| `/api/admin/booking/providers/:id/status`        | PATCH  | 상담사 상태 변경   |
| `/api/admin/booking/products`                    | GET    | 세션 상품 목록     |
| `/api/admin/booking/products`                    | POST   | 세션 상품 생성     |
| `/api/admin/booking/products/:id`                | PATCH  | 세션 상품 수정     |
| `/api/admin/booking/products/:id`                | DELETE | 세션 상품 삭제     |
| `/api/admin/booking/products/:id/toggle-status`  | POST   | 상품 상태 토글     |
| `/api/admin/booking/bookings`                    | GET    | 전체 예약 목록     |
| `/api/admin/booking/bookings/:id/force-cancel`   | POST   | 강제 취소          |
| `/api/admin/booking/bookings/:id/force-complete` | POST   | 강제 완료          |
| `/api/admin/booking/bookings/:id/force-no-show`  | POST   | 강제 노쇼          |
| `/api/admin/booking/bookings/:id/force-refund`   | POST   | 강제 환불          |
| `/api/admin/booking/refund-policies`             | GET    | 환불 정책 목록     |
| `/api/admin/booking/refund-policies`             | POST   | 환불 정책 생성     |
| `/api/admin/booking/refund-policies/:id`         | PATCH  | 환불 정책 수정     |
| `/api/admin/booking/refund-policies/:id`         | DELETE | 환불 정책 삭제     |
| `/api/admin/booking/stats`                       | GET    | 통합 통계          |

### project

경로: `packages/features/project/`

Product Builder 메타 CRUD. 모든 tRPC procedure는 `protectedProcedure` 위에서 Better Auth 세션의 `activeOrganizationId`를 요구하며, `project_projects.organization_id`와 비교해 active 워크스페이스 범위만 읽고 쓴다.

| 구분    | 이름             | 설명                                                                 |
| ------- | ---------------- | -------------------------------------------------------------------- |
| Module  | `ProjectModule`  | NestJS 모듈, `ProjectService`를 tRPC router에 주입                   |
| Service | `ProjectService` | list/get/create/update/archive/permanentlyDelete/uploadCover/updateLastOpened 프로젝트 CRUD. `delete`는 하위 호환 alias로 archive 처리 |
| tRPC    | `projectRouter`  | `list`, `getById`, `create`, `update`, `archive`, `delete`, `permanentlyDelete`, `updateLastOpened`, `uploadCover` |
| Event   | `ProjectEvent`   | `project.created`, `project.deleted` payload에 `organizationId` 포함. 보관과 영구 삭제 모두 삭제 이벤트를 발행해 백업 등 후속 기능을 중지 |

#### tRPC 권한/스코프

| 프로시저 | 유형     | 스코프 |
| -------- | -------- | ------ |
| `list` | Query | `ownerId + activeOrganizationId` |
| `getById` | Query | `projectId + activeOrganizationId`, owner 검증 |
| `create` | Mutation | active organization id를 `project_projects.organization_id`에 저장 |
| `update` | Mutation | `getById`로 active organization + owner 검증 후 수정 |
| `archive` | Mutation | `getById`로 active organization + owner 검증 후 `archivedAt` 기록, `status=archived`, active 목록에서 제외 |
| `delete` | Mutation | 하위 호환용 archive alias. 신규 UI는 `archive` 또는 `permanentlyDelete`를 명시적으로 사용 |
| `permanentlyDelete` | Mutation | `getById`로 active organization + owner 검증 후 프로젝트 행과 프로젝트 범위 데이터를 물리 삭제 |
| `updateLastOpened` | Mutation | active organization + owner 검증 후 최근 열람 갱신 |
| `uploadCover` | Mutation | active organization + owner 검증 후 cover image URL 갱신 |

### settings-projects

경로: `packages/features/_common/routers/settings-projects.ts`

설정 화면용 read router. `settingsProjects.list`와 `settingsProjects.byId`는 owner 또는 `project_members` 접근권한을 인정하되, 항상 `project_projects.organization_id = activeOrganizationId` 조건을 먼저 적용한다. apps/app settings 사용처는 REST `/api/settings-projects`로 전환되었고, tRPC router는 공존 기간 동안만 유지한다.

#### Story Entity Properties

| Surface | 설명 |
| --- | --- |
| `story.entityProperty.list` | `entityId` + `entityType`으로 `story_entity_properties` row를 조회한다. 실제 story 본문 엔티티 접근 권한은 `StoryService`의 기존 world/character/location/faction/codex/draft getter로 확인한다 |
| `story.entityProperty.upsert` | `properties` JSONB 배열의 `{ key, value }` 항목을 갱신한다. 캐릭터 대표 이미지는 일반화된 `imageSmallUrl` key를 사용한다 |
| `story.entityProperty.uploadImageSmall` | PNG/JPEG/WebP, 5MB 이하 파일을 base64 bytes로 받아 `@repo/core/storage/blob.uploadBufferToBlob`에 저장하고, 반환 URL을 `imageSmallUrl` 속성으로 upsert한다 |

### 서비스 레이어

### task

경로: `packages/features/task/`

| 구분       | 이름                  | 설명                                                           |
| ---------- | --------------------- | -------------------------------------------------------------- |
| Module     | `TaskModule`          | NestJS 모듈 (5개 서비스, 1개 컨트롤러)                         |
| Service    | `TaskService`         | 태스크 CRUD, 상태 변경, 라벨 토글, 칸반 D&D 일괄 순서 업데이트 |
| Service    | `TaskProjectService`  | 프로젝트 CRUD                                                  |
| Service    | `TaskCycleService`    | 사이클 CRUD                                                    |
| Service    | `TaskLabelService`    | 라벨 CRUD                                                      |
| Service    | `TaskCommentService`  | 댓글 CRUD (soft delete)                                        |
| Service    | `TaskActivityService` | 활동 이력 기록/조회                                            |
| Controller | `TaskController`      | REST API (`/api/task/*`)                                       |
| tRPC       | `taskRouter`          | 24개 프로시저 (flat 구조)                                      |
| DTO        | `CreateTaskDto`       | 태스크 생성 입력                                               |
| DTO        | `UpdateTaskDto`       | 태스크 수정 입력                                               |
| DTO        | `TaskListDto`         | 태스크 목록 필터/정렬/페이지네이션                             |
| DTO        | `BulkUpdateOrderDto`  | 칸반 D&D 순서/상태 일괄 업데이트 입력                          |
| Type       | `TaskWithRelations`   | 태스크 + assignee + labels + project 조인                      |

#### tRPC 프로시저 (24개)

| 프로시저          | 타입     | 인증   | 설명                             |
| ----------------- | -------- | ------ | -------------------------------- |
| `list`            | Query    | Public | 태스크 목록 (필터/정렬)          |
| `byIdentifier`    | Query    | Public | 식별자로 상세 조회               |
| `create`          | Mutation | Auth   | 태스크 생성                      |
| `update`          | Mutation | Auth   | 태스크 수정                      |
| `delete`          | Mutation | Auth   | 태스크 삭제 (soft)               |
| `projectList`     | Query    | Public | 프로젝트 목록                    |
| `projectById`     | Query    | Public | 프로젝트 상세                    |
| `projectCreate`   | Mutation | Auth   | 프로젝트 생성                    |
| `projectUpdate`   | Mutation | Auth   | 프로젝트 수정                    |
| `projectDelete`   | Mutation | Auth   | 프로젝트 삭제 (soft)             |
| `cycleList`       | Query    | Public | 사이클 목록                      |
| `cycleById`       | Query    | Public | 사이클 상세                      |
| `cycleCreate`     | Mutation | Auth   | 사이클 생성                      |
| `cycleUpdate`     | Mutation | Auth   | 사이클 수정                      |
| `labelList`       | Query    | Public | 라벨 목록                        |
| `labelCreate`     | Mutation | Auth   | 라벨 생성                        |
| `labelDelete`     | Mutation | Auth   | 라벨 삭제                        |
| `commentList`     | Query    | Public | 태스크별 댓글 목록               |
| `commentCreate`   | Mutation | Auth   | 댓글 생성                        |
| `commentUpdate`   | Mutation | Auth   | 댓글 수정                        |
| `commentDelete`   | Mutation | Auth   | 댓글 삭제 (soft)                 |
| `activityList`    | Query    | Public | 태스크별 활동 이력               |
| `bulkUpdateOrder` | Mutation | Auth   | 칸반 D&D 순서/상태 일괄 업데이트 |

#### REST Endpoints (TaskController)

| 메서드 | 경로                         | 설명                             |
| ------ | ---------------------------- | -------------------------------- |
| GET    | `/api/task/tasks`            | 태스크 목록 (필터/정렬)          |
| GET    | `/api/task/tasks/:id`        | 식별자로 상세 조회               |
| POST   | `/api/task/tasks`            | 태스크 생성                      |
| PATCH  | `/api/task/tasks/:id`        | 태스크 수정                      |
| DELETE | `/api/task/tasks/:id`        | 태스크 삭제 (soft)               |
| GET    | `/api/task/projects`         | 프로젝트 목록                    |
| POST   | `/api/task/projects`         | 프로젝트 생성                    |
| GET    | `/api/task/cycles`           | 사이클 목록                      |
| POST   | `/api/task/cycles`           | 사이클 생성                      |
| GET    | `/api/task/labels`           | 라벨 목록                        |
| PATCH  | `/api/task/tasks/bulk-order` | 칸반 D&D 순서/상태 일괄 업데이트 |
| POST   | `/api/task/labels`           | 라벨 생성                        |

---

모든 Feature 서비스는 **NestJS HttpException** 패턴을 사용합니다.

| Exception                      | 사용 상황                                               |
| ------------------------------ | ------------------------------------------------------- |
| `NotFoundException`            | 리소스를 찾을 수 없음                                   |
| `InternalServerErrorException` | DB 생성/수정 실패                                       |
| `ConflictException`            | 중복 (slug, unique 필드)                                |
| `BadRequestException`          | 잘못된 입력, 유효하지 않은 상태                         |
| `BadGatewayException`          | 외부 API 호출 실패 (Supabase Storage, Lemon Squeezy 등) |
| `ForbiddenException`           | 권한 없음                                               |

`throw new Error()` 사용 금지 — 반드시 NestJS HttpException을 사용할 것.

### feature-catalog

상태: 제거됨.

현재 worktree에는 `packages/features/feature-catalog/` backend feature가 존재하지 않는다. `apps/admin/src/features/feature-catalog/` legacy admin surface도 Phase 8 tRPC 철거 중 제거됐다.

### naver-auth

경로: `packages/features/naver-auth/`

| 구분       | 이름                  | 설명                                                |
| ---------- | --------------------- | --------------------------------------------------- |
| Module     | `NaverAuthModule`     | NestJS 모듈                                         |
| Service    | `NaverAuthService`    | Naver OAuth 2.0 서버사이드 인증 + Supabase 연동     |
| Controller | `NaverAuthController` | REST API (`/api/auth/naver/authorize`, `/callback`) |

#### REST 엔드포인트

| 메서드 | 경로                        | 설명                                              |
| ------ | --------------------------- | ------------------------------------------------- |
| GET    | `/api/auth/naver/authorize` | 네이버 로그인 페이지로 302 리다이렉트             |
| GET    | `/api/auth/naver/callback`  | OAuth 콜백 → Supabase verify URL로 302 리다이렉트 |

#### 인증 플로우

1. 클라이언트 → `/api/auth/naver/authorize?redirect_to={origin}`
2. 서버 → Naver OAuth 인증 페이지로 리다이렉트
3. Naver → `/api/auth/naver/callback?code=...&state=...`
4. 서버: code → token → profile → Supabase Admin API (createUser/updateUser + generateLink magiclink)
5. 서버 → Supabase verify URL로 리다이렉트 → 세션 생성 → 프론트엔드로 리다이렉트

### story-quest

경로: `packages/features/story-quest/`

| 구분    | 이름                      | 설명                                                                    |
| ------- | ------------------------- | ----------------------------------------------------------------------- |
| Module  | `StoryQuestModule`        | NestJS 모듈. CRPG Quest Authoring MVP의 퀘스트 도메인 서비스를 등록한다 |
| Controller | `StoryQuestController` | Phase 5 REST parity controller. 26개 storyQuest tRPC procedure에 대응하는 `/api/story-quest/*` endpoint를 제공한다 |
| Service | `StoryQuestService`       | 프로젝트별 세계 상태/퀘스트/목표/저널/문서 연결 CRUD, key 정규화, 값 종류별 초기값 검증, Quest child restore 조회 |
| tRPC    | `storyQuestRouter`        | `worldState`, `quest`, `objective`, `journal`, `link` 하위 라우터를 제공한다 |
| DTO     | `trpc/dto/index.ts`       | 세계 상태, 퀘스트, 목표, 저널, 문서 연결 생성/수정/list 입력과 응답 타입 |

#### World State 모델

- 기준 저장소는 `story_quest_world_states`, `story_quest_world_state_options`
- `story_quest_world_states`: `project_id`, 사용자용 `name`/`description`, 시스템용 `key`, `value_kind`, `initial_value`, `sort_order`, `owner_id`
- active row 기준 `(project_id, key)` partial unique index로 같은 프로젝트 안에서 중복 key를 차단한다
- 값 종류는 `boolean`, `number`, `text`, `option`이며 생성/수정 시 initial value를 종류에 맞게 검증한다
- 한글 이름은 slug 형태 key로 정규화한다. 예: `성물을 찾음` → `seongmureul-chajeum`

#### Quest 모델

- 기준 저장소는 `story_quests`, `story_objectives`, `story_journal_entries`, `story_quest_links`
- `story_quests`: `project_id`, `owner_id`, `title`, `summary`, `body`, `quest_type`, `design_status`, `priority`, activation/completion 설정, `sort_order`, soft delete 컬럼
- `story_objectives`: `project_id`, `quest_id`, `title`, `description`, `sort_order`, 초기 표시 상태, reveal/complete/fail 조건 JSON, soft delete 컬럼
- `story_journal_entries`: `project_id`, `quest_id`, optional `objective_id`, `title`, `body`, `sort_order`, reveal 조건 JSON, soft delete 컬럼
- `story_quest_links`: `project_id`, `owner_id`, `quest_id`, optional `objective_id`, `target_node_id`, `target_node_type`, label, `sort_order`, soft delete 컬럼. Quest 상세의 문서 연결에 사용한다
- Quest 단건 조회는 ordered objectives와 journal entries를 포함해 UI 새로고침 복원에 사용한다
- Quest 삭제는 objective, journal entry, link를 같은 transaction에서 soft delete한다

#### tRPC 프로시저

| 프로시저            | 유형     | 설명                              |
| ------------------- | -------- | --------------------------------- |
| `worldState.list`   | Query    | 프로젝트별 세계 상태 목록 조회    |
| `worldState.getById` | Query   | 세계 상태 단건 조회               |
| `worldState.create` | Mutation | 세계 상태 생성                    |
| `worldState.update` | Mutation | 세계 상태 수정                    |
| `worldState.delete` | Mutation | 세계 상태 삭제 (soft delete)      |
| `worldState.reorder` | Mutation | 세계 상태 순서 변경              |
| `worldState.validateKey` | Query | 세계 상태 key 사용 가능 여부 확인 |
| `quest.list`        | Query    | 프로젝트별 퀘스트 목록 조회       |
| `quest.getById`     | Query    | 목표와 저널을 포함한 퀘스트 단건 조회 |
| `quest.create`      | Mutation | 퀘스트 생성                       |
| `quest.update`      | Mutation | 퀘스트 수정                       |
| `quest.delete`      | Mutation | 퀘스트와 하위 목표/저널 soft delete |
| `objective.listByQuest` | Query | 퀘스트별 목표 목록 조회           |
| `objective.create`  | Mutation | 목표 생성                         |
| `objective.update`  | Mutation | 목표 수정                         |
| `objective.delete`  | Mutation | 목표 삭제                         |
| `objective.reorder` | Mutation | 목표 순서 변경                    |
| `journal.listByQuest` | Query  | 퀘스트별 저널 목록 조회           |
| `journal.create`    | Mutation | 저널 항목 생성                    |
| `journal.update`    | Mutation | 저널 항목 수정                    |
| `journal.delete`    | Mutation | 저널 항목 삭제                    |
| `journal.reorder`   | Mutation | 저널 순서 변경                    |
| `link.listByProject` | Query   | 프로젝트별 Quest-문서 연결 조회 |
| `link.listByQuest`  | Query    | 퀘스트별 연결된 문서 조회  |
| `link.create`       | Mutation | 퀘스트 또는 목표를 문서에 연결 |
| `link.delete`       | Mutation | 문서 연결 삭제                  |

#### REST API

| 엔드포인트 | 메서드 | 설명 |
| ---------- | ------ | ---- |
| `/api/story-quest/quests` | GET | 프로젝트별 퀘스트 목록 조회 |
| `/api/story-quest/quests/:questId` | GET | 퀘스트 단건 조회 |
| `/api/story-quest/quests` | POST | 퀘스트 생성 |
| `/api/story-quest/quests/:questId` | PUT | 퀘스트 수정 |
| `/api/story-quest/quests/:questId` | DELETE | 퀘스트 삭제 |
| `/api/story-quest/quests/:questId/objectives` | GET | 퀘스트별 목표 목록 조회 |
| `/api/story-quest/quests/:questId/objectives` | POST | 퀘스트 목표 생성 |
| `/api/story-quest/objectives/:objectiveId` | PUT | 퀘스트 목표 수정 |
| `/api/story-quest/objectives/:objectiveId` | DELETE | 퀘스트 목표 삭제 |
| `/api/story-quest/quests/:questId/objectives/reorder` | PUT | 퀘스트 목표 순서 변경 |
| `/api/story-quest/quests/:questId/journal-entries` | GET | 퀘스트별 저널 목록 조회 |
| `/api/story-quest/quests/:questId/journal-entries` | POST | 퀘스트 저널 생성 |
| `/api/story-quest/journal-entries/:journalEntryId` | PUT | 퀘스트 저널 수정 |
| `/api/story-quest/journal-entries/:journalEntryId` | DELETE | 퀘스트 저널 삭제 |
| `/api/story-quest/quests/:questId/journal-entries/reorder` | PUT | 퀘스트 저널 순서 변경 |
| `/api/story-quest/projects/:projectId/quest-links` | GET | 프로젝트별 Quest-문서 연결 조회 |
| `/api/story-quest/quests/:questId/quest-links` | GET | 퀘스트별 연결된 문서 조회 |
| `/api/story-quest/quest-links` | POST | 퀘스트 또는 목표를 문서에 연결 |
| `/api/story-quest/quest-links/:questLinkId` | DELETE | 문서 연결 삭제 |
| `/api/story-quest/world-states` | GET | 프로젝트별 세계 상태 목록 조회 |
| `/api/story-quest/world-states/:worldStateId` | GET | 세계 상태 단건 조회 |
| `/api/story-quest/world-states` | POST | 세계 상태 생성 |
| `/api/story-quest/world-states/:worldStateId` | PUT | 세계 상태 수정 |
| `/api/story-quest/world-states/:worldStateId` | DELETE | 세계 상태 삭제 |
| `/api/story-quest/world-states/reorder` | PUT | 세계 상태 순서 변경 |
| `/api/story-quest/world-states/validate-key` | GET | 세계 상태 key 사용 가능 여부 확인 |

### video-lecture

경로: `packages/features/video-lecture/`

Cloudflare Stream 기반 재사용 영상 강의 capability. 원본 영상은 앱 서버나 public bucket에 저장하지 않고, 서버가 direct/tus upload session과 signed playback token만 발급한다.

| 구성 | 설명 |
| --- | --- |
| Provider | `cloudflare-stream/src/*` — direct upload, tus, signed playback, webhook signature, delete, progress helper |
| Service | `VideoLectureService` — public metadata, admin upload/status, playback entitlement, progress, webhook sync |
| Registry | `service-registry.ts` — `videoLectureCapabilities`와 `videoLectureService` reuse entrypoint |
| Controller | `VideoLectureController`, `VideoLectureAdminController`, `CloudflareStreamWebhookController` |
| Schema | `video_courses`, `video_lessons`, `video_assets`, `video_asset_events`, `video_playback_sessions`, `video_progress`, `video_entitlement_rules`, `video_admin_actions` |

주요 REST:

- `GET /api/video-courses`
- `GET /api/video-courses/:courseId`
- `GET /api/video-lessons/:lessonId`
- `POST /api/video-lessons/:lessonId/playback`
- `POST /api/video-lessons/:lessonId/progress`
- `GET /api/me/video-progress`
- `POST /api/admin/video-lectures/uploads`
- `GET /api/admin/video-lectures`
- `PATCH /api/admin/video-lectures/:id`
- `DELETE /api/admin/video-lectures/:id`
- `POST /api/webhooks/cloudflare-stream`

### 글로벌 에러 처리

- **server**: `GlobalExceptionFilter` (`@repo/core/error`) — 모든 에러를 구조화 JSON으로 변환, 5xx는 PostHog 자동 캡처
- **agent-server**: `app.onError()` (Hono) — 동일한 구조화 JSON 응답, PostHog 캡처
- **tRPC**: `errorFormatter`에 `requestId` 포함, `onError`에서 5xx PostHog 캡처
