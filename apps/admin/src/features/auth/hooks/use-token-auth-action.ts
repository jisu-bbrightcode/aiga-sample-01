import { TOKEN_STORAGE_KEY } from "@repo/core/auth";
import { useAsync } from "@repo/shared/hooks";

interface AuthActionOptions<TData> {
  onSuccess?: (data: TData) => void;
  onError?: (error: Error) => void;
}

interface AuthResponse {
  data: unknown;
  error: { message: string } | null;
}

/**
 * Token-based auth action hook
 */
export function useTokenAuthAction<TArgs extends unknown[], TResponse extends AuthResponse>(
  action: (apiUrl: string, ...args: TArgs) => Promise<TResponse>,
  options: AuthActionOptions<TResponse["data"]> = {},
) {
  const apiUrl = import.meta.env.VITE_API_URL ?? "http://localhost:3002";

  const result = useAsync(async (...args: TArgs) => {
    const { data, error } = await action(apiUrl, ...args);
    if (error) {
      throw new Error(error.message);
    }
    // Store token if present
    const token = (data as { token?: string })?.token;
    if (token) {
      localStorage.setItem(TOKEN_STORAGE_KEY, JSON.stringify(token));
    }
    return data;
  }, options);

  return result;
}
