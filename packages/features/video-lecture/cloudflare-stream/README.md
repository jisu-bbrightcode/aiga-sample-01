# Cloudflare Stream Video Lecture Provider

This provider wraps Cloudflare Stream as the reusable video lecture capability for Product Builder Base.

## Source Map

| Capability | Official source | Implemented surface |
| --- | --- | --- |
| Direct creator upload | `https://developers.cloudflare.com/stream/uploading-videos/direct-creator-uploads/` | `createDirectCreatorUpload()` calls `POST /accounts/{account_id}/stream/direct_upload` with `maxDurationSeconds` and `requireSignedURLs`; clients receive only the one-time `uploadURL` and `uid`. |
| Upload method policy | Same direct creator upload guide | Basic POST is for videos under 200 MB and reliable connections; tus is required over 200 MB or recommended for unreliable connections. |
| tus upload endpoint | `https://developers.cloudflare.com/stream/uploading-videos/direct-creator-uploads/#direct-creator-uploads-with-tus-protocol` | `createTusCreatorUpload()` calls `POST /accounts/{account_id}/stream?direct_user=true` with `Tus-Resumable`, `Upload-Length`, and optional `Upload-Metadata`; upload URL is read from `Location`. |
| tus chunk limits | `https://developers.cloudflare.com/stream/uploading-videos/resumable-uploads/` | `validateTusChunkSize()` enforces minimum `5,242,880`, maximum `209,715,200`, and `256 KiB` divisibility. |
| tus video id | Same tus guide | `stream-media-id` response header is captured; the Location URL is not parsed for identity. |
| Signed playback | `https://developers.cloudflare.com/stream/viewing-videos/securing-your-stream/` | `createSignedPlaybackToken()` calls `POST /accounts/{account_id}/stream/{video_uid}/token`; player uses the token in the Cloudflare iframe URL. |
| Private playback flag | Same signed URL guide | `updateCloudflareStreamVideoMetadata()` can set `requireSignedURLs`. |
| Webhook subscription and payload | `https://developers.cloudflare.com/stream/manage-video-library/using-webhooks/` | `verifyCloudflareStreamWebhookSignature()` validates `Webhook-Signature`; payload sync uses `uid`, `readyToStream`, `status.state`, `status.pctComplete`, `duration`, `thumbnail`, and `playback`. Non-ready payloads stay `processing` until `readyToStream === true`. |
| Webhook signature | Same webhook guide | Source string is `time + "." + raw request body`; expected signature is HMAC-SHA256 hex and compared in constant time. |

## Security Rules

- Cloudflare API tokens are never exposed to client code.
- Playback tokens are issued by the server only after lesson visibility and entitlement checks.
- OpenAPI examples must not include provider secrets or signed token samples.
- Raw webhook bodies must be preserved for signature verification.
