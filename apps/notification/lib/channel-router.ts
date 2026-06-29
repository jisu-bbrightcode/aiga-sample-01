/**
 * Channel routing (PB-NOTI-001, acceptance #2:
 * "Email(Resend)과 알림톡 feature 선택값이 채널 task decision에 반영된다").
 *
 * A template declares the channels it *can* use. The router intersects that
 * with the channels the build actually enabled — i.e. the Email(Resend) and
 * Kakao 알림톡 feature-selection flags from PB-DECIDE-001 — so an unselected
 * feature is N/A-skipped rather than attempted. This is the single place where
 * the feature-selection decision becomes a runtime routing decision.
 *
 * `inapp` is always enabled (base notification inbox, no feature flag).
 */

import {
  ALL_CHANNELS,
  type Channel,
  type Recipient,
  type TemplateDefinition,
} from './types.ts';

/**
 * Which optional channels the build enabled. Mirrors the AIGA feature
 * selection: each external channel is N/A-skipped when its feature is off.
 */
export interface ChannelFeatureConfig {
  /** Email(Resend) feature selected? */
  email: boolean;
  /** Kakao 알림톡 feature selected? */
  alimtalk: boolean;
}

/** Why a candidate channel was or wasn't selected — returned for observability. */
export interface ChannelDecision {
  channel: Channel;
  routed: boolean;
  reason:
    | 'routed'
    | 'feature_disabled'
    | 'missing_address'
    | 'not_in_template'
    | 'excluded_by_caller';
}

/** Outcome of routing one send. */
export interface RoutingPlan {
  /** Channels that will actually be attempted, in template-preference order. */
  channels: Channel[];
  /** Full per-channel decision trace (every channel the template declared). */
  decisions: ChannelDecision[];
}

/** Is `channel` enabled by the current feature configuration? */
export function isChannelEnabled(
  channel: Channel,
  features: ChannelFeatureConfig,
): boolean {
  switch (channel) {
    case 'inapp':
      return true; // base inbox, always on
    case 'email':
      return features.email;
    case 'alimtalk':
      return features.alimtalk;
    /* c8 ignore next 2 */
    default:
      return false;
  }
}

/** Does the recipient have the address required for `channel`? */
function hasAddress(channel: Channel, recipient: Recipient): boolean {
  switch (channel) {
    case 'inapp':
      return Boolean(recipient.userId);
    case 'email':
      return Boolean(recipient.email);
    case 'alimtalk':
      return Boolean(recipient.phone);
    /* c8 ignore next 2 */
    default:
      return false;
  }
}

/**
 * Compute the routing plan for one send: intersect the template's declared
 * channels with (feature-enabled ∧ has-address ∧ caller-allowed), preserving
 * the template's preference order.
 */
export function routeChannels(input: {
  template: TemplateDefinition;
  recipient: Recipient;
  features: ChannelFeatureConfig;
  onlyChannels?: readonly Channel[];
}): RoutingPlan {
  const { template, recipient, features, onlyChannels } = input;
  const declared = new Set<Channel>(template.channels);
  const allow = onlyChannels ? new Set<Channel>(onlyChannels) : null;

  const decisions: ChannelDecision[] = [];
  const channels: Channel[] = [];

  // Walk in the template's declared preference order.
  for (const channel of template.channels) {
    if (allow && !allow.has(channel)) {
      decisions.push({ channel, routed: false, reason: 'excluded_by_caller' });
      continue;
    }
    if (!isChannelEnabled(channel, features)) {
      decisions.push({ channel, routed: false, reason: 'feature_disabled' });
      continue;
    }
    if (!hasAddress(channel, recipient)) {
      decisions.push({ channel, routed: false, reason: 'missing_address' });
      continue;
    }
    decisions.push({ channel, routed: true, reason: 'routed' });
    channels.push(channel);
  }

  // Record caller-requested channels that the template doesn't even declare,
  // so a typo'd onlyChannels surfaces instead of silently doing nothing.
  if (allow) {
    for (const channel of ALL_CHANNELS) {
      if (allow.has(channel) && !declared.has(channel)) {
        decisions.push({ channel, routed: false, reason: 'not_in_template' });
      }
    }
  }

  return { channels, decisions };
}

/** Resolve the redactable `to` address used in the history record. */
export function resolveAddress(channel: Channel, recipient: Recipient): string {
  switch (channel) {
    case 'inapp':
      return recipient.userId ?? '';
    case 'email':
      return recipient.email ?? '';
    case 'alimtalk':
      return recipient.phone ?? '';
    /* c8 ignore next 2 */
    default:
      return '';
  }
}
