# Video Lecture Cloudflare Stream Capability

Status: implemented as a reusable Product Builder Base capability.

## Reuse Sources

| Product Builder task | Reuse source |
| --- | --- |
| `PB-VIDEO-001` | `product-builder-base:packages/features/video-lecture/cloudflare-stream@<commit>` |
| `PB-VIDEO-DATA-001` | `product-builder-base:packages/drizzle/src/schema/features/video-lecture@<commit>` |
| `PB-VIDEO-API-UPLOAD-001` | `product-builder-base:packages/features/video-lecture/controller@<commit>` |
| `PB-VIDEO-WEBHOOK-001` | `product-builder-base:packages/features/video-lecture/cloudflare-stream/src/webhook.ts@<commit>` |
| `PB-VIDEO-API-PLAYBACK-001` | `product-builder-base:packages/features/video-lecture/service/video-lecture.service.ts@<commit>` |
| `PB-VIDEO-PLAYER-UI-001` | `product-builder-base:packages/features/video-lecture/player-ui@<commit>` |
| `PB-VIDEO-ADMIN-001` | `product-builder-base:apps/admin/src/features/video-lecture@<commit>` |
| `PB-VIDEO-QA-001` | `product-builder-base:tests/video-lecture/reusable-checklist.md@<commit>` |

## Capability Registry

Export: `@flotter/features/video-lecture/service-registry`

| Capability key | Surface |
| --- | --- |
| `video-lecture.cloudflare-stream.direct-upload` | Server-issued one-time Cloudflare Stream direct upload URL. |
| `video-lecture.cloudflare-stream.tus-upload` | Server-issued tus upload endpoint with documented chunk policy. |
| `video-lecture.cloudflare-stream.webhook` | Raw-body `Webhook-Signature` verification and explicit processing/ready/failed state sync. |
| `video-lecture.cloudflare-stream.signed-playback` | Server-side access policy and entitlement provider check before signed token generation. |
| `video-lecture.cloudflare-stream.progress` | Throttled progress and completion persistence. |
| `video-lecture.cloudflare-stream.admin` | Admin list, upload session, archive, delete, events, progress summary. |
| `video-lecture.cloudflare-stream.player-ui` | Reusable responsive player state surface. |

## REST API

Public/app:

- `GET /api/video-courses`
- `GET /api/video-courses/:courseId`
- `GET /api/video-lessons/:lessonId`
- `POST /api/video-lessons/:lessonId/playback`
- `POST /api/video-lessons/:lessonId/progress`
- `GET /api/me/video-progress`

Admin:

- `POST /api/admin/video-lectures/uploads`
- `GET /api/admin/video-lectures`
- `GET /api/admin/video-lectures/:id`
- `PATCH /api/admin/video-lectures/:id`
- `DELETE /api/admin/video-lectures/:id`
- `POST /api/admin/video-lectures/:id/archive`
- `POST /api/admin/video-lectures/:id/retry`
- `GET /api/admin/video-lectures/:id/progress`
- `GET /api/admin/video-lectures/events`

Webhook:

- `POST /api/webhooks/cloudflare-stream`

## Environment

- `CLOUDFLARE_ACCOUNT_ID`
- `CLOUDFLARE_STREAM_API_TOKEN`
- `CLOUDFLARE_STREAM_WEBHOOK_SECRET`
- `CLOUDFLARE_STREAM_CUSTOMER_SUBDOMAIN` for iframe/HLS URL construction.

The server can boot without these values, but provider actions fail with a stable video lecture config code until configured.

## Extension Points

- `VideoLectureEntitlementProvider` is the purchase/subscription integration point. The default provider denies paid access until a product-specific payment/subscription adapter is bound.
- `access-policy.ts` owns public metadata vs preview vs full playback decisions so visibility never bypasses entitlement.
- `asset-status.ts` owns Cloudflare webhook state transitions and only marks an asset ready when `readyToStream === true`.

## Source Map

The provider source map is maintained in `packages/features/video-lecture/cloudflare-stream/README.md`.
