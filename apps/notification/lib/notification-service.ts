/**
 * NotificationService (PB-NOTI-001) — the provider-agnostic orchestrator and
 * the public "port" of this capability.
 *
 * Generalizes product-builder-base `EmailProvider.send()` into a single entry
 * point that, per send:
 *   1. resolves the `<domain>.<event>` template (template-registry.ts),
 *   2. routes to feature-enabled channels with an address (channel-router.ts),
 *   3. renders + sends via the per-channel provider, retrying transient
 *      failures per policy (retry-policy.ts),
 *   4. persists one history row per channel (history-store.ts),
 *   honoring idempotency so a re-send returns the prior result.
 *
 * It depends only on ports (providers, history store, clock, id gen, sleeper),
 * so apps/server wires concrete impls via the NestJS adapter in nest/.
 */

import {
  type ChannelFeatureConfig,
  type ChannelDecision,
  routeChannels,
  resolveAddress,
} from './channel-router.ts';
import {
  DEFAULT_RETRY_POLICY,
  nextDelayMs,
  realSleeper,
  shouldRetry,
  type RetryPolicy,
  type Sleeper,
} from './retry-policy.ts';
import { type TemplateRegistry } from './template-registry.ts';
import {
  type Channel,
  type Clock,
  type IdGen,
  type NotificationChannelProvider,
  type NotificationHistoryStore,
  type NotificationLogRecord,
  type ProviderResult,
  type SendRequest,
} from './types.ts';

/** Per-channel outcome returned to the caller. */
export interface ChannelOutcome {
  channel: Channel;
  status: NotificationLogRecord['status'];
  retryCount: number;
  providerMessageId?: string;
  error?: string;
  /** True when an idempotent prior send was reused instead of re-sending. */
  deduplicated?: boolean;
}

/** Result of {@link NotificationService.send}. */
export interface SendOutcome {
  correlationId: string;
  templateKey: string;
  outcomes: ChannelOutcome[];
  /** Full routing trace, including skipped channels and why. */
  decisions: ChannelDecision[];
}

export interface NotificationServiceDeps {
  registry: TemplateRegistry;
  features: ChannelFeatureConfig;
  /** One provider per channel. Missing provider for a routed channel → error. */
  providers: Partial<Record<Channel, NotificationChannelProvider>>;
  history: NotificationHistoryStore;
  clock?: Clock;
  idGen?: IdGen;
  sleeper?: Sleeper;
  retryPolicy?: RetryPolicy;
}

export class NotificationService {
  readonly #registry: TemplateRegistry;
  readonly #features: ChannelFeatureConfig;
  readonly #providers: Partial<Record<Channel, NotificationChannelProvider>>;
  readonly #history: NotificationHistoryStore;
  readonly #clock: Clock;
  readonly #idGen: IdGen;
  readonly #sleeper: Sleeper;
  readonly #retry: RetryPolicy;

  constructor(deps: NotificationServiceDeps) {
    this.#registry = deps.registry;
    this.#features = deps.features;
    this.#providers = deps.providers;
    this.#history = deps.history;
    this.#clock = deps.clock ?? (() => new Date());
    this.#idGen = deps.idGen ?? defaultIdGen;
    this.#sleeper = deps.sleeper ?? realSleeper;
    this.#retry = deps.retryPolicy ?? DEFAULT_RETRY_POLICY;
  }

  /** Resolve, route, send (with retry), and record one notification. */
  async send(req: SendRequest): Promise<SendOutcome> {
    const template = this.#registry.resolve(req.templateKey);
    const plan = routeChannels({
      template,
      recipient: req.recipient,
      features: this.#features,
      ...(req.onlyChannels ? { onlyChannels: req.onlyChannels } : {}),
    });

    const correlationId = this.#idGen();
    const outcomes: ChannelOutcome[] = [];

    for (const channel of plan.channels) {
      outcomes.push(
        await this.#sendOnChannel({ req, template, channel, correlationId }),
      );
    }

    return {
      correlationId,
      templateKey: req.templateKey,
      outcomes,
      decisions: plan.decisions,
    };
  }

  async #sendOnChannel(input: {
    req: SendRequest;
    template: ReturnType<TemplateRegistry['resolve']>;
    channel: Channel;
    correlationId: string;
  }): Promise<ChannelOutcome> {
    const { req, template, channel, correlationId } = input;

    // Idempotency: a prior successful send with the same key short-circuits.
    if (req.idempotencyKey) {
      const prior = await this.#history.findByIdempotencyKey(
        req.idempotencyKey,
        channel,
      );
      if (prior && prior.status === 'sent') {
        return {
          channel,
          status: prior.status,
          retryCount: prior.retryCount,
          ...(prior.providerMessageId
            ? { providerMessageId: prior.providerMessageId }
            : {}),
          deduplicated: true,
        };
      }
    }

    const provider = this.#providers[channel];
    const renderer = template.renderers[channel];
    const now = this.#clock().toISOString();
    const recordId = this.#idGen();

    const baseRecord: NotificationLogRecord = {
      id: recordId,
      correlationId,
      templateKey: req.templateKey,
      channel,
      to: resolveAddress(channel, req.recipient),
      status: 'pending',
      retryCount: 0,
      ...(req.idempotencyKey ? { idempotencyKey: req.idempotencyKey } : {}),
      createdAt: now,
      updatedAt: now,
    };
    await this.#history.create(baseRecord);

    // Config errors (no provider / no renderer) are permanent failures.
    if (!provider || !renderer) {
      const error = !provider
        ? `no provider registered for channel ${channel}`
        : `template ${req.templateKey} has no renderer for ${channel}`;
      await this.#history.update(recordId, {
        status: 'failed',
        error,
        updatedAt: this.#clock().toISOString(),
      });
      return { channel, status: 'failed', retryCount: 0, error };
    }

    const message = renderer(req.vars);

    let attempt = 0;
    let last: ProviderResult = { ok: false, error: 'not attempted' };
    while (attempt < this.#retry.maxAttempts) {
      last = await provider.send({ recipient: req.recipient, message });
      if (last.ok) {
        await this.#history.update(recordId, {
          status: 'sent',
          retryCount: attempt,
          ...(last.providerMessageId
            ? { providerMessageId: last.providerMessageId }
            : {}),
          updatedAt: this.#clock().toISOString(),
        });
        return {
          channel,
          status: 'sent',
          retryCount: attempt,
          ...(last.providerMessageId
            ? { providerMessageId: last.providerMessageId }
            : {}),
        };
      }
      if (!shouldRetry({ attempt, retryable: last.retryable ?? false, policy: this.#retry })) {
        break;
      }
      await this.#sleeper(nextDelayMs(attempt, this.#retry));
      attempt += 1;
    }

    await this.#history.update(recordId, {
      status: 'failed',
      retryCount: attempt,
      ...(last.error ? { error: last.error } : {}),
      updatedAt: this.#clock().toISOString(),
    });
    return {
      channel,
      status: 'failed',
      retryCount: attempt,
      ...(last.error ? { error: last.error } : {}),
    };
  }
}

/** Non-crypto fallback id generator (counter+based) for non-injected use. */
let __seq = 0;
function defaultIdGen(): string {
  __seq += 1;
  return `ntf_${__seq.toString(36)}`;
}
