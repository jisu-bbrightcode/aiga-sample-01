# Product Builder Base: Cloudflare Stream Video Lecture REUSE Feature Handoff

## 목적

`product-builder-base`에 온라인 영상 강의 feature를 재사용 가능한 capability로 먼저 구현한다.

최종 목표는 Product Builder에서 `온라인 영상 강의(Cloudflare Stream)` 선택 시 신규 임시 구현이 아니라 아래처럼 검증 가능한 REUSE source를 사용할 수 있게 만드는 것이다.

```text
product-builder-base:packages/features/video-lecture/cloudflare-stream@<tag-or-commit>
product-builder-base:packages/features/video-lecture/schema@<tag-or-commit>
product-builder-base:packages/features/video-lecture/rest-api@<tag-or-commit>
product-builder-base:packages/features/video-lecture/player-ui@<tag-or-commit>
product-builder-base:apps/admin/features/video-lecture@<tag-or-commit>
product-builder-base:tests/video-lecture/reusable-checklist@<tag-or-commit>
```

## 작업 위치

- 대상 repo: `/Users/bright/Projects/product-builder-base`
- 원격 repo: `https://github.com/BBrightcode-atlas/product-builder-base`
- 기준 branch: `develop`
- Paperclip/Product Builder repo는 템플릿과 issue 구조 참고용이다. 구현 코드는 Product Builder plugin repo가 아니라 `product-builder-base`에 넣는다.

## feature 경계

이 feature는 단순 파일 업로드가 아니다.

- 원본 영상 파일은 앱 서버, Vercel Blob, public bucket에 저장하지 않는다.
- provider는 Cloudflare Stream으로 고정한다.
- 영상 upload, processing status, playback security, progress, admin operation까지 하나의 재사용 feature로 묶는다.
- 결제/구독 entitlement와 연결될 수 있어야 하지만, 결제 provider 자체를 이 feature 안에 구현하지 않는다.
- 공개 사이트에서는 강의 설명/커리큘럼은 비로그인 탐색 가능해야 하고, 보호된 재생 액션에서 auth modal 또는 구매 CTA로 이어져야 한다.

## 절대 규칙

1. 추측 구현 금지.
   - Cloudflare Stream API field, webhook payload, signature 검증, signed playback token claim, upload metadata는 공식 문서/API reference로 확인된 값만 구현한다.
   - 예전 기억, 블로그, 유사 provider 구현을 근거로 API contract를 만들지 않는다.

2. Cloudflare API token은 클라이언트에 노출하지 않는다.
   - direct creator upload 또는 tus upload session은 서버가 발급한다.
   - 클라이언트는 one-time upload URL 또는 tus endpoint만 사용한다.

3. signed playback은 서버 권한 확인 뒤에만 발급한다.
   - 로그인, 구매/구독 entitlement, 무료 미리보기, 관리자 preview를 분리한다.
   - 공개 metadata API와 재생 token API를 분리한다.

4. webhook은 필수다.
   - upload session 생성만으로 ready 처리하지 않는다.
   - Cloudflare Stream processing 완료/실패 webhook을 검증하고 DB 상태와 관리자 UI에 반영한다.

5. REST API, 관리자 화면, player UI, OpenAPI, 테스트를 함께 만든다.
   - 서버 기능만 만들고 끝내지 않는다.
   - 운영자가 upload, processing 실패, visibility, archive/delete, progress 요약을 확인할 수 있어야 한다.

## 공식 참조 URL

첫 구현 세션은 아래 URL을 열고, 각 API별 요청/응답/주의사항을 source map으로 남겨야 한다.

- Cloudflare Stream overview: `https://developers.cloudflare.com/stream/`
- Direct creator uploads: `https://developers.cloudflare.com/stream/uploading-videos/direct-creator-uploads/`
- Resumable and large files(tus): `https://developers.cloudflare.com/stream/uploading-videos/resumable-uploads/`
- Secure your Stream / signed URLs: `https://developers.cloudflare.com/stream/viewing-videos/securing-your-stream/`
- Stream webhooks: `https://developers.cloudflare.com/stream/manage-video-library/using-webhooks/`
- Stream API reference: `https://developers.cloudflare.com/api/resources/stream/`

공식 문서에서 확인해야 하는 최소 항목:

- Upload
  - direct creator upload 생성 API
  - basic POST upload와 tus upload 선택 기준
  - `maxDurationSeconds`
  - upload expiry
  - `uid` / video id mapping
  - `Upload-Metadata`
  - creator/user 식별 정책

- tus
  - 200MB 초과 영상의 tus 사용 조건
  - chunk size 제한
  - `stream-media-id` header에서 video id를 얻는 방식
  - resume/retry 정책

