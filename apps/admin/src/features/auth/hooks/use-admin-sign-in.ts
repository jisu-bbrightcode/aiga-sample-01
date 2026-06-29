import { useTranslation } from "@repo/core/i18n";
import { useNavigate } from "@tanstack/react-router";
import { toast } from "sonner";
import { useTokenAuthAction } from "./use-token-auth-action";

/**
 * Admin 로그인 훅
 * - 이메일/비밀번호로 로그인
 * - 로그인 성공 시 /로 이동
 * - role 체크는 AdminGuard에서 수행
 */
export function useAdminSignIn() {
  const navigate = useNavigate();
  const { t } = useTranslation("auth");

  return useTokenAuthAction(
    async (apiUrl: string, email: string, password: string) => {
      const res = await fetch(`${apiUrl}/api/auth/sign-in`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      const data = await res.json();
      if (!res.ok) return { data: null, error: { message: data.message ?? "Sign in failed" } };
      return { data, error: null };
    },
    {
      onSuccess: () => {
        navigate({ to: "/", replace: true });
        toast.success(t("adminSignInSuccess"));
      },
      onError: (error) => {
        toast.error(t("adminSignInError"));
        console.error(error);
      },
    },
  );
}
