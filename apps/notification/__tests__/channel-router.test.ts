import assert from 'node:assert/strict';
import { test } from 'node:test';

import {
  isChannelEnabled,
  resolveAddress,
  routeChannels,
} from '../lib/channel-router.ts';
import { type TemplateDefinition } from '../lib/types.ts';

const tmpl: TemplateDefinition = {
  key: 'payment.receipt',
  channels: ['email', 'alimtalk'],
  renderers: {
    email: () => ({ subject: 's', body: 'b' }),
    alimtalk: () => ({ body: 'b', alimtalkTemplateCode: 'CODE' }),
  },
};

const recipient = { userId: 'u1', email: 'a@b.com', phone: '+821011112222' };

test('inapp is always enabled; email/alimtalk follow features', () => {
  assert.equal(isChannelEnabled('inapp', { email: false, alimtalk: false }), true);
  assert.equal(isChannelEnabled('email', { email: true, alimtalk: false }), true);
  assert.equal(isChannelEnabled('email', { email: false, alimtalk: false }), false);
  assert.equal(isChannelEnabled('alimtalk', { email: false, alimtalk: true }), true);
});

test('feature selection drives routing (acceptance #2)', () => {
  const onlyEmail = routeChannels({
    template: tmpl,
    recipient,
    features: { email: true, alimtalk: false },
  });
  assert.deepEqual(onlyEmail.channels, ['email']);
  const alimDecision = onlyEmail.decisions.find((d) => d.channel === 'alimtalk');
  assert.equal(alimDecision?.reason, 'feature_disabled');
});

test('both features on routes both channels in template order', () => {
  const plan = routeChannels({
    template: tmpl,
    recipient,
    features: { email: true, alimtalk: true },
  });
  assert.deepEqual(plan.channels, ['email', 'alimtalk']);
});

test('missing address skips the channel', () => {
  const plan = routeChannels({
    template: tmpl,
    recipient: { email: 'a@b.com' }, // no phone
    features: { email: true, alimtalk: true },
  });
  assert.deepEqual(plan.channels, ['email']);
  assert.equal(
    plan.decisions.find((d) => d.channel === 'alimtalk')?.reason,
    'missing_address',
  );
});

test('onlyChannels narrows and flags channels not in the template', () => {
  const plan = routeChannels({
    template: tmpl,
    recipient,
    features: { email: true, alimtalk: true },
    onlyChannels: ['email', 'inapp'],
  });
  assert.deepEqual(plan.channels, ['email']);
  assert.equal(
    plan.decisions.find((d) => d.channel === 'alimtalk')?.reason,
    'excluded_by_caller',
  );
  assert.equal(
    plan.decisions.find((d) => d.channel === 'inapp')?.reason,
    'not_in_template',
  );
});

test('resolveAddress picks the channel-appropriate field', () => {
  assert.equal(resolveAddress('email', recipient), 'a@b.com');
  assert.equal(resolveAddress('alimtalk', recipient), '+821011112222');
  assert.equal(resolveAddress('inapp', recipient), 'u1');
});
