import assert from 'node:assert/strict';
import { test } from 'node:test';

import { InMemoryHistoryStore } from '../lib/history-store.ts';
import { type NotificationLogRecord } from '../lib/types.ts';

function rec(over: Partial<NotificationLogRecord> = {}): NotificationLogRecord {
  return {
    id: 'r1',
    correlationId: 'c1',
    templateKey: 'payment.receipt',
    channel: 'email',
    to: 'a@b.com',
    status: 'pending',
    retryCount: 0,
    createdAt: '2026-06-29T00:00:00.000Z',
    updatedAt: '2026-06-29T00:00:00.000Z',
    ...over,
  };
}

test('create then update mutates a stored copy immutably', async () => {
  const store = new InMemoryHistoryStore();
  await store.create(rec());
  await store.update('r1', { status: 'sent', providerMessageId: 'pm1', retryCount: 1 });
  const [row] = await store.listByCorrelation('c1');
  assert.equal(row?.status, 'sent');
  assert.equal(row?.providerMessageId, 'pm1');
  assert.equal(row?.retryCount, 1);
});

test('create rejects duplicate id', async () => {
  const store = new InMemoryHistoryStore();
  await store.create(rec());
  await assert.rejects(() => store.create(rec()));
});

test('update rejects unknown id', async () => {
  const store = new InMemoryHistoryStore();
  await assert.rejects(() => store.update('missing', { status: 'sent' }));
});

test('findByIdempotencyKey is scoped by key AND channel', async () => {
  const store = new InMemoryHistoryStore();
  await store.create(rec({ id: 'r1', channel: 'email', idempotencyKey: 'k1' }));
  await store.create(rec({ id: 'r2', channel: 'alimtalk', idempotencyKey: 'k1' }));
  assert.equal((await store.findByIdempotencyKey('k1', 'email'))?.id, 'r1');
  assert.equal((await store.findByIdempotencyKey('k1', 'alimtalk'))?.id, 'r2');
  assert.equal(await store.findByIdempotencyKey('k1', 'inapp'), null);
});

test('listByCorrelation returns copies sorted by createdAt', async () => {
  const store = new InMemoryHistoryStore();
  await store.create(rec({ id: 'r2', createdAt: '2026-06-29T00:00:02.000Z' }));
  await store.create(rec({ id: 'r1', createdAt: '2026-06-29T00:00:01.000Z' }));
  const rows = await store.listByCorrelation('c1');
  assert.deepEqual(rows.map((r) => r.id), ['r1', 'r2']);
  rows[0]!.status = 'failed'; // mutating the copy must not leak
  assert.equal((await store.listByCorrelation('c1'))[0]?.status, 'pending');
});
