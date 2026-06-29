# Video Lecture Reusable Checklist

## Automated

- [x] tus chunk policy enforces Cloudflare documented limits.
- [x] webhook signature uses `time.rawBody` HMAC-SHA256 and constant-time comparison.
- [x] webhook state sync keeps non-ready provider events in `processing`.
- [x] progress persistence helper throttles writes and computes completion.
- [x] completion progress writes bypass the throttle window.
- [x] access policy keeps preview/public metadata separate from full playback entitlement.
- [x] direct upload forwards `requireSignedURLs` to Cloudflare.
- [x] OpenAPI contains public, admin, playback, progress, and webhook routes.
- [x] Server and admin production builds compile with the video lecture module and route registered.
- [x] Admin `/video-lectures` route redirects unauthenticated users to sign-in in local browser fallback verification.

## Manual / Environment Required

- [ ] Cloudflare account id, Stream API token, webhook secret env exist.
- [ ] Admin upload session can be created.
- [ ] Direct upload succeeds for a file below 200 MB.
- [ ] tus upload succeeds for a file above 200 MB or unreliable connection scenario.
- [ ] Cloudflare webhook reaches a public `/api/webhooks/cloudflare-stream` URL.
- [ ] Admin UI shows `ready` after processing completion.
- [ ] Anonymous protected playback returns auth modal state without a token.
- [ ] Logged-in user without entitlement returns purchase/subscription CTA state without a token.
- [ ] Entitled user receives signed playback URL and can play from deployed URL.
- [ ] Progress saves and resume data appears in `GET /api/me/video-progress`.
- [ ] Archive/delete updates admin, public, and playback states.
