import assert from 'node:assert/strict';
import { test } from 'node:test';

import { InMemoryHistoryStore } from '../lib/history-store.ts';
import {
  NotificationService,
  type NotificationServiceDeps,
} from '../lib/notification-service.ts';
import {
  TemplateRegistry,
  defaultTemplates,
} from '../lib/template-registry.ts';
import {
  type Channel,
  type NotificationChannelProvider,
  type ProviderResult,
} from '../lib/types.ts';

/** Scriptable provider: returns queued results, recording attempt count. */
class FakeProvider implements NotificationChannelProvider {
  attempts = 0;
  readonly channel: Channel;
  readonly #results: ProviderResult[];
  constructor(channel: Channel, results: ProviderResult[]) {
    this.channel = channel;
    this.#results = results;
  }
  async send(): Promise<ProviderResult> {
    this.attempts += 1;
    return this.#results[Math.min(this.attempts - 1, this.#results.length - 1)]!;
  }
}

function deterministic(
  over: Partial<NotificationServiceDeps>,
): NotificationServiceDeps {
  let seq = 0;
  return {
    registry: TemplateRegistry.fromDefinitions(defaultTemplates()),
    features: { email: true, alimtalk: true },
    providers: {},
    history: new InMemoryHistoryStore(),
    clock: () => new Date('2026-06-29T00:00:00.000Z'),
    idGen: () => `id_${(seq += 1)}`,
    sleeper: async () => {}, // no real waiting in tests
    ...over,
  };
}

test('sends on every routed channel and records history', async () => {
  const history = new InMemoryHistoryStore();
  const email = new FakeProvider('email', [{ ok: true, providerMessageId: 'e1' }]);
  const alim = new FakeProvider('alimtalk', [{ ok: true, providerMessageId: 'a1' }]);
  const svc = new NotificationService(
    deterministic({ history, providers: { email, alimtalk: alim } }),
  );

  const out = await svc.send({
    templateKey: 'payment.receipt',
    recipient: { email: 'a@b.com', phone: '+8210', userId: 'u1' },
    vars: { orderId: 'O1', amount: 1000 },
  });

  assert.deepEqual(
    out.outcomes.map((o) => [o.channel, o.status]),
    [['email', 'sent'], ['alimtalk', 'sent']],
  );
  const rows = await history.listByCorrelation(out.correlationId);
  assert.equal(rows.length, 2);
  assert.ok(rows.every((r) => r.status === 'sent'));
});

test('disabled feature is N/A-skipped, not attempted (acceptance #2)', async () => {
  const email = new FakeProvider('email', [{ ok: true, providerMessageId: 'e1' }]);
  const svc = new NotificationService(
    deterministic({
      features: { email: true, alimtalk: false },
      providers: { email },
    }),
  );
  const out = await svc.send({
    templateKey: 'payment.receipt',
    recipient: { email: 'a@b.com', phone: '+8210' },
    vars: { orderId: 'O1', amount: 1 },
  });
  assert.deepEqual(out.outcomes.map((o) => o.channel), ['email']);
  assert.equal(
    out.decisions.find((d) => d.channel === 'alimtalk')?.reason,
    'feature_disabled',
  );
});

test('retries transient failures then succeeds, recording retryCount', async () => {
  const history = new InMemoryHistoryStore();
  const email = new FakeProvider('email', [
    { ok: false, error: 'rate', retryable: true },
    { ok: false, error: 'rate', retryable: true },
    { ok: true, providerMessageId: 'e3' },
  ]);
  const svc = new NotificationService(
    deterministic({ history, providers: { email } }),
  );
  const out = await svc.send({
    templateKey: 'auth.password_reset',
    recipient: { email: 'a@b.com' },
    vars: { resetUrl: 'https://x' },
  });
  assert.equal(out.outcomes[0]?.status, 'sent');
  assert.equal(out.outcomes[0]?.retryCount, 2);
  assert.equal(email.attempts, 3);
});

test('permanent failure is not retried', async () => {
  const email = new FakeProvider('email', [
    { ok: false, error: 'bad address', retryable: false },
  ]);
  const svc = new NotificationService(deterministic({ providers: { email } }));
  const out = await svc.send({
    templateKey: 'auth.password_reset',
    recipient: { email: 'a@b.com' },
    vars: { resetUrl: 'https://x' },
  });
  assert.equal(out.outcomes[0]?.status, 'failed');
  assert.equal(email.attempts, 1);
});

test('exhausts retry budget then records failed', async () => {
  const email = new FakeProvider('email', [{ ok: false, error: '5xx', retryable: true }]);
  const svc = new NotificationService(deterministic({ providers: { email } }));
  const out = await svc.send({
    templateKey: 'auth.password_reset',
    recipient: { email: 'a@b.com' },
    vars: { resetUrl: 'https://x' },
  });
  assert.equal(out.outcomes[0]?.status, 'failed');
  assert.equal(email.attempts, 3); // DEFAULT_RETRY_POLICY.maxAttempts
});

test('idempotency: a prior sent record short-circuits re-send', async () => {
  const history = new InMemoryHistoryStore();
  const email = new FakeProvider('email', [{ ok: true, providerMessageId: 'e1' }]);
  const deps = deterministic({ history, providers: { email } });
  const svc = new NotificationService(deps);
  const req = {
    templateKey: 'auth.password_reset',
    recipient: { email: 'a@b.com' },
    vars: { resetUrl: 'https://x' },
    idempotencyKey: 'idem-1',
  };
  await svc.send(req);
  const second = await svc.send(req);
  assert.equal(email.attempts, 1); // not sent again
  assert.equal(second.outcomes[0]?.deduplicated, true);
});

test('missing provider for a routed channel records a failed config error', async () => {
  const svc = new NotificationService(
    deterministic({ providers: {} }), // no email provider
  );
  const out = await svc.send({
    templateKey: 'auth.password_reset',
    recipient: { email: 'a@b.com' },
    vars: { resetUrl: 'https://x' },
  });
  assert.equal(out.outcomes[0]?.status, 'failed');
  assert.match(out.outcomes[0]?.error ?? '', /no provider/);
});
