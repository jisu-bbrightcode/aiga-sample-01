import { useTranslation } from "@repo/core/i18n";
import { useNavigate } from "@tanstack/react-router";
import { toast } from "sonner";
import { useTokenAuthAction } from "./use-token-auth-action";

export function useSignUpWithEmailAndPassword() {
  const navigate = useNavigate();
  const { t } = useTranslation("auth");

  return useTokenAuthAction(
    async (
      apiUrl: string,
      email: string,
      password: string,
      options: { firstName: string; lastName: string },
    ) => {
      const res = await fetch(`${apiUrl}/api/auth/sign-up`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email,
          password,
          name: `${options.firstName} ${options.lastName}`,
        }),
      });
      const data = await res.json();
      if (!res.ok) return { data: null, error: { message: data.message ?? "Sign up failed" } };
      return { data, error: null };
    },
    {
      onSuccess: () => {
        navigate({ to: "/", replace: true });
        toast.success(t("signUpSuccess"));
      },
      onError: (error) => {
        toast.error(t("signUpError"));
        console.error(error);
      },
    },
  );
}
