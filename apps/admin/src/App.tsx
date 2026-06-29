import { captureClientError, PostHogProvider } from "@repo/core/analytics/client";
import {
  isUnauthorizedError,
  refreshSessionToken,
  setAuthApiUrl,
  useAuthStateSync,
  useProfileSync,
} from "@repo/core/auth";
import { ErrorBoundary } from "@repo/core/error/client";
import { ThemeProvider } from "@repo/core/theme";
import { WidgetsApiProvider } from "@repo/widgets";
import { MutationCache, QueryCache, QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { RouterProvider } from "@tanstack/react-router";
import { Provider as JotaiProvider } from "jotai";
import { Toaster } from "sonner";
import { API_URL, apiClient } from "./lib/api";
import { createAppRouter } from "./router";

// API URL을 세션 갱신 유틸에 등록
setAuthApiUrl(API_URL);

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 5, // 5 minutes
      retry: (failureCount, error) => {
        if (isUnauthorizedError(error) && failureCount === 0) return true;
        return false;
      },
      retryDelay: (failureCount, error) => {
        if (isUnauthorizedError(error) && failureCount === 0) {
          refreshSessionToken().then((success) => {
            if (!success) {
              window.location.href = "/admin/login";
            }
          });
          return 1500;
        }
        return 0;
      },
    },
  },
  queryCache: new QueryCache({
    onError: (error) => {
      captureClientError(error instanceof Error ? error : new Error(String(error)), {
        source: "query_cache",
      });
    },
  }),
  mutationCache: new MutationCache({
    onError: async (error) => {
      captureClientError(error instanceof Error ? error : new Error(String(error)), {
        source: "mutation_cache",
      });

      if (isUnauthorizedError(error)) {
        const success = await refreshSessionToken();
        if (!success) {
          window.location.href = "/admin/login";
        }
      }
    },
  }),
});

const router = createAppRouter(queryClient);

const POSTHOG_API_KEY = import.meta.env.VITE_POSTHOG_API_KEY ?? "";
const POSTHOG_HOST = import.meta.env.VITE_POSTHOG_HOST ?? "https://us.i.posthog.com";

function AuthSync({ children }: { children: React.ReactNode }) {
  useAuthStateSync();
  useProfileSync();
  return children;
}

export function App() {
  return (
    <ErrorBoundary>
      <PostHogProvider apiKey={POSTHOG_API_KEY} host={POSTHOG_HOST}>
        <QueryClientProvider client={queryClient}>
          <JotaiProvider>
            <ThemeProvider>
              <AuthSync>
                <WidgetsApiProvider api={apiClient}>
                  <RouterProvider router={router} />
                  <Toaster position="top-right" richColors />
                </WidgetsApiProvider>
              </AuthSync>
            </ThemeProvider>
          </JotaiProvider>
        </QueryClientProvider>
      </PostHogProvider>
    </ErrorBoundary>
  );
}
