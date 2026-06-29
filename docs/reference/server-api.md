# Server API References

## Current Contract Source

NestJS REST controllers and the generated OpenAPI document are the active API
contract source. The generated client is verified with:

```bash
pnpm api:verify
```

`apps/server/scripts/dump-openapi.sh` starts a dedicated local server and reads
`/api-docs/json`; if the target port is already occupied, it fails instead of
reusing an unknown server. During `OPENAPI_DUMP=1`, the script injects
deterministic dummy-but-valid env values for the required `DATABASE_URL` and
optional provider-backed modules such as Polar payment and SOLAPI message
sending so the OpenAPI route surface does not depend on local or CI secrets.
Runtime boot outside the dump path still uses the normal env-gated feature
registration.

## Board Feature
| Route | HTTP Method | Purpose | Implementation |
|-------|-------------|---------|---------------|
| `/api/v1/board` | `GET` | List boards | `packages/features/board/trpc/board.route.ts` |
| `/api/v1/board` | `POST` | Create board | `packages/features/board/trpc/board.route.ts` |
| `/api/v1/board/:id` | `GET` | Get board detail | `packages/features/board/trpc/board.route.ts` |
| `/api/v1/board/:id` | `PATCH` | Update board | `packages/features/board/trpc/board.route.ts` |
| `/api/v1/board/:id` | `DELETE` | Delete board | `packages/features/board/trpc/board.route.ts` |
| `/api/v1/board/:id/posts` | `GET` | List posts in board | `packages/features/board/trpc/board.route.ts` |
| `/api/v1/board/:id/posts` | `POST` | Create post in board | `packages/features/board/trpc/board.route.ts` |
| `/api/v1/board/:id/posts/:postId` | `PATCH` | Update post | `packages/features/board/trpc/board.route.ts` |
| `/api/v1/board/:id/posts/:postId` | `DELETE` | Delete post | `packages/features/board/trpc/board.route.ts` |

## Comment Feature
| Route | HTTP Method | Purpose | Implementation |
|-------|-------------|---------|---------------|
| `/api/v1/comment` | `GET` | List comments | `packages/features/comment/trpc/comment.route.ts` |
| `/api/v1/comment` | `POST` | Create comment | `packages/features/comment/trpc/comment.route.ts` |
| `/api/v1/comment/:id` | `PATCH` | Update comment | `packages/features/comment/trpc/comment.route.ts` |
| `/api/v1/comment/:id` | `DELETE` | Delete comment | `packages/features/comment/trpc/comment.route.ts` |

## Community Feature
| Route | HTTP Method | Purpose | Implementation |
|-------|-------------|---------|---------------|
| `/api/v1/community` | `GET` | List communities | `packages/features/community/trpc/community.route.ts` |
| `/api/v1/community` | `POST` | Create community | `packages/features/community/trpc/community.route.ts` |
| `/api/v1/community/:id` | `GET` | Get community detail | `packages/features/community/trpc/community.route.ts` |
| `/api/v1/community/:id` | `PATCH` | Update community | `packages/features/community/trpc/community.route.ts` |
| `/api/v1/community/:id` | `DELETE` | Delete community | `packages/features/community/trpc/community.route.ts` |
| `/api/v1/community/:id/posts` | `GET` | List posts in community | `packages/features/community/trpc/feed.route.ts` |
| `/api/v1/community/:id/posts` | `POST` | Create post in community | `packages/features/community/trpc/feed.route.ts` |
| `/api/v1/community/:id/posts/:postId` | `PATCH` | Update post | `packages/features/community/trpc/feed.route.ts` |
| `/api/v1/community/:id/posts/:postId` | `DELETE` | Delete post | `packages/features/community/trpc/feed.route.ts` |
| `/api/v1/community/:id/posts/:postId/vote` | `POST` | Vote on post | `packages/features/community/trpc/vote.route.ts` |
| `/api/v1/community/:id/comments` | `GET` | List comments for community | `packages/features/community/trpc/comment.route.ts` |
| `/api/v1/community/:id/comments` | `POST` | Create comment | `packages/features/community/trpc/comment.route.ts` |
| `/api/v1/community/:id/comments/:commentId` | `PATCH` | Update comment | `packages/features/community/trpc/comment.route.ts` |
| `/api/v1/community/:id/comments/:commentId` | `DELETE` | Delete comment | `packages/features/community/trpc/comment.route.ts` |

