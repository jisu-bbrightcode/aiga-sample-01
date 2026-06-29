/**
 * apps/server wiring factory for the notification.core capability (PB-NOTI-001).
 *
 * Framework-agnostic on purpose (same approach as the observability nest
 * adapter): no `@nestjs/*` import. apps/server registers the returned
 * {@link NotificationService} as a provider under {@link NOTIFICATION_SERVICE}
 * and injects it into auth / payment / service modules.
 *
 * This is where env + feature-selection become concrete providers:
 *   - Email(Resend) is wired when `features.email` is on and `RESEND_API_KEY`
 *     is present; otherwise the channel is N/A-skipped by the router.
 *   - Kakao 알림톡 is wired when `features.alimtalk` is on and its creds exist.
 *   - in-app always wires to the base notification inbox sink.
 */

import { type ChannelFeatureConfig } from '../lib/channel-router.ts';
import {
  TemplateRegistry,
  defaultTemplates,
} from '../lib/template-registry.ts';
import {
  NotificationService,
  type NotificationServiceDeps,
} from '../lib/notification-service.ts';
import {
  AlimTalkProvider,
  type AlimTalkTransport,
} from '../lib/providers/alimtalk.ts';
import {
  InAppProvider,
  type InboxSink,
} from '../lib/providers/inapp.ts';
import {
  ResendProvider,
  type ResendTransport,
} from '../lib/providers/resend.ts';
import {
  type Channel,
  type Clock,
  type IdGen,
  type NotificationChannelProvider,
  type NotificationHistoryStore,
  type TemplateDefinition,
} from '../lib/types.ts';

/** DI token apps/server binds the assembled service to. */
export const NOTIFICATION_SERVICE = 'NOTIFICATION_SERVICE';

/** Everything apps/server must supply from env + base wiring. */
export interface NotificationModuleConfig {
  features: ChannelFeatureConfig;
  history: NotificationHistoryStore;
  /** Always required (base inbox). */
  inboxSink: InboxSink;
  /** Required iff `features.email`. */
  resend?: { from: string; transport: ResendTransport };
  /** Required iff `features.alimtalk`. */
  alimtalk?: { senderKey: string; transport: AlimTalkTransport };
  /** Extra templates registered on top of {@link defaultTemplates}. */
  extraTemplates?: readonly TemplateDefinition[];
  clock?: Clock;
  idGen?: IdGen;
}

/** Misconfiguration (feature on but transport missing) — fail fast at boot. */
export class NotificationConfigError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'NotificationConfigError';
  }
}

/**
 * Build the registry from defaults + any extras (immutable folds).
 */
export function buildRegistry(
  extras: readonly TemplateDefinition[] = [],
): TemplateRegistry {
  let registry = TemplateRegistry.fromDefinitions(defaultTemplates());
  for (const def of extras) {
    registry = registry.register(def);
  }
  return registry;
}

/**
 * Assemble providers honoring feature selection. A feature that is ON but
 * missing its transport is a boot-time config error (never a silent skip).
 */
export function buildProviders(
  config: NotificationModuleConfig,
): Partial<Record<Channel, NotificationChannelProvider>> {
  const providers: Partial<Record<Channel, NotificationChannelProvider>> = {
    inapp: new InAppProvider(config.inboxSink),
  };

  if (config.features.email) {
    if (!config.resend) {
      throw new NotificationConfigError(
        'features.email is on but no Resend transport/from was provided',
      );
    }
    providers.email = new ResendProvider({
      from: config.resend.from,
      transport: config.resend.transport,
    });
  }

  if (config.features.alimtalk) {
    if (!config.alimtalk) {
      throw new NotificationConfigError(
        'features.alimtalk is on but no AlimTalk transport/senderKey was provided',
      );
    }
    providers.alimtalk = new AlimTalkProvider({
      senderKey: config.alimtalk.senderKey,
      transport: config.alimtalk.transport,
    });
  }

  return providers;
}

/** Compose the full {@link NotificationService} for apps/server DI. */
export function createNotificationService(
  config: NotificationModuleConfig,
): NotificationService {
  const deps: NotificationServiceDeps = {
    registry: buildRegistry(config.extraTemplates ?? []),
    features: config.features,
    providers: buildProviders(config),
    history: config.history,
    ...(config.clock ? { clock: config.clock } : {}),
    ...(config.idGen ? { idGen: config.idGen } : {}),
  };
  return new NotificationService(deps);
}