- Playback security
  - `requireSignedURLs`
  - signed token 발급 방식
  - token 만료 정책
  - allowed origins / hotlinking protection
  - 공개 preview와 유료 full playback 분리 가능 여부

- Webhook
  - webhook subscription 설정
  - notification URL 조건
  - signing secret
  - `Webhook-Signature` header 검증
  - request body 원문 보존 필요성
  - processing success/fail event
  - `readyToStream` 조건
  - localhost 불가, public URL 필요

- Manage/delete
  - video metadata update
  - archive/delete or scheduled deletion
  - failed processing 대응
  - thumbnail/caption/subtitle metadata

## 구현 산출물

### 1. Provider package

base repo 구조를 먼저 확인해서 맞춘다. 구조가 없다면 아래 형태를 권장한다.

```text
packages/features/video-lecture/cloudflare-stream/
  src/
    config.ts
    types.ts
    client.ts
    upload.ts
    tus.ts
    webhook.ts
    playback.ts
    metadata.ts
    delete.ts
    progress.ts
    index.ts
  README.md
```

필수 책임:

- Cloudflare account id / Stream API token / webhook secret config validation
- direct creator upload session 생성
- tus upload option/session 생성
- provider asset id와 local video id 매핑
- webhook signature 검증
- processing state sync
- signed playback token/URL 발급
- metadata update
- archive/delete/scheduled deletion 정책
- progress helper
- provider error normalization

### 2. DB/schema

기존 course/lesson schema가 있으면 연결하고, 없으면 video lecture feature가 독립적으로 동작할 수 있는 최소 schema를 둔다.

최소 테이블/엔티티:

- `video_courses`
- `video_lessons`
- `video_assets`
- `video_asset_events`
- `video_playback_sessions`
- `video_progress`
- `video_entitlement_rules`
- `video_admin_actions`

필수 필드:

- local course id / lesson id
- provider: `cloudflare_stream`
- Cloudflare `uid` 또는 asset id
- playback uid
- upload status: `pending | uploading | processing | ready | failed | archived | deleted`
- `readyToStream`
- duration
- thumbnail
- captions/subtitles state
- visibility: `public | preview | protected | private`
- entitlement requirement
- free preview policy
- upload creator/admin id
- processing error code/message
- deletedAt / archivedAt
- audit fields

주의:

- 영상 원본 binary는 DB나 앱 서버에 저장하지 않는다.
- provider raw payload는 디버깅에 필요한 범위만 저장하고, token/secret은 저장하지 않는다.
- 진행률은 과도한 write를 방지할 수 있게 throttling/idempotency 기준을 둔다.

### 3. 내부 REST API

외부 Cloudflare API는 provider package가 감싸고, product-builder-base 내부 API는 REST + OpenAPI로 제공한다.

#### Public/App API

```text
GET  /api/video-courses
GET  /api/video-courses/:courseId
GET  /api/video-lessons/:lessonId
POST /api/video-lessons/:lessonId/playback
POST /api/video-lessons/:lessonId/progress
GET  /api/me/video-progress
```

각 endpoint 책임:

- `GET /api/video-courses`
  - 공개 가능한 course/lesson metadata 조회
  - 무료 미리보기/구매 필요/로그인 필요 상태 제공
  - 재생 token은 반환하지 않음

- `GET /api/video-lessons/:lessonId`
  - lesson 상세, processing 상태, thumbnail, duration, caption state 제공
  - viewer entitlement summary 제공
  - provider internal id 과노출 방지

- `POST /api/video-lessons/:lessonId/playback`
  - 로그인 여부 확인
  - 무료 미리보기 또는 구매/구독 entitlement 확인
  - Cloudflare signed playback 발급
  - token expiry와 playback policy 반환
  - 권한 없음이면 token 없이 auth modal/purchase CTA 상태 반환

- `POST /api/video-lessons/:lessonId/progress`
  - current time, watched segments, completed 여부 저장
  - rate limit/throttle 적용
  - 완료 기준 정책 적용

- `GET /api/me/video-progress`
  - 이어보기와 수강 현황 반환

#### Admin API

```text
POST   /api/admin/video-lectures/uploads
GET    /api/admin/video-lectures
GET    /api/admin/video-lectures/:id
PATCH  /api/admin/video-lectures/:id
DELETE /api/admin/video-lectures/:id
POST   /api/admin/video-lectures/:id/archive
POST   /api/admin/video-lectures/:id/retry
GET    /api/admin/video-lectures/:id/progress
GET    /api/admin/video-lectures/events
```

각 endpoint 책임:

- upload session 생성
- direct/tus 선택 및 policy 검증
- processing 상태 조회
- course/lesson 연결
- title/description/visibility/free preview/caption metadata 수정
- archive/delete/scheduled deletion
- failed processing retry/replacement flow
- 학습 진행률 요약
- provider event/audit 조회

