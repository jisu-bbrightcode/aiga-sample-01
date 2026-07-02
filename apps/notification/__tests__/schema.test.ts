import assert from 'node:assert/strict';
import { test } from 'node:test';

import {
  NOTIFICATION_CHANNEL_VALUES,
  NOTIFICATION_LOGS_DOWN_SQL,
  NOTIFICATION_LOGS_UP_SQL,
  NOTIFICATION_STATUS_VALUES,
} from '../lib/schema.ts';

test('migration DDL extends email_logs columns onto notification_logs', () => {
  for (const col of [
    'status',
    'provider_message_id',
    'retry_count',
    'error',
    'channel',
    'template_key',
    'correlation_id',
    'idempotency_key',
  ]) {
    assert.match(NOTIFICATION_LOGS_UP_SQL, new RegExp(col));
  }
});

test('idempotency is enforced at the DB level by a partial unique index', () => {
  assert.match(NOTIFICATION_LOGS_UP_SQL, /UNIQUE INDEX[\s\S]*idempotency_key, channel/);
  assert.match(NOTIFICATION_LOGS_UP_SQL, /WHERE idempotency_key IS NOT NULL/);
});

test('down migration drops the table', () => {
  assert.match(NOTIFICATION_LOGS_DOWN_SQL, /DROP TABLE IF EXISTS notification_logs/);
});

test('status/channel enums stay in sync with the type unions', () => {
  assert.deepEqual([...NOTIFICATION_STATUS_VALUES].sort(), ['failed', 'pending', 'sent', 'skipped']);
  assert.deepEqual([...NOTIFICATION_CHANNEL_VALUES].sort(), ['alimtalk', 'email', 'inapp']);
});
