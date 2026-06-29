export const AUTH_NOTICE_EMAIL_KEY = "product-builder.auth.email";
export const AUTH_NOTICE_MODE_KEY = "product-builder.auth.notice";
export const AUTH_NOTICE_NEXT_KEY = "product-builder.auth.next";

export type AuthNoticeMode = "magic-link" | "verify-email";

export interface AuthNotice {
  email: string | null;
  mode: AuthNoticeMode;
  nextPath: string | null;
}

export function writeAuthNotice({
  email,
  mode,
  nextPath,
}: {
  email: string;
  mode: AuthNoticeMode;
  nextPath?: string;
}) {
  try {
    sessionStorage.setItem(AUTH_NOTICE_EMAIL_KEY, email);
    sessionStorage.setItem(AUTH_NOTICE_MODE_KEY, mode);
    if (nextPath) {
      sessionStorage.setItem(AUTH_NOTICE_NEXT_KEY, nextPath);
    } else {
      sessionStorage.removeItem(AUTH_NOTICE_NEXT_KEY);
    }
  } catch {
    // Storage can be unavailable in privacy-restricted browsers.
  }
}

export function readAuthNotice(): AuthNotice {
  try {
    const mode = sessionStorage.getItem(AUTH_NOTICE_MODE_KEY);
    return {
      email: sessionStorage.getItem(AUTH_NOTICE_EMAIL_KEY),
      mode: mode === "verify-email" ? "verify-email" : "magic-link",
      nextPath: sessionStorage.getItem(AUTH_NOTICE_NEXT_KEY),
    };
  } catch {
    return { email: null, mode: "magic-link", nextPath: null };
  }
}