#### Webhook API

```text
POST /api/webhooks/cloudflare-stream
```

책임:

- raw body 유지
- `Webhook-Signature` 검증
- timestamp freshness 검증
- idempotency 적용
- processing success/fail 상태 반영
- duration/thumbnail/playback id sync
- 실패 이벤트 운영 로그 저장

### 4. Player UI

권장 위치:

```text
packages/features/video-lecture/player-ui/
```

필수 상태:

- loading
- processing
- failed
- not logged in
- purchase required
- subscription required
- ready
- expired token retry
- archived/private

필수 기능:

- Cloudflare Stream player 또는 HLS/native player 연결
- signed playback response 기반 재생
- auth modal trigger
- purchase CTA
- free preview state
- 이어보기
- progress 저장
- completion event
- thumbnail/caption/subtitle 표시
- 모바일/데스크톱 responsive aspect ratio

주의:

- 권한 없는 상태에서는 playback API를 반복 호출하지 않는다.
- token을 localStorage에 장기 저장하지 않는다.
- public page는 로그인 wall이 아니라 보호 액션 modal 흐름을 따른다.

### 5. 관리자 화면

권장 위치:

```text
apps/admin/features/video-lecture/
```

필수 화면:

- 영상 목록
  - title, course/lesson, status, visibility, duration, uploadedBy, createdAt
  - 처리중/실패/ready/archive 상태 필터

- 영상 업로드
  - direct upload / tus upload 선택 또는 자동 선택
  - max duration/size/policy 표시
  - upload progress
  - pending asset 상태 표시

- 영상 상세
  - Cloudflare asset id
  - playback uid
  - processing status
  - thumbnail
  - captions/subtitles state
  - webhook event timeline
  - course/lesson mapping

- metadata 수정
  - title/description
  - free preview
  - visibility
  - entitlement requirement
  - caption/subtitle metadata

- archive/delete
  - 구매/수강 이력 보존 정책 표시
  - Cloudflare asset cleanup 결과 표시
  - 실패 보정 상태 표시

- progress summary
  - lesson별 시청자 수
  - completion rate
  - 사용자별 진행률 검색

### 6. OpenAPI

아래를 OpenAPI에 포함한다.

- course/lesson list/read
- playback request/response
- progress update/read
- admin upload session
- admin list/read/update/delete/archive
- webhook payload handling
- provider error shape
- visibility/entitlement state enum

OpenAPI에는 Cloudflare API token, webhook secret, signed token sample 원문을 넣지 않는다.

### 7. Tests / QA

필수 테스트:

- config validation
- direct upload session 생성
- tus upload option 검증
- upload size/duration policy
- webhook signature 검증
- webhook idempotency
- processing success/fail sync
- signed playback 권한 체크
- free preview vs protected playback
- progress throttling/idempotency
- archive/delete 보정
- admin permission
- player state rendering
- secret/token leak 방지

필수 E2E/smoke 증거:

- Cloudflare account id, Stream API token, webhook secret env 존재 확인
- 관리자 upload session 생성
- direct upload 또는 tus upload 성공
- webhook processing 완료 수신
- 관리자 UI에서 ready 상태 확인
- 비로그인 protected playback 시 auth modal
- 권한 없는 로그인 사용자는 purchase CTA
- 권한 있는 사용자는 배포 URL에서 재생 성공
- progress 저장과 이어보기 확인
- archive/delete 후 public/app/admin 상태 확인

## Product Builder issue mapping

이 구현이 완료되면 Product Builder의 PB-VIDEO task는 아래처럼 REUSE/EXTEND 판정이 가능해야 한다.

- `PB-VIDEO-001`
  - REUSE source: `product-builder-base:packages/features/video-lecture/cloudflare-stream@<tag-or-commit>`

- `PB-VIDEO-DATA-001`
  - REUSE source: `product-builder-base:packages/features/video-lecture/schema@<tag-or-commit>`

- `PB-VIDEO-API-UPLOAD-001`
  - REUSE source: `product-builder-base:packages/features/video-lecture/rest-api/upload@<tag-or-commit>`

- `PB-VIDEO-WEBHOOK-001`
  - REUSE source: `product-builder-base:packages/features/video-lecture/rest-api/webhook@<tag-or-commit>`

- `PB-VIDEO-API-LIST-001`
  - REUSE source: `product-builder-base:packages/features/video-lecture/rest-api/list@<tag-or-commit>`

- `PB-VIDEO-API-READ-001`
  - REUSE source: `product-builder-base:packages/features/video-lecture/rest-api/read@<tag-or-commit>`

