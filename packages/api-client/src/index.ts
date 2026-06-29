// @repo/api-client entry point

import type { QueryClient, UseInfiniteQueryOptions } from "@tanstack/react-query";
import { useInfiniteQuery as useTanStackInfiniteQuery } from "@tanstack/react-query";
import createFetchClient, { type Middleware } from "openapi-fetch";
import createQueryClient from "openapi-react-query";
import type { paths } from "./generated/paths.js";

export interface ProductBuilderApiOptions {
  baseUrl: string;
  /** 매 요청마다 호출 — Bearer token/session headers (apps/app/src/lib/trpc.ts 의 getAuthHeaders 와 동일 계약) */
  getHeaders?: () => Record<string, string> | Promise<Record<string, string>>;
  fetch?: typeof fetch;
}

type QueryParams = Record<string, unknown>;
interface InitWithParams {
  params?: {
    query?: QueryParams;
    [key: string]: unknown;
  };
  [key: string]: unknown;
}
interface FetchResult {
  data?: unknown;
  error?: unknown;
  response?: Response;
}
type ClientRequest = (method: string, path: string, init: InitWithParams) => Promise<FetchResult>;
type InfiniteQueryKey = readonly [unknown, unknown, unknown?];
type ProductBuilderInfiniteQueryOptions = UseInfiniteQueryOptions<
  unknown,
  unknown,
  unknown,
  readonly unknown[],
  unknown
>;

/** @internal Ensures first-page infinite queries do not leak `cursor=0`. */
export function mergePageParamIntoInit(
  init: unknown,
  pageParamName: string,
  pageParam: unknown,
  signal?: AbortSignal,
): InitWithParams {
  const initObject = ((init ?? {}) as InitWithParams) ?? {};
  const params = initObject.params ?? {};
  const query = params.query ?? {};
  const mergedQuery = pageParam === undefined ? query : { ...query, [pageParamName]: pageParam };
  return {
    ...initObject,
    signal,
    params: {
      ...params,
      query: mergedQuery,
    },
  };
}

export function createProductBuilderApi(options: ProductBuilderApiOptions) {
  const client = createFetchClient<paths>({
    baseUrl: options.baseUrl,
    credentials: "include",
    fetch: options.fetch,
  });

  if (options.getHeaders) {
    const authMiddleware: Middleware = {
      async onRequest({ request }) {
        const headers = (await options.getHeaders?.()) ?? {};
        for (const [k, v] of Object.entries(headers)) request.headers.set(k, v);
        return request;
      },
    };
    client.use(authMiddleware);
  }

  const queryApi = createQueryClient(client);
  const useInfiniteQueryWithoutInitialCursor = ((...args: unknown[]) => {
    const [method, path, init, options, queryClient] = args;
    const infiniteOptions = (options ?? {}) as { pageParamName?: string } & Record<string, unknown>;
    const { pageParamName = "cursor", ...restOptions } = infiniteOptions;
    const queryKey = (
      init === undefined ? [method, path] : [method, path, init]
    ) as readonly unknown[];
    const tanstackOptions = {
      queryKey,
      queryFn: async ({ queryKey: requestQueryKey, pageParam, signal }) => {
        const [requestMethod, requestPath, requestInit] = requestQueryKey as InfiniteQueryKey;
        const mergedInit = mergePageParamIntoInit(requestInit, pageParamName, pageParam, signal);
        const request = client.request as unknown as ClientRequest;
        const { data, error, response } = await request(
          String(requestMethod),
          String(requestPath),
          mergedInit,
        );
        if (error) throw error;
        if (response?.status === 204 || response?.headers.get("Content-Length") === "0") {
          return data ?? null;
        }
        return data;
      },
      ...restOptions,
    } as ProductBuilderInfiniteQueryOptions;

    return useTanStackInfiniteQuery(tanstackOptions, queryClient as QueryClient | undefined);
  }) as typeof queryApi.useInfiniteQuery;

  const $api = {
    ...queryApi,
    useInfiniteQuery: useInfiniteQueryWithoutInitialCursor,
  };
  return { client, $api };
}

export type ProductBuilderApi = ReturnType<typeof createProductBuilderApi>;
export type { components, operations } from "./generated/paths.js";
export type { paths };
