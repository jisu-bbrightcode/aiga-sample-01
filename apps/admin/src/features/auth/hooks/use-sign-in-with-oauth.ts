import { useNavigate } from "@tanstack/react-router";
import { useTokenAuthAction } from "./use-token-auth-action";

interface OAuthCredentials {
  provider: string;
  options?: { redirectTo?: string; queryParams?: Record<string, string> };
}

export function useSignInWithOAuth(credential: OAuthCredentials) {
  const navigate = useNavigate();

  return useTokenAuthAction(
    async (apiUrl: string) => {
      const res = await fetch(`${apiUrl}/api/auth/oauth/${credential.provider}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(credential.options ?? {}),
      });
      const data = await res.json();
      if (!res.ok) return { data: null, error: { message: data.message ?? "OAuth failed" } };
      // OAuth flow may redirect externally
      if (data.url) {
        window.location.href = data.url;
      }
      return { data, error: null };
    },
    {
      onSuccess: () => {
        navigate({ to: "/", replace: true });
      },
      onError: (error) => {
        console.error(error);
      },
    },
  );
}