## Profile Feature
| Route | HTTP Method | Purpose | Implementation |
|-------|-------------|---------|----------------|
| `/api/v1/profile` | `GET` | Get user profile | `packages/features/profile/trpc/profile.route.ts` |
| `/api/v1/profile` | `PATCH` | Update user profile | `packages/features/profile/trpc/profile.route.ts` |
| `/api/v1/profile/avatar` | `POST` | Upload avatar | `packages/features/profile/trpc/profile.route.ts` |
| `/api/v1/profile/avatar` | `DELETE` | Remove avatar | `packages/features/profile/trpc/profile.route.ts` |

## Graph Content Feature
| Route | HTTP Method | Purpose | Implementation |
|-----|------|---------|--|
| `/api/v1/graph-content` | `GET` | List graph nodes | `packages/features/graph-content/trpc/graph-content.route.ts` |
| `/api/v1/graph-content` | `POST` | Create graph node | `packages/features/graph-content/trpc/graph-content.route.ts` |
| `/api/v1/graph-content/:id` | `GET` | Get graph node | `packages/features/graph-content/trpc/graph-content.route.ts` |
| `/api/v1/graph-content/:id` | `PATCH` | Update graph node | `packages/features/graph-content/trpc/graph-content.route.ts` |
| `/api/v1/graph-content/:id` | `DELETE` | Delete graph node | `packages/features/graph-content/trpc/graph-content.route.ts` |
| Route | HTTP Method | Purpose | Implementation |
|-------|-------------|---------|---------------|
| `/api/v1/graph-content` | `GET` | List graph nodes | `packages/features/graph-content/trpc/graph-content.route.ts` |
| `/api/v1/graph-content` | `POST` | Create graph node | `packages/features/graph-content/trpc/graph-content.route.ts` |
| `/api/v1/graph-content/:id` | `GET` | Get graph node | `packages/features/graph-content/trpc/graph-content.route.ts` |
| `/api/v1/graph-content/:id` | `PATCH` | Update graph node | `packages/features/graph-content/trpc/graph-content.route.ts` |
| `/api/v1/graph-content/:id` | `DELETE` | Delete graph node | `packages/features/graph-content/trpc/graph-content.route.ts` |

## Hello‑World Feature
| Route | HTTP Method | Purpose | Implementation |
|-------|-------------|---------|---------------|
| `/api/v1/hello-world` | `GET` | Hello world greeting | `packages/features/hello-world/trpc/hello-world.route.ts` |

## Reaction Feature
| Route | HTTP Method | Purpose | Implementation |
|-------|-------------|---------|---------------|
| `/api/v1/reaction` | `GET` | List reactions | `packages/features/reaction/trpc/reaction.route.ts` |
| `/api/v1/reaction` | `POST` | Create reaction | `packages/features/reaction/trpc/reaction.route.ts` |
| `/api/v1/reaction/:id` | `PATCH` | Update reaction | `packages/features/reaction/trpc/reaction.route.ts` |
| `/api/v1/reaction/:id` | `DELETE` | Delete reaction | `packages/features/reaction/trpc/reaction.route.ts` |

## Review Feature
| Route | HTTP Method | Purpose | Implementation |
|-------|-------------|---------|---------------|
| `/api/v1/review` | `GET` | List reviews | `packages/features/review/trpc/review.route.ts` |
| `/api/v1/review` | `POST` | Create review | `packages/features/review/trpc/review.route.ts` |
| `/api/v1/review/:id` | `GET` | Get review detail | `packages/features/review/trpc/review.route.ts` |
| `/api/v1/review/:id` | `PATCH` | Update review | `packages/features/review/trpc/review.route.ts` |
| `/api/v1/review/:id` | `DELETE` | Delete review | `packages/features/review/trpc/review.route.ts` |

