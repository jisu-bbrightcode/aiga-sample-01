import assert from 'node:assert/strict';
import { test } from 'node:test';

import {
  TemplateRegistry,
  TemplateRegistryError,
  defaultTemplates,
  isValidTemplateKey,
} from '../lib/template-registry.ts';
import { type TemplateDefinition } from '../lib/types.ts';

const sample: TemplateDefinition = {
  key: 'auth.password_reset',
  channels: ['email'],
  renderers: { email: (v) => ({ subject: 's', body: `reset ${v.resetUrl}` }) },
};

test('isValidTemplateKey enforces <domain>.<event>', () => {
  assert.equal(isValidTemplateKey('auth.password_reset'), true);
  assert.equal(isValidTemplateKey('payment.receipt'), true);
  assert.equal(isValidTemplateKey('NoDot'), false);
  assert.equal(isValidTemplateKey('Auth.Reset'), false); // uppercase
  assert.equal(isValidTemplateKey('a.b.c'), false); // two dots
  assert.equal(isValidTemplateKey('.event'), false);
});

test('resolve returns the registered definition', () => {
  const reg = TemplateRegistry.fromDefinitions([sample]);
  assert.equal(reg.resolve('auth.password_reset').key, 'auth.password_reset');
  assert.equal(reg.has('auth.password_reset'), true);
});

test('resolve throws on unknown key', () => {
  const reg = TemplateRegistry.empty();
  assert.throws(() => reg.resolve('nope.missing'), TemplateRegistryError);
});

test('register is immutable and returns a new registry (acceptance #1)', () => {
  const base = TemplateRegistry.empty();
  const next = base.register(sample);
  assert.equal(base.has('auth.password_reset'), false); // original untouched
  assert.equal(next.has('auth.password_reset'), true);
});

test('register rejects duplicates', () => {
  const reg = TemplateRegistry.fromDefinitions([sample]);
  assert.throws(() => reg.register(sample), TemplateRegistryError);
});

test('invalid key is rejected at registration', () => {
  assert.throws(
    () =>
      TemplateRegistry.fromDefinitions([
        { ...sample, key: 'BadKey' },
      ]),
    TemplateRegistryError,
  );
});

test('a channel without a renderer is rejected', () => {
  assert.throws(
    () =>
      TemplateRegistry.fromDefinitions([
        { key: 'x.y', channels: ['email', 'alimtalk'], renderers: { email: () => ({ body: 'b' }) } },
      ]),
    TemplateRegistryError,
  );
});

test('empty channel list is rejected', () => {
  assert.throws(
    () => TemplateRegistry.fromDefinitions([{ key: 'x.y', channels: [], renderers: {} }]),
    TemplateRegistryError,
  );
});

test('default AIGA catalog is valid and covers the brief domains', () => {
  const reg = TemplateRegistry.fromDefinitions(defaultTemplates());
  const keys = reg.keys();
  assert.ok(keys.includes('auth.password_reset'));
  assert.ok(keys.includes('payment.receipt'));
  assert.ok(keys.includes('service.welcome'));
  // payment.receipt fans out to both email and alimtalk
  assert.deepEqual(reg.resolve('payment.receipt').channels, ['email', 'alimtalk']);
});
