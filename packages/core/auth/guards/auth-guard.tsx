/**
 * Auth Guard
 *
 * 인증된 사용자만 접근할 수 있는 가드 컴포넌트
 */
import type { ReactNode } from "react";
import { useEffect } from "react";

interface AuthGuardProps {
  children: ReactNode;
  /** 인증 상태 (null = 로딩 중) */
  authenticated: boolean | null;
  /** 미인증 시 호출할 콜백 */
  onUnauthenticated: () => void;
  /** 세션 hydration 중 표시할 fallback (default: 간단한 로딩 화면) */
  loadingFallback?: ReactNode;
}

/**
 * 인증된 사용자만 접근할 수 있는 가드 컴포넌트
 *
 * @example
 * ```tsx
 * import { AuthGuard } from '@repo/core/auth';
 *
 * <AuthGuard
 *   authenticated={session !== null}
 *   onUnauthenticated={() => navigate('/sign-in')}
 * >
 *   <ProtectedContent />
 * </AuthGuard>
 * ```
 */
export function AuthGuard({
  children,
  authenticated,
  onUnauthenticated,
  loadingFallback,
}: AuthGuardProps) {
  useEffect(() => {
    if (authenticated === false) {
      onUnauthenticated();
    }
  }, [authenticated, onUnauthenticated]);

  if (authenticated === null) {
    return loadingFallback ?? <AuthGuardLoading />;
  }

  return authenticated ? children : null;
}

function AuthGuardLoading() {
  return (
    <div
      className="flex min-h-dvh w-full items-center justify-center"
      role="status"
      aria-live="polite"
      aria-label="세션 확인 중"
    >
      <div className="size-6 animate-spin rounded-full border-2 border-muted-foreground/20 border-t-muted-foreground" />
    </div>
  );
}
