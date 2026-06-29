# Database Schema Reference

패키지: `@repo/drizzle` (`packages/drizzle/`)

import 패턴: `import { users, posts, DRIZZLE } from "@repo/drizzle";`

## Core Exports

| 이름 | 경로 | 설명 |
|------|------|------|
| `DatabaseModule` | `src/database.module.ts` | NestJS 데이터베이스 모듈 (Drizzle + PostgreSQL) |
| `DRIZZLE` | `src/drizzle.decorator.ts` | DI 토큰 상수 |
| `DrizzleDB` (type) | `src/drizzle.decorator.ts` | Drizzle DB 인스턴스 타입 |
| `SchemaRegistry` | `src/schema-registry.ts` | 스키마 레지스트리 |
| `baseColumns()` | `src/utils/columns.ts` | 기본 컬럼 (id, createdAt, updatedAt) |
| `timestamps()` | `src/utils/columns.ts` | 타임스탬프 컬럼 |
| `softDelete()` | `src/utils/columns.ts` | 소프트 삭제 컬럼 |

## Core Schemas (`src/schema/core/`)

### auth

경로: `src/schema/core/auth.ts`

Supabase Auth 관련 스키마 (users 참조)

### better-auth

경로: `src/schema/core/better-auth.ts`

Better Auth 테이블. `users`, `sessions`, `accounts`, `verifications`, `organizations`, `members`, `invitations`, `jwks`를 정의한다. Organization 초대의 `invitations`는 Better Auth 1.5 invite endpoint가 요구하는 `createdAt` (`created_at`)을 포함한다.

### identity-verification

`features/identity-verification/index.ts`는 KCB/Ok-name 본인확인 capability schema를 정의한다.

| 테이블 | 설명 |
| ------ | ---- |
| `identity_verification_sessions` | provider/mode/user/target action, state/nonce hash, request id, status, redirect metadata, normalized result, retention/delete metadata |
| `identity_verification_results` | verified 결과의 최소 저장본. CI/DI는 hash만, 이름/전화/생년월일은 masked/minimal field만 허용 |
| `identity_verification_provider_events` | provider event timeline. 원문 payload 대신 redacted payload만 저장 |
| `identity_verification_consents` | 본인확인 약관/개인정보 고지 동의 version과 동의 시각 |
| `identity_verification_admin_actions` | retry/archive 같은 관리자 조치 audit log |

저장 금지: 주민등록번호, raw KCB request/response payload, 암호화 key, license/native artifact, 불필요한 전체 전화번호.

### profiles

경로: `src/schema/core/profiles.ts`

유저 프로필 테이블. `authProvider` (auth_provider enum: email/google/naver/kakao, 기본값 'email') 가입 경로 구분. `isActive` 필드로 활성/비활성 관리 (기본값 true, not null). `marketingConsentAt` (timestamp with tz, nullable) 마케팅 수신 동의 일시. `deletedAt` (timestamp with tz, nullable) 회원탈퇴 시 소프트 삭제 일시.

### terms

경로: `src/schema/core/terms.ts`

가입 시 동의 약관 테이블. Admin에서 등록/관리. 컬럼: name(varchar 200), url(text), isRequired(boolean, 기본 true), sortOrder(integer, 기본 0), isActive(boolean, 기본 true), createdAt, updatedAt. 물리 삭제 대신 `isActive: false`로 비활성 처리.

### files

경로: `src/schema/core/files.ts`

파일 메타데이터 테이블

### reviews

경로: `src/schema/core/reviews.ts`

다형성 리뷰/평점 테이블

### role-permission

경로: `src/schema/core/role-permission/`

| 파일 | 설명 |
|------|------|
| `roles.ts` | 역할 정의 |
| `permissions.ts` | 권한 정의 |
| `role-permissions.ts` | 역할-권한 매핑 |
| `user-roles.ts` | 유저-역할 매핑 |

### rate-limits

경로: `src/schema/core/rate-limits.ts`

