/**
 * aiga-notification (PB-NOTI-001) — public surface of the notification.core
 * capability.
 *
 * EXTEND of product-builder-base @111d7721
 *   `packages/features/notification` (in-app inbox) +
 *   `packages/features/email` (Resend + email_logs).
 *
 * Core (framework-agnostic; vendors into apps/server on the PB-REPO-001 seed):
 *   types/ports · template registry · channel router · retry policy ·
 *   history store · channel providers (resend / alimtalk / inapp) ·
 *   NotificationService orchestrator · notification_logs schema.
 *
 * NestJS adapter lives under `aiga-notification/nest`.
 */

export * from './types.ts';
export * from './template-registry.ts';
export * from './channel-router.ts';
export * from './retry-policy.ts';
export * from './history-store.ts';
export * from './schema.ts';
export * from './notification-service.ts';
export { ResendProvider } from './providers/resend.ts';
export type {
  ResendProviderConfig,
  ResendTransport,
  ResendTransportResult,
  ResendSendPayload,
} from './providers/resend.ts';
export { AlimTalkProvider } from './providers/alimtalk.ts';
export type {
  AlimTalkProviderConfig,
  AlimTalkTransport,
  AlimTalkTransportResult,
  AlimTalkSendPayload,
} from './providers/alimtalk.ts';
export { InAppProvider } from './providers/inapp.ts';
export type { InboxSink, InboxEntry } from './providers/inapp.ts';
