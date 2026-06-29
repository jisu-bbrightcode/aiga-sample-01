import assert from 'node:assert/strict';
import { test } from 'node:test';

import { InMemoryHistoryStore } from '../lib/history-store.ts';
import {
  NotificationConfigError,
  buildProviders,
  buildRegistry,
  createNotificationService,
} from '../nest/notification.factory.ts';

const inboxSink = async () => ({ id: 'inbox_1' });

test('buildRegistry includes defaults plus extras', () => {
  const reg = buildRegistry([
    { key: 'service.custom', channels: ['inapp'], renderers: { inapp: () => ({ body: 'x' }) } },
  ]);
  assert.ok(reg.has('auth.password_reset'));
  assert.ok(reg.has('service.custom'));
});

test('buildProviders wires only enabled features (acceptance #2)', () => {
  const providers = buildProviders({
    features: { email: true, alimtalk: false },
    history: new InMemoryHistoryStore(),
    inboxSink,
    resend: { from: 'x', transport: async () => ({ ok: true }) },
  });
  assert.ok(providers.inapp); // always
  assert.ok(providers.email); // enabled
  assert.equal(providers.alimtalk, undefined); // disabled
});

test('feature on but transport missing fails fast', () => {
  assert.throws(
    () =>
      buildProviders({
        features: { email: true, alimtalk: false },
        history: new InMemoryHistoryStore(),
        inboxSink,
      }),
    NotificationConfigError,
  );
});

test('createNotificationService assembles a working service', async () => {
  const history = new InMemoryHistoryStore();
  const svc = createNotificationService({
    features: { email: true, alimtalk: false },
    history,
    inboxSink,
    resend: { from: 'AIGA <x@y.dev>', transport: async () => ({ ok: true, id: 'e1' }) },
    idGen: (() => {
      let n = 0;
      return () => `id_${(n += 1)}`;
    })(),
  });
  const out = await svc.send({
    templateKey: 'auth.password_reset',
    recipient: { email: 'a@b.com' },
    vars: { resetUrl: 'https://x' },
  });
  assert.equal(out.outcomes[0]?.status, 'sent');
  assert.equal(out.outcomes[0]?.providerMessageId, 'e1');
});