레이트 리밋 토큰 기록

## Feature Schemas (`src/schema/features/`)

| Feature | 경로 | 설명 |
|---------|------|------|
| board | `features/board/index.ts` | 게시판 + 게시글 테이블 |
| comment | `features/comment/index.ts` | 댓글 테이블. `comment_target_type`: board_post, community_post, blog_post, page |
| content-studio | `features/content-studio/index.ts` | 스튜디오, 토픽, 콘텐츠, 콘텐츠 SEO, 엣지, 반복 규칙, AI 반복 규칙, 브랜드 프로필, 톤 프리셋 테이블 (5 enums: `studio_visibility`, `studio_content_status`, `studio_node_type`, `studio_sentence_length`, `studio_repurpose_format`). `studio_contents`에 `scheduledAt`, `label`, `slug`, `derivedFromId` (self-referential FK), `repurposeFormat` (studio_repurpose_format enum) 컬럼. `studio_repurpose_format` enum: card_news, short_form, twitter_thread, email_summary. `studio_content_seo`에 `seoScore` (integer, 기본 0) 컬럼. `studio_recurrences` 반복 규칙. `studio_ai_recurrences` AI 추천 반복 규칙. `studio_brand_profiles` 브랜드 프로필 (brandName, industry, targetAudience, formality 1-5, friendliness 1-5, humor 1-5, sentenceLength, forbiddenWords[], requiredWords[], additionalGuidelines, activePresetId→studio_tone_presets). `studio_tone_presets` 톤 프리셋 (name, description, formality, friendliness, humor, sentenceLength, systemPromptSuffix, isSystem, studioId). |
| community | `features/community/index.ts` | 커뮤니티, 멤버십, 포스트, 댓글, 투표, 신고, 플레어 테이블. `community_posts`는 community/status 스코프의 created/hot/vote/activity 정렬용 composite index와 controversial expression index 마이그레이션을 가진다. |
| email | `features/email/index.ts` | 이메일 로그 테이블 |
| notification | `features/notification/index.ts` | 알림 + 알림 설정 테이블 |
| payment | `features/payment/index.ts` | 상품, 구독, 주문, 라이센스 테이블. 멀티프로바이더 지원 (`provider` 컬럼 + `externalId` 컬럼 + 복합 유니크 `(externalId, provider)`). `payment_provider_name` enum (`lemon-squeezy`, `polar`). `payment_order_status` enum (pending/paid/failed/refunded/partial_refund/fraudulent). 가격은 실제 금액으로 저장 (동기화 시 프로바이더별 변환). `payment_refund_requests` 유저 환불 요청 테이블. 3 enums: `payment_order_status`, `payment_refund_request_status` (pending/approved/rejected), `payment_refund_reason_type` (defective/not_as_described/changed_mind/duplicate/other). `OrderStatus` 타입 export |
| payment (plans) | `features/payment/plans.ts` | 플랜 정의 테이블. `payment_plan_tier` enum (free/pro/team/enterprise). 컬럼: name, slug(unique), description, tier, monthlyCredits, price(실제 금액), currency, interval, providerProductId, providerVariantId, isPerSeat, features(jsonb string[]), isActive, sortOrder. Free/Enterprise 플랜은 프로바이더 미연동 로컬 전용 (서버 시작 시 자동 시드) |
| payment (credits) | `features/payment/credits.ts` | 크레딧 잔액 + 트랜잭션 이력 테이블. `paymentCreditBalances`에 planId FK 참조 (플랜 할당 시 크레딧 자동 배정) |
| payment (model-pricing) | `features/payment/model-pricing.ts` | AI 모델별 크레딧 환산 가격 테이블 |
| payment (coupons) | `features/payment/coupons.ts` | 쿠폰 정의 + 상환 기록 테이블. 2 enums: `payment_coupon_status` (active/inactive/expired), `payment_coupon_redemption_status` (pending/completed/cancelled). `payment_coupons` 쿠폰 정의 (code unique, name, description, discountRate [0-100], maxRedemptions, currentRedemptions, expiresAt, status, createdBy FK→profiles). `payment_coupon_redemptions` 상환 기록 (couponId FK, userId FK→profiles, status, redeemedAt, cancelledAt). Unique: (couponId, userId) — 사용자별 1회만 상환 |
| payment (inicis) | `features/payment/inicis.ts` | INICIS 재사용 provider 영속화. `payment_inicis_orders`는 local `orderId`, userId, amount/currency, payMethod, masked buyer fields, `tid`, auth token reference, status, provider result code/message, 승인/입금/취소 시각, refundedAmount, rawMasked/normalized JSON을 저장한다. `payment_inicis_events`는 noti/return/approval/cancel/inquiry/replay 이벤트와 idempotencyKey(unique), sourceIp, provider result, masked raw payload, normalized JSON, processedAt을 저장하며 승인/취소/noti 검증 실패도 `failed` 이벤트로 남긴다. Product Builder별 entitlement grant/revoke는 이 테이블에 직접 저장하지 않고 adapter blocker(`inicis_entitlement_adapter_required`)로 노출한다. Enums: `payment_inicis_order_status`, `payment_inicis_event_status`. Migration: `0044_payment_inicis.sql`. |
| project | `features/project/index.ts` | Product Builder 메타 테이블. `project_projects`는 `owner_id`, `organization_id`(Better Auth `organizations` FK), status, aiMode, handle, visibility, coverImage, `archivedAt`을 가진다. 보관은 `archived_at`으로 추적하고 `deleted_at`/`is_deleted`는 soft-delete 호환 컬럼으로 유지한다. 홈/설정 active 조회는 active organization과 `organization_id`, `archived_at IS NULL`을 비교해 워크스페이스 간/보관 프로젝트 노출을 차단한다. `project_starred`, `project_members`는 프로젝트 즐겨찾기/멤버십 보조 테이블이다 |
| profile | `features/profile/index.ts` | 회원탈퇴 사유 테이블 (`withdrawal_reasons`). `profile_withdrawal_reason_type` enum (too_expensive/not_useful/found_alternative/privacy_concern/too_complex/other). 컬럼: userId(FK→profiles), type(enum), detail(text, nullable), createdAt |
| family | `features/family/index.ts` | 가족 관리 5개 테이블. `family_member_role` enum (owner/guardian/therapist/observer), `family_invitation_status` enum (pending/accepted/rejected/expired). `family_groups` 가족 그룹. `family_members` 그룹 멤버 (groupId FK, userId FK→profiles, role). `family_invitations` 초대 (groupId FK, email, token, role, status, expiresAt). `family_children` 아이 (groupId FK, name, birthDate, gender, note, isActive). `family_child_assignments` 치료사 배정 (childId FK, therapistId FK→profiles, assignedBy FK→profiles) |
| bookmark | `features/bookmark/index.ts` | 다형성 북마크 테이블 (`bookmark_bookmarks`). 컬럼: targetType(text), targetId(UUID), userId(FK→profiles). Unique: (targetType, targetId, userId). 인덱스: target(targetType, targetId), user(userId) |
| operator-chat | `features/character-chat/index.ts` | 운영 오퍼레이터 챗 호환 테이블. 현재 저장소는 기존 `character_actors`, `character_actor_snapshots`, `character_chat_threads`, `character_chat_messages`, `character_chat_list_preferences`를 재사용한다. Product Builder 신규 API는 `/api/operator-chat/*`이며 기존 `/api/character-chat/*`는 호환 경로다. `character_actors`는 프로젝트/소스 엔티티별 actor 상태, enabled, 호환용 `model_provider`, `model_name`, safety/tool scope, greeting message를 저장한다. 실제 provider/model routing과 fallback은 AI Runtime 환경변수가 소유한다. |
| reaction | `features/reaction/index.ts` | 이모지 리액션 테이블 (`reaction_reactions`). 컬럼: targetType(text), targetId(UUID), userId(FK→profiles), type(text, 기본 'like'). Unique: (targetType, targetId, userId, type). 6종 이모지: like/love/haha/wow/sad/angry |
| agent | `features/agent/index.ts` | 에이전트, 스레드, 메시지, 사용량 로그 테이블 |
| marketing | `features/marketing/index.ts` | 캠페인, SNS 계정, 콘텐츠, 플랫폼 변형, 발행 테이블 |
| scheduled-job | `features/scheduled-job/index.ts` | 잡 정의 (`system_scheduled_jobs`) + 실행 이력 (`system_job_runs`) 테이블 |
| audit-log | `features/audit-log/index.ts` | 감사 로그 (`system_audit_logs`) 테이블 |
| analytics | `features/analytics/index.ts` | 이벤트 (`system_analytics_events`) + 일별 메트릭 (`system_daily_metrics`) 테이블 |
| data-tracker | `features/data-tracker/index.ts` | 트래커 템플릿 (`data_tracker_trackers`), 컬럼 정의 (`data_tracker_columns`), 데이터 엔트리 (`data_tracker_entries`) 테이블. 4 enums: `data_tracker_chart_type` (line/bar/pie), `data_tracker_scope` (personal/organization/all), `data_tracker_column_type` (text/number), `data_tracker_source` (manual/csv_import/api). JSONB 타입: `DataTrackerChartConfig` (yAxisKey, groupByKey, categoryKey, valueKey, aggregation). 인덱스: (trackerId, sortOrder), (trackerId, date), (trackerId, createdById) |
| course | `features/course/index.ts` | 강의관리 7개 테이블. `course_status_enum` (draft/published). `course_topics` 주제 (name, slug, description, thumbnailUrl, isActive, sortOrder). `course_courses` 강의 (topicId FK, title, slug, summary, content jsonb, thumbnailUrl, status, authorId FK→profiles, totalLessons, estimatedMinutes, sortOrder, publishedAt). `course_sections` 섹션 (courseId FK, title, description, sortOrder). `course_lessons` 레슨 (sectionId FK, title, description, videoFileId FK→files, videoDurationSeconds, isFree, sortOrder). `course_enrollments` 수강 (courseId FK, userId FK→profiles, enrolledAt, completedAt). Unique: (courseId, userId). `course_lesson_progress` 레슨 진도 (lessonId FK, userId FK→profiles, watchedSeconds, totalSeconds, progressPercent, lastPosition, isCompleted, completedAt). `course_attachments` 첨부 (courseId FK, fileId FK→files, title, sortOrder) |
| video-lecture | `features/video-lecture/index.ts` | Cloudflare Stream 영상 강의 8개 테이블. `video_courses`, `video_lessons`, `video_assets`, `video_asset_events`, `video_playback_sessions`, `video_progress`, `video_entitlement_rules`, `video_admin_actions`. 원본 binary는 저장하지 않고 provider asset id, playback uid, processing status, visibility, entitlement, progress, admin audit만 저장한다. |
| agent-desk | `features/agent-desk/index.ts` | 에이전트 프론트 데스크 6개 테이블. 8 enums: `agent_desk_session_type` (customer/operator/**designer**), `agent_desk_session_status` (uploading/parsing/analyzing/analyzed/reviewed/spec_generated/project_created/executing/executed/failed), `agent_desk_message_role` (agent/user), `agent_desk_execution_status` (pending/running/completed/failed/cancelled), `agent_desk_source_type` (pdf/docx/md/txt/manual), `agent_desk_parse_status` (pending/parsed/failed), `agent_desk_requirement_category` (feature/role/entity/validation/exception), `agent_desk_conflict_status` (none/duplicate/conflict). `agent_desk_sessions` 세션 (type, status, title, prompt, analysisResult jsonb, spec text, errorMessage text, createdById FK→profiles, **platform varchar**, **designTheme varchar**, **flowData jsonb**, **diagrams jsonb**). `agent_desk_files` 파일 (sessionId FK, fileName, originalName, mimeType, size, storageUrl, parsedContent, parsedAt). `agent_desk_messages` 메시지 (sessionId FK, role, content, feedback varchar nullable, feedbackAt timestamp nullable). `agent_desk_executions` 실행 이력 (sessionId FK, worktreePath, branchName, status, startedAt, completedAt, prUrl, prNumber, log). `agent_desk_requirement_sources` 요구사항 소스 (sessionId FK, sourceType enum, title, rawContent, parsedContent, priority int, trustScore int, parseStatus enum, fileId FK→agent_desk_files, metadata jsonb). `agent_desk_normalized_requirements` 정규화된 요구사항 (sessionId FK, category enum, summary varchar(500), detail text, sourceIds text[], confidence int, conflictStatus enum, dedupeGroupId uuid). Relations: sessions→files(many), sessions→messages(many), sessions→executions(many), sessions→requirementSources(many), sessions→normalizedRequirements(many). **flowData** JSONB: `{ screens: FlowScreen[], currentScreenIndex: number }` — FlowScreen: id, name, order, description, wireframeType, wireframeMermaid, nextScreenIds, metadata |
| ai-image | `features/ai-image/index.ts` | AI 이미지 생성 3개 테이블. 3 enums: `ai_image_generation_status` (pending/generating/completed/failed), `ai_image_style_category` (instagram/thumbnail/banner), `ai_image_format` (feed/carousel/story/reels_cover). `ai_image_generations` 생성 이력 (userId FK→profiles, prompt, styleTemplateId FK→ai_image_style_templates, format enum default "feed", contentThemeId FK→ai_image_content_themes, inputImageUrl, outputImageUrl, status, errorMessage, metadata jsonb, isDeleted, deletedAt). `ai_image_style_templates` 스타일 템플릿 (name, slug unique, description, promptSuffix, category enum, thumbnailUrl, sortOrder, isActive). `ai_image_content_themes` 콘텐츠 테마 (name, slug unique, description, promptTemplate, recommendedStyleIds text[], recommendedFormat, thumbnailUrl, sortOrder, isActive). JSONB 타입: `AiImageGenerationMetadata` (model, themeVariables Record) |
| task | `features/task/index.ts` | 태스크 관리 7개 테이블. 4 enums: `task_status` (backlog/todo/in_progress/in_review/done/canceled/duplicate), `task_activity_action` (created/status_changed/priority_changed/assigned/unassigned/label_added/label_removed/project_changed/cycle_changed/estimate_changed/due_date_changed/title_changed/description_changed/parent_changed/commented), `task_project_status` (planned/started/paused/completed/canceled), `task_cycle_status` (active/completed). `task_tasks` 태스크 (identifier unique, number serial, title, description, status, priority int, assigneeId FK→profiles, createdById FK→profiles, projectId FK→task_projects, cycleId FK→task_cycles, parentId self-FK, dueDate, completedAt, estimate, sortOrder). `task_projects` 프로젝트 (name, slug unique, description, icon, color, status, startDate, targetDate, createdById FK→profiles). `task_cycles` 사이클 (name, number serial, status, startDate, endDate, createdById FK→profiles). `task_labels` 라벨 (name, color, description). `task_task_labels` 태스크-라벨 조인 (taskId+labelId 복합 PK). `task_comments` 댓글 (taskId FK, authorId FK→profiles, content, soft delete). `task_activities` 활동 이력 (taskId FK, actorId FK→profiles, action enum, fromValue, toValue, metadata jsonb). 인덱스: status, assigneeId, projectId, cycleId, parentId, createdAt |
| booking | `features/booking/index.ts` | 예약 상담 매칭 9개 테이블. 5 enums: `booking_provider_status` (pending_review/active/inactive/suspended), `booking_consultation_mode` (online/offline/hybrid), `booking_status` (pending_payment/confirmed/completed/no_show/cancelled_by_user/cancelled_by_provider/refunded/expired), `booking_override_type` (unavailable/available), `booking_product_status` (active/inactive). `booking_categories` 카테고리. `booking_providers` 상담사 프로필 (bio, qualifications jsonb, languages jsonb, sessionModes jsonb, status). `booking_provider_categories` 상담사-카테고리 매핑. `booking_session_products` 세션 상품 (name, description, basePrice, durationMinutes, status). `booking_provider_products` 상담사별 상품 (customPrice). `booking_weekly_schedules` 주간 스케줄 (dayOfWeek, startTime, endTime, isActive). `booking_schedule_overrides` 스케줄 오버라이드 (date, type, startTime, endTime). `booking_bookings` 예약 (bookingNumber, providerId, userId, productId, sessionDate, startTime, endTime, consultationMode, status, paymentAmount). `booking_refund_policy` 환불 정책 (name, description, rules jsonb, isActive) |
| story | `features/story/index.ts` | Product Builder 로어 작업공간 테이블. `story_worlds`, `story_characters`, `story_locations`, `story_factions`, `story_codex`, `story_drafts`, `story_tags`, `story_entity_tags`, `story_relations`, `story_entity_properties`가 프로젝트 범위(`project_id`)를 가진다. Story 콘텐츠 행은 `description`을 관리용 설명/요약으로, `body`를 실제 작성 본문으로 분리한다. `story_characters.roles`는 playable/NPC/companion 같은 캐릭터 분류를 `string[]` JSONB로 저장한다. `story_drafts`도 `title`, `description`, `body`, `sort_order`를 가진다. `story_entity_tags`는 `entity_id`, `entity_type`, `tag_id`, `project_id`를 저장한다. `story_entity_properties.properties`는 `{ key, value }[]` JSONB로 일반화된 엔티티 확장 속성을 저장하며, 캐릭터 대표 이미지는 `imageSmallUrl` key를 사용한다. |

| story-quest | `features/story-quest/index.ts` | CRPG Quest Authoring MVP의 세계 상태/퀘스트 테이블. `story_quest_world_states`는 프로젝트 범위 `project_id`, 사용자용 `name`/`description`, 시스템용 `key`, `value_kind` enum(`boolean`, `number`, `text`, `option`), `initial_value`, `sort_order`, `owner_id`, soft delete 컬럼을 가진다. active row 기준 `(project_id, key)` partial unique index로 중복 key를 차단한다. `story_quest_world_state_options`는 option 종류 상태의 선택지를 `world_state_id` 하위에 저장하며 active row 기준 `(world_state_id, key)` partial unique index를 가진다. `story_quests`는 title/summary, `quest_type`, `design_status`, `priority`, activation/completion 설정과 soft delete 컬럼을 가진다. `story_objectives`와 `story_journal_entries`는 quest 하위 ordered child table로 objective 조건과 journal 본문을 저장한다. `story_quest_links`는 퀘스트 또는 목표를 문서에 연결하기 위해 `quest_id`, optional `objective_id`, `target_node_id`, `target_node_type`, label을 저장한다. Product Builder 신규 기능은 서버 권위 schema/API 경로를 기준으로 한다. |

| feature-catalog | `features/feature-catalog/index.ts` | 카탈로그 Feature 2개 테이블. 2 enums: `catalog_feature_group` (core/content/commerce/system), `catalog_dependency_type` (required/recommended/optional). `catalog_features` 카탈로그 Feature (name, slug unique, description, icon, group enum, isPublished, sortOrder). `catalog_dependencies` 의존성 (featureId FK→catalog_features, dependsOnId FK→catalog_features, type enum). Prefix: `catalog_` |

## Utility Types

| 이름 | 경로 | 설명 |
|------|------|------|
| `InferSelect<T>` | `src/utils/types.ts` | 테이블 select 타입 추론 |
| `InferInsert<T>` | `src/utils/types.ts` | 테이블 insert 타입 추론 |
