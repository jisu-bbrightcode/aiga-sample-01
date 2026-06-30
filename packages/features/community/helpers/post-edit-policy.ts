/**
 * Post edit permission + audit helpers (pure, DB-free).
 *
 * AC#1 (작성자/관리자 수정 권한 분리): the author edits their own post; a
 * community owner/admin/moderator may also edit, but that path is tracked
 * separately as a moderation action.
 * AC#2 (수정 이력/감사 로그): moderator edits produce an audit diff that is
 * appended to community_mod_logs.
 */

export type PostEditAccess = "author" | "moderator" | "denied";

/**
 * Decide which edit path applies. Author wins when the caller is both the
 * author and a moderator, so a self-edit is never logged as a mod action.
 */
export function resolvePostEditAccess(input: {
  isAuthor: boolean;
  isModerator: boolean;
}): PostEditAccess {
  if (input.isAuthor) return "author";
  if (input.isModerator) return "moderator";
  return "denied";
}

/** Fields a caller may edit through PATCH /community/posts/:id. */
export const EDITABLE_POST_FIELDS = [
  "title",
  "content",
  "isNsfw",
  "isSpoiler",
  "flairId",
  "contentRating",
] as const;

export type EditablePostField = (typeof EDITABLE_POST_FIELDS)[number];

type PostSnapshot = Partial<Record<EditablePostField, unknown>>;

export interface PostEditDiff {
  changedFields: EditablePostField[];
  before: PostSnapshot;
  after: PostSnapshot;
}

/**
 * Compute the before/after diff for the fields the patch actually touched.
 * Only keys present in `patch` (i.e. the partial update payload) are
 * considered, and a key is "changed" only when its value differs from the
 * current post. Returns an empty diff for a no-op edit.
 */
export function diffPostEdit(current: PostSnapshot, patch: PostSnapshot): PostEditDiff {
  const changedFields: EditablePostField[] = [];
  const before: PostSnapshot = {};
  const after: PostSnapshot = {};

  for (const field of EDITABLE_POST_FIELDS) {
    if (!(field in patch)) continue;
    const nextValue = patch[field];
    const prevValue = current[field];
    if (nextValue === prevValue) continue;

    changedFields.push(field);
    before[field] = prevValue ?? null;
    after[field] = nextValue ?? null;
  }

  return { changedFields, before, after };
}
