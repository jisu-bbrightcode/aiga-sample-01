import assert from 'node:assert/strict';
import { test } from 'node:test';

import { ResendProvider } from '../lib/providers/resend.ts';
import { AlimTalkProvider } from '../lib/providers/alimtalk.ts';
import { InAppProvider } from '../lib/providers/inapp.ts';

const email = { email: 'a@b.com' };
const phone = { phone: '+821000000000' };

test('ResendProvider success returns providerMessageId', async () => {
  const p = new ResendProvider({
    from: 'AIGA <no-reply@aiga.dev>',
    transport: async () => ({ ok: true, id: 'rsd_1' }),
  });
  const r = await p.send({ recipient: email, message: { subject: 's', body: 'b' } });
  assert.deepEqual(r, { ok: true, providerMessageId: 'rsd_1' });
});

test('ResendProvider classifies 429/5xx as retryable, 4xx as permanent', async () => {
  const make = (status: number) =>
    new ResendProvider({
      from: 'x',
      transport: async () => ({ ok: false, status, error: 'e' }),
    });
  assert.equal((await make(429).send({ recipient: email, message: { body: 'b' } })).retryable, true);
  assert.equal((await make(503).send({ recipient: email, message: { body: 'b' } })).retryable, true);
  assert.equal((await make(400).send({ recipient: email, message: { body: 'b' } })).retryable, false);
});

test('ResendProvider treats a thrown transport as retryable', async () => {
  const p = new ResendProvider({
    from: 'x',
    transport: async () => {
      throw new Error('network');
    },
  });
  const r = await p.send({ recipient: email, message: { body: 'b' } });
  assert.equal(r.ok, false);
  assert.equal(r.retryable, true);
});

test('ResendProvider with no email address fails permanently', async () => {
  const p = new ResendProvider({ from: 'x', transport: async () => ({ ok: true }) });
  const r = await p.send({ recipient: {}, message: { body: 'b' } });
  assert.deepEqual(r, { ok: false, error: 'no email address', retryable: false });
});

test('AlimTalkProvider requires an approved template code', async () => {
  const p = new AlimTalkProvider({ senderKey: 'sk', transport: async () => ({ ok: true }) });
  const r = await p.send({ recipient: phone, message: { body: 'b' } }); // no code
  assert.equal(r.ok, false);
  assert.equal(r.retryable, false);
});

test('AlimTalkProvider success + retryability by code', async () => {
  const ok = new AlimTalkProvider({
    senderKey: 'sk',
    transport: async () => ({ ok: true, messageId: 'at_1' }),
  });
  assert.deepEqual(
    await ok.send({ recipient: phone, message: { body: 'b', alimtalkTemplateCode: 'C' } }),
    { ok: true, providerMessageId: 'at_1' },
  );
  const server = new AlimTalkProvider({
    senderKey: 'sk',
    transport: async () => ({ ok: false, code: 3500, error: 'e' }),
  });
  assert.equal(
    (await server.send({ recipient: phone, message: { body: 'b', alimtalkTemplateCode: 'C' } })).retryable,
    true,
  );
});

test('InAppProvider appends to the inbox sink', async () => {
  let captured: { userId: string; body: string } | null = null;
  const p = new InAppProvider(async (entry) => {
    captured = entry;
    return { id: 'inbox_1' };
  });
  const r = await p.send({ recipient: { userId: 'u9' }, message: { body: 'hello' } });
  assert.deepEqual(r, { ok: true, providerMessageId: 'inbox_1' });
  assert.deepEqual(captured, { userId: 'u9', body: 'hello' });
});