## Notification Feature
| Route | HTTP Method | Purpose | Implementation |
|-------|-------------|---------|---------------|
| `/api/v1/notification` | `GET` | List notifications | `packages/features/notification/trpc/notification.route.ts` |
| `/api/v1/notification` | `POST` | Create notification | `packages/features/notification/trpc/notification.route.ts` |
| `/api/v1/notification/:id` | `GET` | Get notification detail | `packages/features/notification/trpc/notification.route.ts` |
| `/api/v1/notification/:id` | `PATCH` | Update notification | `packages/features/notification/trpc/notification.route.ts` |
| `/api/v1/notification/:id` | `DELETE` | Delete notification | `packages/features/notification/trpc/notification.route.ts` |

## Payment Feature
| Route | HTTP Method | Purpose | Implementation |
|-------|-------------|---------|---------------|
| `/api/v1/payment/webhook` | `POST` | Handle webhook from Stripe | `packages/features/payment/controller/public/webhook.controller.ts` |
| `/api/v1/payment/checkout` | `POST` | Create checkout session | `packages/features/payment/controller/public/payment.controller.ts` |
| `/api/v1/payment/subscription` | `POST` | Create subscription | `packages/features/payment/controller/auth/subscription.controller.ts` |
| `/api/v1/payment/subscription/:id/cancel` | `POST` | Cancel subscription | `packages/features/payment/controller/auth/subscription.controller.ts` |
| `/api/v1/payment/refund` | `POST` | Process refund | `packages/features/payment/controller/public/payment.controller.ts` |
| `/api/payment/inicis/checkouts` | `POST` | Create INICIS PC standard checkout form payload | `packages/features/payment/controller/inicis.controller.ts` |
| `/api/payment/inicis/return` | `POST` | Handle INICIS form-urlencoded auth return, request approval, redirect with stable status/code | `packages/features/payment/controller/inicis.controller.ts` |
| `/api/payment/inicis/callback` | `POST` | Alias for INICIS form-urlencoded auth callback | `packages/features/payment/controller/inicis.controller.ts` |
| `/api/payment/orders/:orderId` | `GET` | Get the authenticated user's masked INICIS order status | `packages/features/payment/controller/inicis.controller.ts` |
| `/api/webhooks/inicis/noti` | `POST` | Handle INICIS PC/mobile form-urlencoded virtual-account noti; validates configured source IP allowlist/local order match and returns `OK` only on successful processing | `packages/features/payment/controller/inicis.controller.ts` |
| `/api/admin/payment/inicis/status` | `GET` | Read INICIS env/config readiness without exposing secret or noti IP allowlist values | `packages/features/payment/controller/inicis.controller.ts` |
| `/api/admin/payment/inicis/orders` | `GET` | List masked INICIS orders with search/status/period filters | `packages/features/payment/controller/inicis.controller.ts` |
| `/api/admin/payment/inicis/orders/:orderId` | `GET` | Read masked INICIS order detail with event timeline and entitlement status | `packages/features/payment/controller/inicis.controller.ts` |
| `/api/admin/payment/inicis/events` | `GET` | List masked INICIS provider events | `packages/features/payment/controller/inicis.controller.ts` |
| `/api/admin/payment/inicis/events/:eventId` | `GET` | Read a masked INICIS provider event | `packages/features/payment/controller/inicis.controller.ts` |
| `/api/admin/payment/inicis/orders/:orderId/cancel` | `POST` | Request full cancel or partial refund through INICIS Cancel API V2 | `packages/features/payment/controller/inicis.controller.ts` |
| `/api/admin/payment/inicis/orders/:orderId/refund` | `POST` | Alias for INICIS cancel/refund operation | `packages/features/payment/controller/inicis.controller.ts` |
| `/api/admin/payment/inicis/orders/:orderId/inquiry` | `POST` | Run INICIS inquiry V2 and record the result | `packages/features/payment/controller/inicis.controller.ts` |
| `/api/admin/payment/inicis/events/:eventId/replay` | `POST` | Record a manual replay marker for an INICIS provider event | `packages/features/payment/controller/inicis.controller.ts` |

## Profile Feature
| Route | HTTP Method | Purpose | Implementation |
|-------|-------------|---------|----------------|
| `/api/v1/profile` | `GET` | Get user profile | `packages/features/profile/trpc/profile.route.ts` |
| `/api/v1/profile` | `PATCH` | Update user profile | `packages/features/profile/trpc/profile.route.ts` |
