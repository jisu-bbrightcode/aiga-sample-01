/**
 * Admin profile-edit field rules (BBR-688 / PB-ADMIN-USERS-UPDATE-001).
 *
 * Pure helpers shared by the edit form: which fields an admin may change,
 * client-side validation that mirrors the server's zod contract
 * (`updateAdminUserSchema` + `handleSchema`), and a diff builder so the PATCH
 * only carries fields the operator actually changed.
 *
 * AC#1 — admin-editable vs user-self-managed:
 *  - editable here (profile fields the admin operates on behalf of a user):
 *    표시명(name) / 핸들(handle) / 소개(bio) / 아바타(avatar)
 *  - NOT editable here (user manages, or changed via a separate flow):
 *    이메일/인증수단(email/auth provider), 등급(grade), 접근역할/계정상태
 *    (role/status have their own audited actions in the dialog).
 *
 * The server is the source of truth and re-validates; these rules give the
 * operator fast, friendly feedback before the request is sent.
 */

/** Fields the admin profile form may change (mirrors `updateAdminUserSchema`). */
export const ADMIN_EDITABLE_PROFILE_FIELDS = ["name", "handle", "bio", "avatar"] as const;

export type EditableProfileField = (typeof ADMIN_EDITABLE_PROFILE_FIELDS)[number];

/** Draft values held by the form (always strings; empty = cleared). */
export interface ProfileFormValues {
  name: string;
  handle: string;
  bio: string;
  avatar: string;
}

/** Partial patch sent to `PATCH /admin/users/:id`. null clears a nullable field. */
export interface UpdateUserProfilePatch {
  name?: string;
  handle?: string | null;
  bio?: string | null;
  avatar?: string | null;
}

export type ProfileFieldErrors = Partial<Record<EditableProfileField, string>>;

// Kept in sync with `_common` handleSchema (format + reserved words).
const HANDLE_PATTERN = /^[a-z0-9](?:[a-z0-9-]{1,30}[a-z0-9])?$/;
const RESERVED_HANDLES = new Set([
  "admin",
  "api",
  "app",
  "billing",
  "dashboard",
  "help",
  "settings",
  "signin",
  "signup",
  "support",
  "www",
]);

const NAME_MAX = 100;
const BIO_MAX = 500;
const AVATAR_MAX = 2048;
const HANDLE_MIN = 3;
const HANDLE_MAX = 32;

function isValidHttpUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
}

function validateName(value: string): string | undefined {
  const name = value.trim();
  if (name.length === 0) return "표시명을 입력해 주세요.";
  if (name.length > NAME_MAX) return `표시명은 ${NAME_MAX}자 이하로 입력해 주세요.`;
  return undefined;
}

function validateHandle(value: string): string | undefined {
  const handle = value.trim();
  if (handle.length === 0) return undefined; // empty = clear (handled by diff)
  if (handle.length < HANDLE_MIN || handle.length > HANDLE_MAX) {
    return `핸들은 ${HANDLE_MIN}~${HANDLE_MAX}자로 입력해 주세요.`;
  }
  if (!HANDLE_PATTERN.test(handle)) return "핸들은 소문자/숫자/하이픈만 사용할 수 있어요.";
  if (RESERVED_HANDLES.has(handle)) return "사용할 수 없는 핸들이에요.";
  return undefined;
}

function validateAvatar(value: string): string | undefined {
  const avatar = value.trim();
  if (avatar.length === 0) return undefined; // empty = clear
  if (avatar.length > AVATAR_MAX) return `이미지 주소가 너무 길어요 (${AVATAR_MAX}자 이하).`;
  if (!isValidHttpUrl(avatar)) return "이미지 주소는 http(s) URL이어야 해요.";
  return undefined;
}

/**
 * Validate a draft against the allowed-field rules. Returns a map of
 * field → friendly Korean message; an empty object means the draft is valid.
 * Optional fields (handle/bio/avatar) only validate when non-empty — an empty
 * value is a deliberate "clear this field" and is handled by the diff builder.
 */
export function validateProfileForm(values: ProfileFormValues): ProfileFieldErrors {
  const errors: ProfileFieldErrors = {};

  const name = validateName(values.name);
  if (name) errors.name = name;

  const handle = validateHandle(values.handle);
  if (handle) errors.handle = handle;

  if (values.bio.trim().length > BIO_MAX) {
    errors.bio = `소개는 ${BIO_MAX}자 이하로 입력해 주세요.`;
  }

  const avatar = validateAvatar(values.avatar);
  if (avatar) errors.avatar = avatar;

  return errors;
}

/** Normalize a nullable text field: trim, and treat empty string as null (cleared). */
function normalizeNullable(value: string): string | null {
  const trimmed = value.trim();
  return trimmed.length === 0 ? null : trimmed;
}

/**
 * Build the minimal patch from the current persisted values and the form draft:
 * only changed fields are included so a no-op submit sends nothing (and the
 * caller can short-circuit). `name` is required and never sent as null.
 */
export function buildProfilePatch(
  current: ProfileFormValues,
  draft: ProfileFormValues,
): UpdateUserProfilePatch {
  const patch: UpdateUserProfilePatch = {};

  const name = draft.name.trim();
  if (name !== current.name.trim()) {
    patch.name = name;
  }

  const handle = normalizeNullable(draft.handle);
  if (handle !== normalizeNullable(current.handle)) {
    patch.handle = handle;
  }

  const bio = normalizeNullable(draft.bio);
  if (bio !== normalizeNullable(current.bio)) {
    patch.bio = bio;
  }

  const avatar = normalizeNullable(draft.avatar);
  if (avatar !== normalizeNullable(current.avatar)) {
    patch.avatar = avatar;
  }

  return patch;
}

/** True when the patch carries no field changes (submit should be skipped). */
export function isEmptyPatch(patch: UpdateUserProfilePatch): boolean {
  return Object.keys(patch).length === 0;
}
