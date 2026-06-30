/**
 * Community Poll Policy — pure, DB-free helpers for the poll voting capability.
 *
 * Centralises the rules that the AC cares about so they are unit-testable in
 * isolation from Drizzle / Nest:
 *   - 종료(closed) detection from `expiresAt`
 *   - 선택지 검증 (single vs multiple choice)
 *   - 결과 공개 정책 (result visibility)
 *   - 집계 카운트 캐시 재계산 (immutable)
 */

import type { PollData } from "@repo/drizzle/schema";

export type PollSelectionErrorCode =
  | "empty"
  | "unknown_option"
  | "multiple_not_allowed"
  | "duplicate_option";

export interface PollOptionView {
  id: string;
  text: string;
  /** null when results are hidden by the visibility policy. */
  voteCount: number | null;
}

export interface PollView {
  multipleChoice: boolean;
  closed: boolean;
  expiresAt: string | null;
  /** Total ballots cast across all options (null when results hidden). */
  totalVotes: number | null;
  /** Whether per-option counts are exposed to the caller. */
  resultsVisible: boolean;
  options: PollOptionView[];
  /** Option ids the current viewer has voted for (empty for anonymous). */
  userVotedOptionIds: string[];
}

/** A poll is closed (종료) once its expiry has passed. Polls without an expiry never auto-close. */
export function isPollClosed(poll: PollData, now: Date): boolean {
  if (!poll.expiresAt) return false;
  const expiry = new Date(poll.expiresAt).getTime();
  if (Number.isNaN(expiry)) return false;
  return now.getTime() >= expiry;
}

/**
 * Validate a requested set of option ids against the poll definition and choice mode.
 * Pure structural validation only — does NOT check duplicate-vote / closed state.
 */
export function validatePollSelection(
  poll: PollData,
  optionIds: string[],
): { ok: true } | { ok: false; code: PollSelectionErrorCode } {
  if (optionIds.length === 0) return { ok: false, code: "empty" };

  const unique = new Set(optionIds);
  if (unique.size !== optionIds.length) return { ok: false, code: "duplicate_option" };

  if (!poll.multipleChoice && optionIds.length > 1) {
    return { ok: false, code: "multiple_not_allowed" };
  }

  const known = new Set(poll.options.map((o) => o.id));
  for (const id of optionIds) {
    if (!known.has(id)) return { ok: false, code: "unknown_option" };
  }

  return { ok: true };
}

/**
 * Result visibility policy. Per-option counts are revealed only when at least one
 * of these holds:
 *   - 투표가 종료됨 (closed)
 *   - 본인이 이미 투표함 (hasVoted)
 *   - 운영 권한 보유 (canModerate: 작성자/모더레이터)
 * Otherwise live results stay hidden so early counts cannot bias voters.
 */
export function canViewPollResults(args: {
  closed: boolean;
  hasVoted: boolean;
  canModerate: boolean;
}): boolean {
  return args.closed || args.hasVoted || args.canModerate;
}

/**
 * Immutably rebuild the cached per-option `voteCount` from an authoritative
 * counts map (computed from `community_poll_votes`). Options missing from the
 * map reset to 0. Returns a new PollData — never mutates the input.
 */
export function rebuildPollOptionCounts(
  poll: PollData,
  counts: ReadonlyMap<string, number>,
): PollData {
  return {
    ...poll,
    options: poll.options.map((option) => ({
      ...option,
      voteCount: counts.get(option.id) ?? 0,
    })),
  };
}

/** Build the client-facing poll view, applying the result visibility policy. */
export function buildPollView(args: {
  poll: PollData;
  closed: boolean;
  resultsVisible: boolean;
  userVotedOptionIds: string[];
}): PollView {
  const { poll, closed, resultsVisible, userVotedOptionIds } = args;

  const options: PollOptionView[] = poll.options.map((option) => ({
    id: option.id,
    text: option.text,
    voteCount: resultsVisible ? option.voteCount : null,
  }));

  const totalVotes = resultsVisible
    ? poll.options.reduce((sum, option) => sum + option.voteCount, 0)
    : null;

  return {
    multipleChoice: poll.multipleChoice,
    closed,
    expiresAt: poll.expiresAt ?? null,
    totalVotes,
    resultsVisible,
    options,
    userVotedOptionIds,
  };
}
