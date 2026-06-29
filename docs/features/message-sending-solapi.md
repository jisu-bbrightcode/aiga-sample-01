# Message Sending: SOLAPI

## Scope

`packages/features/message-sending` provides a reusable SOLAPI message sending capability:

- SOLAPI config validation (`SOLAPI_ENABLED=true`, `SOLAPI_API_KEY`, `SOLAPI_API_SECRET`, `SOLAPI_DEFAULT_SENDER`, optional `SOLAPI_WEBHOOK_SECRET`)
- HMAC-authenticated `POST /messages/v4/send-many/detail` provider client
- Admin REST endpoint for sending messages
- Admin REST endpoints for request/message log lookup
- Public SOLAPI webhook endpoint with idempotency and phone-number masking
- Drizzle schema for requests, per-recipient messages, and provider events

This feature does not depend on a SOLAPI SDK. The provider boundary is a direct
REST/HMAC client in `SolapiClient`, so the vendor protocol stays isolated from
the service/controller layers.

## Template Activation

Product Builder base is cloned to create new projects. SOLAPI is therefore an
optional admin feature and is disabled by default in `.env.example`.

Required enablement:

- `SOLAPI_ENABLED=true`
- `SOLAPI_API_KEY`
- `SOLAPI_API_SECRET`
- `SOLAPI_DEFAULT_SENDER`
- optional `SOLAPI_WEBHOOK_SECRET`
- optional `SOLAPI_API_BASE_URL` (defaults to `https://api.solapi.com`)

Template placeholders such as `your_solapi_api_key` are rejected and do not count
as configured values. When the gate is off or config is invalid,
`MessageSendingModule` is not registered, so `/api/message-sending/solapi/*`,
`/api/admin/message-sending/*`, and `/api/webhooks/solapi` are not served.

## REST Surface

Server global prefix adds `/api`.

- `POST /api/message-sending/solapi/messages`
  - Admin only.
  - Creates a local request log and per-recipient message rows transactionally before calling SOLAPI.
  - Sends SOLAPI `showMessageList: true` so successful `messageList` and failed `failedMessageList` rows can be correlated immediately.
  - Each outbound SOLAPI message includes `customFields.productBuilderMessageId`, the local `message_sending_messages.id`, so `messageList` and later `SINGLE-REPORT` webhook events can update the correct recipient row without relying on provider response order.
  - `idempotencyKey` returns the existing request summary instead of sending again, including concurrent duplicate requests that lose the database unique-key race.
- `GET /api/admin/message-sending/requests`
  - Admin only. Supports `page`, `limit`, `status`.
- `GET /api/admin/message-sending/requests/:requestId`
  - Admin only. Returns request plus recipient message rows.
- `POST /api/webhooks/solapi`
  - Uses `X-Solapi-Secret`.
  - Accepts an array, a single object, or `{ data: [...] }`.
  - Stores provider events with a derived unique event key, then updates message status by `customFields.productBuilderMessageId` first and provider message id as a fallback.
  - Status updates use an explicit SOLAPI status map: `2000` → `accepted`, `3000` → `sent`, `4000` → `delivered`, `1xxx`/non-`2000` `2xxx`/non-`3000` `3xxx`/`5000`/`FAILED` → `failed`. Unknown values are logged but do not finalize a message as delivered.

## Provider Source Map

- SOLAPI API start/auth: https://solapi.com/developers/api/start
- SOLAPI messages API: https://solapi.com/developers/api/messages

The external provider request keeps SOLAPI field names (`to`, `from`, `text`, `type`, `country`, `subject`) and allows provider-specific fields under each message's `payload`.
If callers provide `payload.customFields`, the service preserves those keys and adds/overwrites only `productBuilderMessageId` for local correlation.

## Data Safety

Phone numbers are masked before storage in request/message logs and webhook payload snapshots. Provider failures are recorded for admin diagnostics, but public send failures return a stable `SOLAPI_SEND_FAILED` code with a non-provider-specific message.
If the provider call fails before SOLAPI accepts the group, both the request row and all recipient rows are marked `failed` so admin logs do not leave orphaned `pending` messages.
