/**
 * Friendly, non-technical auth messages. Never surface raw provider/server
 * error strings to users (see CLAUDE.md §5) — map known codes, fall back to a
 * generic friendly line.
 */
export function authErrorMessage(error: unknown): string {
  const code = (error as { code?: string } | null | undefined)?.code;
  switch (code) {
    case "INVALID_EMAIL_OR_PASSWORD":
      return "이메일 또는 비밀번호가 올바르지 않아요.";
    case "EMAIL_NOT_VERIFIED":
      return "이메일 인증이 필요해요. 받은 메일의 링크를 눌러 주세요.";
    case "USER_ALREADY_EXISTS":
      return "이미 가입된 이메일이에요. 로그인해 주세요.";
    default:
      return "요청을 처리하지 못했어요. 잠시 후 다시 시도해 주세요.";
  }
}

export const AUTH_SERVER_UNAVAILABLE = "서버에 연결할 수 없어요. 잠시 후 다시 시도해 주세요.";
