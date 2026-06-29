import { captureClientError, PostHogProvider } from "@repo/core/analytics/client";
import {
  isUnauthorizedError,
  refreshSessionToken,
  setAuthApiUrl,
  useAnalyticsIdentity,
  useAuthStateSync,
  useProfileSync,
} from "@repo/core/auth";
import { ErrorBoundary } from "@repo/core/error/client";
import { I18nextProvider } from "@repo/core/i18n";
import { ThemeProvider } from "@repo/core/theme";
import { useSyncListener } from "@repo/data/broadcast";
import { DataProvider } from "@repo/data/provider";
import { createRemoteBackend } from "@repo/data/remote";
import { WidgetsApiProvider } from "@repo/widgets";
import { MutationCache, QueryCache, QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { RouterProvider } from "@tanstack/react-router";
import { Provider as JotaiProvider } from "jotai";
import { Toaster } from "sonner";
import { apiClient } from "./lib/api";
import { API_URL } from "./lib/auth-headers";
import { i18n } from "./lib/feature-i18n";
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
          refreshSessionToken();
          // window.location.href 제거 — Electron에서 full reload 시 세션 소실.
          // AuthGuard가 authenticated 상태로 리다이렉트 처리.
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
    onError: (error) => {
      captureClientError(error instanceof Error ? error : new Error(String(error)), {
        source: "mutation_cache",
      });

      if (isUnauthorizedError(error)) {
        refreshSessionToken();
        // AuthGuard가 리다이렉트 처리. window.location 제거.
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
  useAnalyticsIdentity();
  useSyncListener(queryClient);
  return children;
}

const remoteBackend = createRemoteBackend({ api: apiClient });

export function App() {
  return (
    <ErrorBoundary>
      <PostHogProvider apiKey={POSTHOG_API_KEY} host={POSTHOG_HOST}>
        <QueryClientProvider client={queryClient}>
          <JotaiProvider>
            <I18nextProvider i18n={i18n}>
              <ThemeProvider>
                <AuthSync>
                  <WidgetsApiProvider api={apiClient}>
                    <DataProvider backend={remoteBackend}>
                      <RouterProvider router={router} />
                      <Toaster position="top-right" richColors />
                    </DataProvider>
                  </WidgetsApiProvider>
                </AuthSync>
              </ThemeProvider>
            </I18nextProvider>
          </JotaiProvider>
        </QueryClientProvider>
      </PostHogProvider>
    </ErrorBoundary>
  );
}
