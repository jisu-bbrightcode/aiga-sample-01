interface ApiQueryOptions {
  params?: {
    path?: Record<string, unknown>;
    query?: Record<string, unknown>;
  };
}

export function isApiQueryKey(queryKey: readonly unknown[], method: string, path: string) {
  return queryKey[0] === method && queryKey[1] === path;
}

export function getApiPathParams(queryKey: readonly unknown[]) {
  return getApiQueryOptions(queryKey)?.params?.path;
}

export function getApiQueryParams(queryKey: readonly unknown[]) {
  return getApiQueryOptions(queryKey)?.params?.query;
}

function getApiQueryOptions(queryKey: readonly unknown[]): ApiQueryOptions | undefined {
  const candidate = queryKey[2];
  if (!candidate || typeof candidate !== "object") return undefined;
  return candidate as ApiQueryOptions;
}