- `PB-VIDEO-API-UPDATE-001`
  - REUSE source: `product-builder-base:packages/features/video-lecture/rest-api/update@<tag-or-commit>`

- `PB-VIDEO-API-DELETE-001`
  - REUSE source: `product-builder-base:packages/features/video-lecture/rest-api/delete@<tag-or-commit>`

- `PB-VIDEO-API-PLAYBACK-001`
  - REUSE source: `product-builder-base:packages/features/video-lecture/rest-api/playback@<tag-or-commit>`

- `PB-VIDEO-API-PROGRESS-001`
  - REUSE source: `product-builder-base:packages/features/video-lecture/rest-api/progress@<tag-or-commit>`

- `PB-VIDEO-PLAYER-UI-001`
  - REUSE source: `product-builder-base:packages/features/video-lecture/player-ui@<tag-or-commit>`

- `PB-VIDEO-ADMIN-001`
  - REUSE source: `product-builder-base:apps/admin/features/video-lecture@<tag-or-commit>`

- `PB-VIDEO-QA-001`
  - REUSE source: `product-builder-base:tests/video-lecture/reusable-checklist@<tag-or-commit>`

## Definition of Done

완료 조건:

- `product-builder-base`에 Cloudflare Stream video lecture capability가 구현되어 있다.
- REST API와 OpenAPI가 있다.
- 관리자 화면이 있다.
- player UI가 있다.
- direct upload/tus upload, processing webhook, signed playback, progress, archive/delete, QA가 모두 구현되어 있다.
- 공식 문서 source map이 `packages/features/video-lecture/cloudflare-stream/README.md` 또는 별도 docs에 남아 있다.
- 각 request/response/parser/test fixture가 어떤 공식 문서/API reference에 근거했는지 추적 가능하다.
- capability registry에 `video-lecture.cloudflare-stream.*`가 등록되어 있다.
- Product Builder에서 REUSE source로 쓸 수 있는 tag 또는 commit SHA가 있다.

완료로 보면 안 되는 상태:

- upload URL 생성만 있고 webhook 처리 완료 sync가 없다.
- public metadata API와 playback token API가 분리되어 있지 않다.
- signed playback 없이 Cloudflare video id만으로 보호 영상을 재생한다.
- 서버 API만 있고 player UI 또는 관리자 UI가 없다.
- progress/이어보기가 없다.
- Cloudflare API token이나 signed token이 클라이언트 또는 OpenAPI 예시에 노출된다.
- 공식 문서/API reference에 없는 payload/signature/token claim을 추측해서 넣었다.
- Vercel 배포 URL에서 webhook/playback 증거가 없다.

## 새 세션 시작 프롬프트

아래를 새 세션 첫 메시지로 사용한다.

```text
Product Builder Base repo에서 Cloudflare Stream 기반 온라인 영상 강의 feature를 재사용 가능한 capability로 구현해줘.

작업 위치:
- /Users/bright/Projects/product-builder-base
- branch 기준은 develop

목표:
- Product Builder에서 온라인 영상 강의 선택 시 PB-VIDEO-* task를 REUSE로 판정할 수 있게 packages/features/video-lecture/cloudflare-stream, schema, REST API, player UI, admin UI, tests, capability registry를 만든다.

절대 규칙:
- Cloudflare Stream 공식 문서/API reference에서 확인되지 않은 request/response field, webhook payload, signature 검증, signed playback token claim은 추측 구현하지 말 것.
- 외부 provider는 Cloudflare Stream으로 고정하고, 영상 원본을 앱 서버/Vercel Blob에 저장하지 말 것.
- direct upload/tus upload, processing webhook, signed playback, progress/이어보기, archive/delete, 관리자 화면, player UI, OpenAPI, QA까지 다룰 것.
- 공개 강의 설명/커리큘럼은 비로그인 탐색 가능하고, 보호된 재생 액션에서 auth modal 또는 구매 CTA로 이어지게 할 것.

참조 문서:
- Cloudflare Stream overview: https://developers.cloudflare.com/stream/
- Direct creator uploads: https://developers.cloudflare.com/stream/uploading-videos/direct-creator-uploads/
- Resumable and large files(tus): https://developers.cloudflare.com/stream/uploading-videos/resumable-uploads/
- Secure your Stream / signed URLs: https://developers.cloudflare.com/stream/viewing-videos/securing-your-stream/
- Stream webhooks: https://developers.cloudflare.com/stream/manage-video-library/using-webhooks/
- Stream API reference: https://developers.cloudflare.com/api/resources/stream/

먼저 이 문서를 읽고 source map과 구현 계획을 짧게 만든 뒤, base repo 구조를 확인해서 기존 feature/admin/API 패턴에 맞춰 구현해.
```
